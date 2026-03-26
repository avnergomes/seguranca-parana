#!/usr/bin/env python3
"""
download_data.py - Downloads raw data from all 6 sources for Segurança Paraná.

Sources:
  1. SINESP/MJ (XLSX municipal + UF) — resolved via CKAN API
  2. IPARDES (delegates to scrape_ipardes.py)
  3. Atlas da Violência / IPEA
  4. SESP-PR / CAPE (PDF catalog 2007-2025)
  5. IBGE SIDRA population
  6. Base dos Dados / FBSP
"""

from __future__ import annotations

import argparse
import logging
import os
import subprocess
import sys
import time
from dataclasses import dataclass
from email.utils import formatdate, parsedate_to_datetime
from pathlib import Path
from typing import NamedTuple

import requests

logger = logging.getLogger("download_data")

BASE_DIR = Path(__file__).parent.parent
RAW_DIR = BASE_DIR / "data" / "raw"

# ---------------------------------------------------------------------------
# Immutable result tracking
# ---------------------------------------------------------------------------


class DownloadResult(NamedTuple):
    source: str
    file: str
    status: str  # "ok" | "fail" | "skip"


@dataclass(frozen=True)
class DownloadSummary:
    results: tuple[DownloadResult, ...] = ()

    @property
    def ok(self) -> int:
        return sum(1 for r in self.results if r.status == "ok")

    @property
    def fail(self) -> int:
        return sum(1 for r in self.results if r.status == "fail")

    @property
    def skip(self) -> int:
        return sum(1 for r in self.results if r.status == "skip")

    def add(self, result: DownloadResult) -> "DownloadSummary":
        """Return a new summary with the result appended (immutable)."""
        return DownloadSummary(results=self.results + (result,))


# ---------------------------------------------------------------------------
# Retry wrapper
# ---------------------------------------------------------------------------

_MAX_RETRIES = 3
_BACKOFF_SECONDS = (2, 4, 8)
assert len(_BACKOFF_SECONDS) >= _MAX_RETRIES - 1, \
    "BACKOFF_SECONDS must have at least MAX_RETRIES-1 entries"


def _request_with_retry(
    method: str,
    url: str,
    *,
    timeout: int = 120,
    stream: bool = False,
    headers: dict[str, str] | None = None,
    params: dict[str, str] | None = None,
    allow_304: bool = False,
) -> requests.Response:
    """Execute an HTTP request with exponential-backoff retry (3 attempts).

    When *allow_304* is True, HTTP 304 responses are returned without raising.
    """
    last_exc: Exception | None = None
    for attempt in range(_MAX_RETRIES):
        try:
            resp = requests.request(
                method,
                url,
                timeout=timeout,
                stream=stream,
                headers=headers or {},
                params=params or {},
            )
            if allow_304 and resp.status_code == 304:
                return resp
            resp.raise_for_status()
            return resp
        except (requests.RequestException, OSError) as exc:
            last_exc = exc
            if attempt < _MAX_RETRIES - 1:
                delay = _BACKOFF_SECONDS[attempt]
                logger.warning(
                    "Attempt %d/%d failed for %s: %s — retrying in %ds",
                    attempt + 1,
                    _MAX_RETRIES,
                    url,
                    exc,
                    delay,
                )
                time.sleep(delay)
    raise last_exc  # type: ignore[misc]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _ensure_dirs() -> None:
    """Create all required subdirectories inside data/raw."""
    for sub in ("sinesp", "ipardes", "atlas", "sesp_pr", "ibge", "basedosdados"):
        (RAW_DIR / sub).mkdir(parents=True, exist_ok=True)


