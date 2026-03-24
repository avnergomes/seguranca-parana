#!/usr/bin/env python3
"""
download_data.py - Downloads raw data from all 6 sources for Segurança Paraná.

Sources:
  1. SINESP/MJ (XLSX municipal + UF)
  2. IPARDES (delegates to scrape_ipardes.py)
  3. Atlas da Violência / IPEA
  4. SESP-PR / CAPE (PDF catalog 2007-2025)
  5. IBGE SIDRA population
  6. Base dos Dados / FBSP
"""

import os
import subprocess
import sys
import time
from pathlib import Path

import requests

BASE_DIR = Path(__file__).parent.parent
RAW_DIR = BASE_DIR / "data" / "raw"

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _ensure_dirs() -> None:
    """Create all required subdirectories inside data/raw."""
    for sub in ("sinesp", "ipardes", "atlas", "sesp_pr", "ibge", "basedosdados"):
        (RAW_DIR / sub).mkdir(parents=True, exist_ok=True)


def _download(url: str, dest: Path, *, timeout: int = 120) -> bool:
    """Download *url* to *dest*.  Returns True on success."""
    if dest.exists():
        print(f"  [skip] {dest.name} already exists")
        return True
    print(f"  [GET]  {url}")
    try:
        resp = requests.get(url, timeout=timeout, stream=True)
        resp.raise_for_status()
        with open(dest, "wb") as fh:
            for chunk in resp.iter_content(chunk_size=1 << 16):
                fh.write(chunk)
        size_kb = dest.stat().st_size / 1024
        print(f"         -> {dest.name}  ({size_kb:.0f} KB)")
        return True
    except Exception as exc:
        print(f"  [FAIL] {exc}")
        if dest.exists():
            dest.unlink()
        return False


# ---------------------------------------------------------------------------
# 1. SINESP / Ministério da Justiça
# ---------------------------------------------------------------------------

SINESP_URLS = {
    "indicadores_municipios.xlsx": (
        "http://dados.mj.gov.br/dataset/210b9ae2-21fc-4986-89c6-2006eb4db247"
        "/resource/03af7ce2-174e-4ebd-b085-384503cfb40f"
        "/download/indicadoressegurancapublicamunic.xlsx"
    ),
    "indicadores_uf.xlsx": (
        "http://dados.mj.gov.br/dataset/210b9ae2-21fc-4986-89c6-2006eb4db247"
        "/resource/feeae05e-faba-406c-8a4a-512aec91a9d1"
        "/download/indicadoressegurancapublicauf.xlsx"
    ),
}


def download_sinesp() -> None:
    print("\n=== 1. SINESP / MJ ===")
    dest_dir = RAW_DIR / "sinesp"
    for fname, url in SINESP_URLS.items():
        _download(url, dest_dir / fname)


# ---------------------------------------------------------------------------
# 2. IPARDES  (delegates to scrape_ipardes.py)
# ---------------------------------------------------------------------------

def download_ipardes() -> None:
    print("\n=== 2. IPARDES ===")
    script = Path(__file__).parent / "scrape_ipardes.py"
    if not script.exists():
        print("  [WARN] scrape_ipardes.py not found – skipping")
        return
    subprocess.run([sys.executable, str(script)], check=False)


# ---------------------------------------------------------------------------
# 3. Atlas da Violência / IPEA
# ---------------------------------------------------------------------------

ATLAS_URL = (
    "https://www.ipea.gov.br/atlasviolencia/arquivos/downloads/"
    "atlas_da_violencia_dados_brutos.xlsx"
)


def download_atlas() -> None:
    print("\n=== 3. Atlas da Violência / IPEA ===")
    _download(ATLAS_URL, RAW_DIR / "atlas" / "atlas_violencia.xlsx")


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


def download_sesp_pr() -> None:
    print("\n=== 4. SESP-PR / CAPE  (PDF catalog) ===")
    dest_dir = RAW_DIR / "sesp_pr"
    ok = fail = skip = 0
    for fname, url in SESP_PDFS.items():
        dest = dest_dir / fname
        if dest.exists():
            skip += 1
            continue
        if _download(url, dest):
            ok += 1
        else:
            fail += 1
        time.sleep(0.5)  # be polite
    print(f"  SESP-PR totals: {ok} downloaded, {skip} skipped, {fail} failed")


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


def download_ibge() -> None:
    print("\n=== 5. IBGE SIDRA (population) ===")
    dest = RAW_DIR / "ibge" / "populacao_municipios.json"
    _download(SIDRA_URL, dest, timeout=180)


# ---------------------------------------------------------------------------
# 6. Base dos Dados / FBSP
# ---------------------------------------------------------------------------

BASEDOSDADOS_URL = (
    "https://basedosdados.org/dataset/"
    "br-fbsp-atlas-violencia?"
    "bdm_table=municipio"
)


def download_basedosdados() -> None:
    print("\n=== 6. Base dos Dados / FBSP ===")
    print("  Base dos Dados requires BigQuery access.")
    print(f"  Dataset page: {BASEDOSDADOS_URL}")
    print("  To download programmatically:")
    print("    pip install basedosdados")
    print("    import basedosdados as bd")
    print('    df = bd.read_table("br_fbsp_atlas_violencia", "municipio", billing_project_id="SEU_PROJETO")')
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
        print(f"  Wrote instructions to {dest}")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    print(f"Base dir : {BASE_DIR}")
    print(f"Raw dir  : {RAW_DIR}")
    _ensure_dirs()

    download_sinesp()
    download_ipardes()
    download_atlas()
    download_sesp_pr()
    download_ibge()
    download_basedosdados()

    print("\n=== Done ===")


if __name__ == "__main__":
    main()