def _download(
    url: str,
    dest: Path,
    *,
    force: bool = True,
    timeout: int = 120,
) -> str:
    """Download *url* to *dest*.

    Returns:
        "ok"   – file was (re-)downloaded successfully
        "skip" – file was fresh (force=False + server says not modified)
        raises on unrecoverable failure
    """
    headers: dict[str, str] = {}

    if dest.exists() and not force:
        # Conditional GET — use If-Modified-Since if we have a local copy
        mtime = dest.stat().st_mtime
        headers["If-Modified-Since"] = formatdate(mtime, usegmt=True)

    logger.info("  [GET]  %s", url)

    resp = _request_with_retry(
        "GET", url, timeout=timeout, stream=True, headers=headers,
        allow_304=bool(headers.get("If-Modified-Since")),
    )

    if resp.status_code == 304:
        logger.info("         -> %s  (not modified)", dest.name)
        return "skip"

    # Stream to disk
    tmp = dest.with_suffix(dest.suffix + ".tmp")
    written = 0
    try:
        with open(tmp, "wb") as fh:
            for chunk in resp.iter_content(chunk_size=1 << 16):
                fh.write(chunk)
                written += len(chunk)

        # Content-Length validation
        expected = resp.headers.get("Content-Length")
        if expected is not None and int(expected) != written:
            tmp.unlink(missing_ok=True)
            raise IOError(
                f"Size mismatch for {dest.name}: "
                f"expected {expected} bytes, got {written}"
            )

        # Atomic replace
        tmp.replace(dest)

        # Preserve Last-Modified as mtime for future conditional GETs
        last_mod = resp.headers.get("Last-Modified")
        if last_mod:
            try:
                ts = parsedate_to_datetime(last_mod).timestamp()
                os.utime(dest, (ts, ts))
            except Exception:
                pass

        size_kb = written / 1024
        logger.info("         -> %s  (%.0f KB)", dest.name, size_kb)
        return "ok"
    except Exception:
        tmp.unlink(missing_ok=True)
        raise


def _safe_download(
    url: str,
    dest: Path,
    *,
    source: str,
    force: bool = True,
    timeout: int = 120,
) -> DownloadResult:
    """Wrapper around _download that catches errors and returns a result."""
    try:
        status = _download(url, dest, force=force, timeout=timeout)
        return DownloadResult(source=source, file=dest.name, status=status)
    except Exception as exc:
        logger.error("  [FAIL] %s: %s", dest.name, exc)
        return DownloadResult(source=source, file=dest.name, status="fail")


# ---------------------------------------------------------------------------
# 1. SINESP / Ministério da Justiça  — dynamic CKAN resolution
# ---------------------------------------------------------------------------

CKAN_API_URL = "https://dados.mj.gov.br/api/3/action/package_show"
CKAN_DATASET_ID = "sistema-nacional-de-estatisticas-de-seguranca-publica"

# Patterns to identify the two SINESP resources by name
_SINESP_MUNIC_PATTERNS = ("municip", "munic")
_SINESP_UF_PATTERNS = ("uf",)

# Hardcoded fallback URLs — used when the CKAN API is unreachable
_SINESP_FALLBACK_URLS: dict[str, str] = {
    "indicadores_municipios.xlsx": (
        "https://dados.mj.gov.br/dataset/"
        "210b9ae2-21fc-4986-89c6-2006eb4db247/resource/"
        "03af7ce2-174e-4886-89c5-4ad97e684c8b/download/"
        "indicadoressegurancapublicamunic1702to202312.xlsx"
    ),
    "indicadores_uf.xlsx": (
        "https://dados.mj.gov.br/dataset/"
        "210b9ae2-21fc-4986-89c6-2006eb4db247/resource/"
        "fecee826-73de-4871-a33e-cb014e1540c0/download/"
        "indicadoressegurancapublicauf.xlsx"
    ),
}


def _resolve_sinesp_urls() -> dict[str, str]:
    """Query the CKAN API to resolve current SINESP download URLs.

    Returns a dict mapping local filename -> download URL.
    """
    logger.info("  Querying CKAN API for SINESP resources...")
    resp = _request_with_retry(
        "GET",
        CKAN_API_URL,
        timeout=30,
        headers={"Accept": "application/json"},
        params={"id": CKAN_DATASET_ID},
    )
    data = resp.json()

    if not data.get("success"):
        raise RuntimeError(f"CKAN API returned success=false: {data}")

    resources = data["result"]["resources"]
    xlsx_resources = [r for r in resources if r.get("format", "").upper() == "XLSX"]

    urls: dict[str, str] = {}

    for res in xlsx_resources:
        name_lower = res.get("name", "").lower()
        url = res.get("url", "")
        if not url:
            continue

        if any(pat in name_lower for pat in _SINESP_MUNIC_PATTERNS):
            urls["indicadores_municipios.xlsx"] = url
        elif any(pat in name_lower for pat in _SINESP_UF_PATTERNS):
            urls["indicadores_uf.xlsx"] = url

    if len(urls) < 2:
        logger.warning(
            "  CKAN returned %d XLSX resources (expected 2). Found: %s",
            len(urls),
            list(urls.keys()),
        )

    return urls


def download_sinesp(force: bool = True) -> DownloadSummary:
    logger.info("\n=== 1. SINESP / MJ ===")
    dest_dir = RAW_DIR / "sinesp"
    summary = DownloadSummary()

    try:
        sinesp_urls = _resolve_sinesp_urls()
    except Exception as exc:
        logger.warning(
            "  CKAN API failed (%s) — falling back to hardcoded URLs", exc
        )
        sinesp_urls = _SINESP_FALLBACK_URLS

    for fname, url in sinesp_urls.items():
        result = _safe_download(
            url, dest_dir / fname, source="sinesp", force=force
        )
        summary = summary.add(result)

    return summary


# ---------------------------------------------------------------------------
# 2. IPARDES  (delegates to scrape_ipardes.py)
# ---------------------------------------------------------------------------


def download_ipardes() -> DownloadSummary:
    logger.info("\n=== 2. IPARDES ===")
    script = Path(__file__).parent / "scrape_ipardes.py"
    if not script.exists():
        logger.warning("  scrape_ipardes.py not found - skipping")
        return DownloadSummary(
            results=(DownloadResult(source="ipardes", file="scrape_ipardes.py", status="skip"),)
        )
    result = subprocess.run([sys.executable, str(script)], check=False)
    status = "ok" if result.returncode == 0 else "fail"
    if status == "fail":
        logger.error("  scrape_ipardes.py exited with code %d", result.returncode)
    return DownloadSummary(
        results=(DownloadResult(source="ipardes", file=script.name, status=status),)
    )


# ---------------------------------------------------------------------------
# 3. Atlas da Violência / IPEA
# ---------------------------------------------------------------------------

ATLAS_URL = (
    "https://www.ipea.gov.br/atlasviolencia/arquivos/downloads/"
    "atlas_da_violencia_dados_brutos.xlsx"
)


def download_atlas(force: bool = True) -> DownloadSummary:
    logger.info("\n=== 3. Atlas da Violência / IPEA ===")
    result = _safe_download(
        ATLAS_URL,
        RAW_DIR / "atlas" / "atlas_violencia.xlsx",
        source="atlas",
        force=force,
    )
    return DownloadSummary(results=(result,))


# ---------------------------------------------------------------------------
# 4. SESP-PR / CAPE  –  complete PDF catalog 2007-2025
# ---------------------------------------------------------------------------

_SESP_BASE = "https://www.seguranca.pr.gov.br/sites/default/arquivos_restritos/files/documento"

# fmt: off
SESP_PDFS: dict[str, str] = {
    # --- 2025 ---------------------------------------------------------
    "2025_3tri_mortes_violentas.pdf":      f"{_SESP_BASE}/2025-04/mortes_violentas_3_tri_2025.pdf",
    "2025_3tri_criminal.pdf":              f"{_SESP_BASE}/2025-04/criminal_3_tri_2025.pdf",
    "2025_3tri_drogas.pdf":                f"{_SESP_BASE}/2025-04/drogas_3_tri_2025.pdf",
    # --- 2024 ---------------------------------------------------------
    "2024_mortes_violentas.pdf":           f"{_SESP_BASE}/2024-04/mortes_violentas_2024.pdf",
    "2024_criminal.pdf":                   f"{_SESP_BASE}/2024-04/criminal_2024.pdf",
    "2024_drogas.pdf":                     f"{_SESP_BASE}/2024-04/drogas_2024.pdf",
    # --- 2023 ---------------------------------------------------------
    "2023_mortes_violentas.pdf":           f"{_SESP_BASE}/2023-04/mortes_violentas_2023.pdf",
    "2023_criminal.pdf":                   f"{_SESP_BASE}/2023-04/criminal_2023.pdf",
    "2023_drogas.pdf":                     f"{_SESP_BASE}/2023-04/drogas_2023.pdf",
    # --- 2022 ---------------------------------------------------------
    "2022_mortes_violentas.pdf":           f"{_SESP_BASE}/2022-04/mortes_violentas_2022.pdf",
    "2022_criminal.pdf":                   f"{_SESP_BASE}/2022-04/criminal_2022.pdf",
    "2022_drogas.pdf":                     f"{_SESP_BASE}/2022-04/drogas_2022.pdf",
    # --- 2021 ---------------------------------------------------------
    "2021_mortes_violentas.pdf":           f"{_SESP_BASE}/2021-04/mortes_violentas_2021.pdf",
    "2021_criminal.pdf":                   f"{_SESP_BASE}/2021-04/criminal_2021.pdf",
    "2021_drogas.pdf":                     f"{_SESP_BASE}/2021-04/drogas_2021.pdf",
    # --- 2020 ---------------------------------------------------------
    "2020_mortes_violentas.pdf":           f"{_SESP_BASE}/2020-04/mortes_violentas_2020.pdf",
    "2020_criminal.pdf":                   f"{_SESP_BASE}/2020-04/criminal_2020.pdf",
    "2020_drogas.pdf":                     f"{_SESP_BASE}/2020-04/drogas_2020.pdf",
    # --- 2019 ---------------------------------------------------------
    "2019_mortes_violentas.pdf":           f"{_SESP_BASE}/2019-04/mortes_violentas_2019.pdf",
    "2019_criminal.pdf":                   f"{_SESP_BASE}/2019-04/criminal_2019.pdf",
    "2019_drogas.pdf":                     f"{_SESP_BASE}/2019-04/drogas_2019.pdf",
    # --- 2018 ---------------------------------------------------------
    "2018_mortes_violentas.pdf":           f"{_SESP_BASE}/2018-04/mortes_violentas_2018.pdf",
    "2018_criminal.pdf":                   f"{_SESP_BASE}/2018-04/criminal_2018.pdf",
    "2018_drogas.pdf":                     f"{_SESP_BASE}/2018-04/drogas_2018.pdf",
    # --- 2017 ---------------------------------------------------------
    "2017_mortes_violentas.pdf":           f"{_SESP_BASE}/2017-04/mortes_violentas_2017.pdf",
    "2017_criminal.pdf":                   f"{_SESP_BASE}/2017-04/criminal_2017.pdf",
    "2017_drogas.pdf":                     f"{_SESP_BASE}/2017-04/drogas_2017.pdf",
    # --- 2016 ---------------------------------------------------------
    "2016_mortes_violentas.pdf":           f"{_SESP_BASE}/2016-04/mortes_violentas_2016.pdf",
    "2016_criminal.pdf":                   f"{_SESP_BASE}/2016-04/criminal_2016.pdf",
    "2016_drogas.pdf":                     f"{_SESP_BASE}/2016-04/drogas_2016.pdf",
    # --- 2015 ---------------------------------------------------------
    "2015_mortes_violentas.pdf":           f"{_SESP_BASE}/2015-04/mortes_violentas_2015.pdf",
    "2015_criminal.pdf":                   f"{_SESP_BASE}/2015-04/criminal_2015.pdf",
    "2015_drogas.pdf":                     f"{_SESP_BASE}/2015-04/drogas_2015.pdf",
    # --- 2014 (includes transito) ------------------------------------
    "2014_mortes_violentas.pdf":           f"{_SESP_BASE}/2014-04/mortes_violentas_2014.pdf",
    "2014_criminal.pdf":                   f"{_SESP_BASE}/2014-04/criminal_2014.pdf",
    "2014_drogas.pdf":                     f"{_SESP_BASE}/2014-04/drogas_2014.pdf",
    "2014_transito.pdf":                   f"{_SESP_BASE}/2014-04/transito_2014.pdf",
    # --- 2013 (criminal + mortes + transito) -------------------------
    "2013_criminal.pdf":                   f"{_SESP_BASE}/2013-04/criminal_2013.pdf",
    "2013_mortes_violentas.pdf":           f"{_SESP_BASE}/2013-04/mortes_violentas_2013.pdf",
    "2013_transito.pdf":                   f"{_SESP_BASE}/2013-04/transito_2013.pdf",
    # --- 2012 (criminal + mortes + transito) -------------------------
    "2012_criminal.pdf":                   f"{_SESP_BASE}/2012-04/criminal_2012.pdf",
    "2012_mortes_violentas.pdf":           f"{_SESP_BASE}/2012-04/mortes_violentas_2012.pdf",
    "2012_transito.pdf":                   f"{_SESP_BASE}/2012-04/transito_2012.pdf",
    # --- 2011 (criminal only) ----------------------------------------
    "2011_criminal.pdf":                   f"{_SESP_BASE}/2011-04/criminal_2011.pdf",
    # --- 2010 (criminal only) ----------------------------------------
    "2010_criminal.pdf":                   f"{_SESP_BASE}/2010-04/criminal_2010.pdf",
    # --- 2009 (criminal only) ----------------------------------------
    "2009_criminal.pdf":                   f"{_SESP_BASE}/2009-04/criminal_2009.pdf",
    # --- 2008 (criminal only) ----------------------------------------
    "2008_criminal.pdf":                   f"{_SESP_BASE}/2008-04/criminal_2008.pdf",
    # --- 2007 (criminal only) ----------------------------------------
    "2007_criminal.pdf":                   f"{_SESP_BASE}/2007-04/criminal_2007.pdf",
}
# fmt: on


def download_sesp_pr(force: bool = True) -> DownloadSummary:
    logger.info("\n=== 4. SESP-PR / CAPE  (PDF catalog) ===")
    dest_dir = RAW_DIR / "sesp_pr"
    summary = DownloadSummary()

    for fname, url in SESP_PDFS.items():
        dest = dest_dir / fname
        result = _safe_download(
            url, dest, source="sesp_pr", force=force
        )
        summary = summary.add(result)
        time.sleep(0.5)  # be polite

    return summary


# ---------------------------------------------------------------------------
# 5. IBGE SIDRA  –  population estimates by municipality
# ---------------------------------------------------------------------------

SIDRA_URL = (
    "https://apisidra.ibge.gov.br/values"
    "/t/6579"            # Table 6579 – population estimates
    "/n6/all"            # all municipalities
    "/v/9324"            # estimated population
    "/p/all"             # all periods
    "/d/v9324%200"       # no decimals
    "/f/n"               # header = n
)


def download_ibge(force: bool = True) -> DownloadSummary:
    logger.info("\n=== 5. IBGE SIDRA (population) ===")
    result = _safe_download(
        SIDRA_URL,
        RAW_DIR / "ibge" / "populacao_municipios.json",
        source="ibge",
        force=force,
        timeout=180,
    )
    return DownloadSummary(results=(result,))


# ---------------------------------------------------------------------------
# 6. Base dos Dados / FBSP
# ---------------------------------------------------------------------------

BASEDOSDADOS_URL = (
    "https://basedosdados.org/dataset/"
    "br-fbsp-atlas-violencia?"
    "bdm_table=municipio"
)


def download_basedosdados() -> DownloadSummary:
    logger.info("\n=== 6. Base dos Dados / FBSP ===")
    logger.info("  Base dos Dados requires BigQuery access.")
    logger.info("  Dataset page: %s", BASEDOSDADOS_URL)
    logger.info("  To download programmatically:")
    logger.info("    pip install basedosdados")
    logger.info("    import basedosdados as bd")
    logger.info(
        '    df = bd.read_table("br_fbsp_atlas_violencia", "municipio",'
        ' billing_project_id="SEU_PROJETO")'
    )
    dest = RAW_DIR / "basedosdados" / "README_manual.txt"
    if not dest.exists():
        dest.write_text(
            "Base dos Dados / FBSP\n"
            "=====================\n\n"
            "This dataset requires a Google Cloud billing project.\n"
            f"See: {BASEDOSDADOS_URL}\n\n"
            "Run:\n"
            "  pip install basedosdados\n"
            "  import basedosdados as bd\n"
            '  df = bd.read_table("br_fbsp_atlas_violencia", "municipio",\n'
            '                     billing_project_id="SEU_PROJETO")\n'
            '  df.to_csv("atlas_fbsp.csv", index=False)\n',
            encoding="utf-8",
        )
        logger.info("  Wrote instructions to %s", dest)

    return DownloadSummary(
        results=(DownloadResult(source="basedosdados", file="README_manual.txt", status="skip"),)
    )


# ---------------------------------------------------------------------------
# CLI and main
# ---------------------------------------------------------------------------


def _parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Download raw data for Segurança Paraná.",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        default=False,
        help=(
            "Force re-download of all files. When omitted, uses "
            "If-Modified-Since to skip fresh files."
        ),
    )
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> None:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(message)s",
        datefmt="%H:%M:%S",
    )

    args = _parse_args(argv)
    force = args.force

    logger.info("Base dir : %s", BASE_DIR)
    logger.info("Raw dir  : %s", RAW_DIR)
    logger.info("Force    : %s", force)
    _ensure_dirs()

    # Accumulate results immutably
    summary = DownloadSummary()
    for download_fn in (
        lambda: download_sinesp(force=force),
        download_ipardes,
        lambda: download_atlas(force=force),
        lambda: download_sesp_pr(force=force),
        lambda: download_ibge(force=force),
        download_basedosdados,
    ):
        partial = download_fn()
        for r in partial.results:
            summary = summary.add(r)

    # Final summary
    logger.info("\n=== Download Summary ===")
    logger.info("  OK   : %d", summary.ok)
    logger.info("  Skip : %d", summary.skip)
    logger.info("  Fail : %d", summary.fail)

    if summary.fail > 0:
        logger.error("Failed downloads:")
        for r in summary.results:
            if r.status == "fail":
                logger.error("  - [%s] %s", r.source, r.file)

    logger.info("=== Done ===")


if __name__ == "__main__":
    main()
