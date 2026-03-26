#!/usr/bin/env python3
"""
preprocess_data.py - ETL pipeline for Segurança Paraná dashboard.

Reads raw SINESP XLSX files (municipal + UF) and produces compact JSON
files consumed by the frontend.

Output files (all in data/processed/):
  - criminalidade.json    (municipal vitimas data)
  - violencia_letal.json  (UF-level lethal violence by crime type)
  - patrimonio.json       (UF-level property crimes by type)
  - drogas.json           (placeholder - SINESP has no drug data)
  - serie_historica.json  (monthly + annual + by-type aggregations)
  - atlas_violencia.json  (long-term Atlas da Violência series)
  - geo_map.json          (municipality -> mesoregion via IBGE API)
  - metadata.json         (dataset metadata)
  - municipios.geojson    (copy of mun_PR.json)
"""

import json
import logging
import shutil
import sys
from datetime import datetime
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd
import requests

logger = logging.getLogger(__name__)

BASE_DIR = Path(__file__).parent.parent
RAW_DIR = BASE_DIR / "data" / "raw"
OUT_DIR = BASE_DIR / "dashboard" / "public" / "data"

IBGE_POP_JSON = RAW_DIR / "ibge" / "populacao_municipios.json"
IBGE_POP_CSV = RAW_DIR / "ibge" / "populacao_estimada_pr.csv"
IBGE_SIDRA_URL = (
    "https://apisidra.ibge.gov.br/values/t/6579/n6/in%20n3%2041/v/9324/p/all/f/n"
)

# Portuguese month names -> month number
MES_PT: dict[str, int] = {
    "janeiro": 1,
    "fevereiro": 2,
    "março": 3,
    "abril": 4,
    "maio": 5,
    "junho": 6,
    "julho": 7,
    "agosto": 8,
    "setembro": 9,
    "outubro": 10,
    "novembro": 11,
    "dezembro": 12,
}

# Crime-type classification for UF data
CRIMES_LETAIS = {
    "Homicídio doloso",
    "Lesão corporal seguida de morte",
    "Roubo seguido de morte (latrocínio)",
    "Tentativa de homicídio",
}

CRIMES_PATRIMONIO = {
    "Furto de veículo",
    "Roubo a instituição financeira",
    "Roubo de carga",
    "Roubo de veículo",
}

CRIMES_SEXUAL = {
    "Estupro",
}


# ---------------------------------------------------------------------------
# Population data
# ---------------------------------------------------------------------------

def _load_population_from_json(path: Path) -> tuple[dict[int, dict[int, int]], str]:
    """
    Load IBGE SIDRA population data from a local JSON file.

    Returns (pop_lookup, source_label) where pop_lookup maps
    cod_ibge -> {year -> population}.
    """
    logger.info("Loading population data from %s", path.name)
    with open(path, encoding="utf-8") as f:
        raw = json.load(f)

    pop: dict[int, dict[int, int]] = {}
    # SIDRA JSON: first row is header, subsequent rows are data
    for entry in raw[1:] if isinstance(raw, list) and len(raw) > 1 else raw:
        try:
            cod_str = str(entry.get("D3C", entry.get("cod_ibge", "")))
            year_str = str(entry.get("D4C", entry.get("ano", "")))
            val_str = str(entry.get("V", entry.get("populacao", "0")))
            cod = int(cod_str)
            year = int(year_str)
            val = int(float(val_str))
            pop.setdefault(cod, {})[year] = val
        except (ValueError, TypeError):
            continue

    logger.info("Loaded population for %d municipalities from JSON", len(pop))
    return pop, "ibge_sidra_json_local"


def _load_population_from_csv(path: Path) -> tuple[dict[int, dict[int, int]], str]:
    """
    Load IBGE population estimates from the local CSV file.

    The CSV has columns: cod_ibge, municipio, ano, populacao.
    The 'ano' column may contain descriptive text instead of a year number;
    in that case we treat the estimate as year-agnostic (applied to all years).
    """
    logger.info("Loading population data from %s", path.name)
    df = pd.read_csv(path, dtype={"cod_ibge": int, "populacao": int})
    pop: dict[int, dict[int, int]] = {}

    for rec in df.to_dict(orient="records"):
        cod = int(rec["cod_ibge"])
        populacao = int(rec["populacao"])
        try:
            year = int(rec["ano"])
        except (ValueError, TypeError):
            # Year-agnostic estimate: store under key 0
            year = 0
        pop.setdefault(cod, {})[year] = populacao

    logger.info("Loaded population for %d municipalities from CSV", len(pop))
    return pop, "ibge_estimativa_csv_local"


def _fetch_population_from_api() -> tuple[dict[int, dict[int, int]], str]:
    """
    Fetch IBGE SIDRA population data directly from the API.
    Table 6579 - Population estimates for Paraná municipalities.
    """
    logger.info("Fetching population data from IBGE SIDRA API ...")
    try:
        resp = requests.get(IBGE_SIDRA_URL, timeout=60)
        resp.raise_for_status()
        raw = resp.json()
    except Exception as exc:
        logger.warning("IBGE SIDRA API request failed: %s", exc)
        return {}, "ibge_sidra_api_failed"

    pop: dict[int, dict[int, int]] = {}
    for entry in raw[1:] if isinstance(raw, list) and len(raw) > 1 else raw:
        try:
            cod = int(entry.get("D3C", ""))
            year = int(entry.get("D4C", ""))
            val = int(float(entry.get("V", "0")))
            pop.setdefault(cod, {})[year] = val
        except (ValueError, TypeError):
            continue

    logger.info("Fetched population for %d municipalities from API", len(pop))
    return pop, "ibge_sidra_api"


def load_population() -> tuple[dict[int, dict[int, int]], str]:
    """
    Load population data, trying sources in priority order:
    1. Local JSON (IBGE SIDRA table 6579)
    2. Local CSV (populacao_estimada_pr.csv)
    3. IBGE SIDRA API (live fetch)

    Returns (pop_lookup, source_label).
    pop_lookup: cod_ibge -> {year -> population}
    Year key 0 means year-agnostic estimate.
    """
    if IBGE_POP_JSON.exists():
        return _load_population_from_json(IBGE_POP_JSON)

    if IBGE_POP_CSV.exists():
        return _load_population_from_csv(IBGE_POP_CSV)

    return _fetch_population_from_api()


def _get_population(
    pop_lookup: dict[int, dict[int, int]],
    cod_ibge: int,
    year: int,
) -> int | None:
    """
    Look up population for a municipality and year.
    Falls back to year-agnostic estimate (key 0) if exact year not found.
    """
    by_year = pop_lookup.get(cod_ibge)
    if by_year is None:
        return None
    if year in by_year:
        return by_year[year]
    if 0 in by_year:
        return by_year[0]
    # Fall back to closest available year
    available = sorted(by_year.keys())
    if not available:
        return None
    closest = min(available, key=lambda y: abs(y - year) if y != 0 else float("inf"))
    return by_year.get(closest)


def _calc_rate(vitimas: int, populacao: int | None) -> float | None:
    """Calculate per-100k rate. Returns None if population is unavailable or zero."""
    if populacao is None or populacao <= 0:
        return None
    return round((vitimas / populacao) * 100_000, 2)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _save_json(data: Any, name: str) -> None:
    """Write *data* as compact JSON to OUT_DIR / name."""
    dest = OUT_DIR / name
    dest.write_text(
        json.dumps(data, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )
    size_kb = dest.stat().st_size / 1024
    logger.info("[OK] %s  (%.1f KB)", name, size_kb)


# ---------------------------------------------------------------------------
# Municipal data  (SINESP municipios.xlsx, sheet 'PR')
# ---------------------------------------------------------------------------

def load_municipios() -> pd.DataFrame:
    """
    Load SINESP municipal data for Paraná.

    The XLSX has one tab per state. Columns have CP1252 encoding artefacts
    so we use POSITIONAL renaming instead of matching column names.

    Positional columns:
      0: cod_ibge (int)
      1: municipio (str)
      2: uf (str)
      3: regiao (str)
      4: mes_ano (datetime)
      5: vitimas (int)

    Range: 2018-2022, 399 municipalities, monthly.
    No per-crime-type breakdown (only total vitimas).
    """
    path = RAW_DIR / "sinesp" / "indicadores_municipios.xlsx"
    if not path.exists():
        logger.warning("%s not found - run download_data.py first", path)
        return pd.DataFrame()

    logger.info("Reading %s sheet='PR' ...", path.name)
    df = pd.read_excel(path, sheet_name="PR")

    # Positional rename (safe against encoding issues)
    cols = list(df.columns)
    rename_map = {
        cols[0]: "cod_ibge",
        cols[1]: "municipio",
        cols[2]: "uf",
        cols[3]: "regiao",
        cols[4]: "mes_ano",
        cols[5]: "vitimas",
    }
    df = df.rename(columns=rename_map)

    df["cod_ibge"] = pd.to_numeric(df["cod_ibge"], errors="coerce").astype("Int64")
    df["vitimas"] = pd.to_numeric(df["vitimas"], errors="coerce").fillna(0).astype(int)
    df["mes_ano"] = pd.to_datetime(df["mes_ano"], errors="coerce")
    df["ano"] = df["mes_ano"].dt.year
    df["mes"] = df["mes_ano"].dt.month

    df = df.dropna(subset=["cod_ibge", "mes_ano"])
    logger.info(
        "%d rows, %d municipalities, %d-%d",
        len(df), df["cod_ibge"].nunique(),
        df["ano"].min(), df["ano"].max(),
    )
    return df


# ---------------------------------------------------------------------------
# UF-level data  (SINESP uf.xlsx, sheet 'Ocorrências')
# ---------------------------------------------------------------------------

def load_uf() -> pd.DataFrame:
    """
    Load SINESP UF-level data (state-level by crime type).

    Sheet: 'Ocorrências'
    Positional columns:
      0: uf (str)
      1: tipo_crime (str)
      2: ano (int)
      3: mes (str - Portuguese text)
      4: ocorrencias (int)

    9 crime types, range 2015-2022, monthly.
    """
    path = RAW_DIR / "sinesp" / "indicadores_uf.xlsx"
    if not path.exists():
        logger.warning("%s not found - run download_data.py first", path)
        return pd.DataFrame()

    logger.info("Reading %s sheet='Ocorrências' ...", path.name)
    df = pd.read_excel(path, sheet_name="Ocorrências")

    cols = list(df.columns)
    rename_map = {
        cols[0]: "uf",
        cols[1]: "tipo_crime",
        cols[2]: "ano",
        cols[3]: "mes",
        cols[4]: "ocorrencias",
    }
    df = df.rename(columns=rename_map)

    # Filter Paraná only
    df = df[df["uf"].str.strip().str.upper() == "PARANÁ"].copy()

    # Convert month names to numbers
    df["mes_num"] = (
        df["mes"]
        .str.strip()
        .str.lower()
        .map(MES_PT)
    )

    df["ano"] = pd.to_numeric(df["ano"], errors="coerce").astype("Int64")
    df["ocorrencias"] = pd.to_numeric(df["ocorrencias"], errors="coerce").fillna(0).astype(int)

    df = df.dropna(subset=["ano", "mes_num"])
    df["mes_num"] = df["mes_num"].astype(int)

    logger.info(
        "%d rows, %d crime types, %d-%d",
        len(df), df["tipo_crime"].nunique(),
        df["ano"].min(), df["ano"].max(),
    )
    return df


# ---------------------------------------------------------------------------
# UF-level victims by sex  (SINESP uf.xlsx, sheet 'Vítimas')
# ---------------------------------------------------------------------------

def load_uf_vitimas() -> pd.DataFrame:
    """
    Load SINESP UF-level victim data with sex breakdown.

    Sheet: 'Vítimas'
    Positional columns:
      0: uf (str)
      1: tipo_crime (str)
      2: ano (int)
      3: mes (str - Portuguese text)
      4: sexo (str - Feminino/Masculino/Sexo NI)
      5: vitimas (int)

    3 crime types (homicídio doloso, lesão corporal seguida de morte,
    latrocínio), range 2015-2022, monthly.
    """
    path = RAW_DIR / "sinesp" / "indicadores_uf.xlsx"
    if not path.exists():
        return pd.DataFrame()

    logger.info("Reading %s sheet='Vítimas' ...", path.name)
    try:
        df = pd.read_excel(path, sheet_name="Vítimas")
    except Exception:
        # Sheet name may have encoding issues
        df = pd.read_excel(path, sheet_name=1)

    cols = list(df.columns)
    rename_map = {
        cols[0]: "uf",
        cols[1]: "tipo_crime",
        cols[2]: "ano",
        cols[3]: "mes",
        cols[4]: "sexo",
        cols[5]: "vitimas",
    }
    df = df.rename(columns=rename_map)

    df = df[df["uf"].str.strip().str.upper() == "PARANÁ"].copy()

    df["mes_num"] = df["mes"].str.strip().str.lower().map(MES_PT)
    df["ano"] = pd.to_numeric(df["ano"], errors="coerce").astype("Int64")
    df["vitimas"] = pd.to_numeric(df["vitimas"], errors="coerce").fillna(0).astype(int)
    df = df.dropna(subset=["ano", "mes_num"])
    df["mes_num"] = df["mes_num"].astype(int)

    logger.info(
        "%d rows, %d crime types, sexos: %s",
        len(df), df["tipo_crime"].nunique(),
        sorted(df["sexo"].unique()),
    )
    return df


# ---------------------------------------------------------------------------
# Output builders
# ---------------------------------------------------------------------------

def build_criminalidade(
    df_mun: pd.DataFrame,
    pop_lookup: dict[int, dict[int, int]],
    pop_fonte: str,
) -> list[dict]:
    """Municipal-level vitimas data -> criminalidade.json"""
    if df_mun.empty:
        return []

    records = []
    for rec in df_mun[["cod_ibge", "municipio", "ano", "mes", "vitimas"]].to_dict(orient="records"):
        cod = int(rec["cod_ibge"])
        ano = int(rec["ano"])
        vitimas = int(rec["vitimas"])
        populacao = _get_population(pop_lookup, cod, ano)
        taxa = _calc_rate(vitimas, populacao)

        entry: dict[str, Any] = {
            "cod_ibge": cod,
            "municipio": str(rec["municipio"]).strip(),
            "ano": ano,
            "mes": int(rec["mes"]),
            "vitimas": vitimas,
        }
        if populacao is not None:
            entry["populacao"] = populacao
        if taxa is not None:
            entry["taxa_por_100k"] = taxa
        entry["populacao_fonte"] = pop_fonte

        records.append(entry)
    return records


def build_violencia_letal(df_uf: pd.DataFrame) -> list[dict]:
    """UF lethal violence crimes -> violencia_letal.json"""
    if df_uf.empty:
        return []

    subset = df_uf[df_uf["tipo_crime"].isin(CRIMES_LETAIS)].copy()
    return [
        {
            "tipo_crime": str(rec["tipo_crime"]),
            "ano": int(rec["ano"]),
            "mes": int(rec["mes_num"]),
            "ocorrencias": int(rec["ocorrencias"]),
        }
        for rec in subset[["tipo_crime", "ano", "mes_num", "ocorrencias"]].to_dict(orient="records")
    ]


def build_patrimonio(df_uf: pd.DataFrame) -> list[dict]:
    """UF property crimes -> patrimonio.json"""
    if df_uf.empty:
        return []

    subset = df_uf[df_uf["tipo_crime"].isin(CRIMES_PATRIMONIO)].copy()
    return [
        {
            "tipo_crime": str(rec["tipo_crime"]),
            "ano": int(rec["ano"]),
            "mes": int(rec["mes_num"]),
            "ocorrencias": int(rec["ocorrencias"]),
        }
        for rec in subset[["tipo_crime", "ano", "mes_num", "ocorrencias"]].to_dict(orient="records")
    ]


def build_drogas() -> dict:
    """Placeholder - SINESP has no drug data at municipal or UF level."""
    return {
        "nota": (
            "SINESP não disponibiliza dados sobre drogas. "
            "Os relatórios SESP-PR/CAPE contêm essas informações em PDF. "
            "Consulte data/raw/sesp_pr/ para os relatórios anuais de drogas."
        ),
        "fonte_alternativa": "SESP-PR/CAPE relatórios anuais (PDF)",
        "dados": [],
    }


def build_vitimas_sexo(df_vit: pd.DataFrame) -> list[dict]:
    """UF victim data by sex -> vitimas_sexo.json"""
    if df_vit.empty:
        return []
    return [
        {
            "tipo_crime": str(rec["tipo_crime"]),
            "ano": int(rec["ano"]),
            "mes": int(rec["mes_num"]),
            "sexo": str(rec["sexo"]),
            "vitimas": int(rec["vitimas"]),
        }
        for rec in df_vit[["tipo_crime", "ano", "mes_num", "sexo", "vitimas"]].to_dict(orient="records")
    ]


def build_serie_historica(
    df_mun: pd.DataFrame,
    df_uf: pd.DataFrame,
    pop_lookup: dict[int, dict[int, int]],
) -> dict:
    """
    Combined time series:
      - mensal_municipal: monthly totals (all municipalities summed)
      - anual_municipal: annual totals
      - mensal_uf_tipo: monthly by crime type (UF level)
      - anual_uf_tipo: annual by crime type (UF level)
    """
    result: dict[str, Any] = {}

    # Municipal aggregations
    if not df_mun.empty:
        mensal = (
            df_mun.groupby(["ano", "mes"])["vitimas"]
            .sum()
            .reset_index()
            .sort_values(["ano", "mes"])
        )
        # Compute total state population per year for rate calculation
        state_pop_by_year: dict[int, int] = {}
        for year in mensal["ano"].unique():
            total = 0
            for cod, by_year in pop_lookup.items():
                p = by_year.get(int(year))  # exact year only, no fallback
                if p is not None:
                    total += p
            if total > 0:
                state_pop_by_year[int(year)] = total

        mensal_records = []
        for rec in mensal.to_dict(orient="records"):
            ano = int(rec["ano"])
            vitimas = int(rec["vitimas"])
            entry: dict[str, Any] = {"ano": ano, "mes": int(rec["mes"]), "vitimas": vitimas}
            state_pop = state_pop_by_year.get(ano)
            taxa = _calc_rate(vitimas, state_pop)
            if taxa is not None:
                entry["taxa_por_100k"] = taxa
            mensal_records.append(entry)
        result["mensal_municipal"] = mensal_records

        anual = (
            df_mun.groupby("ano")["vitimas"]
            .sum()
            .reset_index()
            .sort_values("ano")
        )
        anual_records = []
        for rec in anual.to_dict(orient="records"):
            ano = int(rec["ano"])
            vitimas = int(rec["vitimas"])
            entry_a: dict[str, Any] = {"ano": ano, "vitimas": vitimas}
            state_pop = state_pop_by_year.get(ano)
            # For annual, multiply monthly rate base by 12 is wrong;
            # use annual vitimas / population directly
            taxa = _calc_rate(vitimas, state_pop)
            if taxa is not None:
                entry_a["taxa_por_100k"] = taxa
            anual_records.append(entry_a)
        result["anual_municipal"] = anual_records
    else:
        result["mensal_municipal"] = []
        result["anual_municipal"] = []

    # UF by crime type aggregations
    if not df_uf.empty:
        mensal_tipo = (
            df_uf.groupby(["tipo_crime", "ano", "mes_num"])["ocorrencias"]
            .sum()
            .reset_index()
            .sort_values(["tipo_crime", "ano", "mes_num"])
        )
        result["mensal_uf_tipo"] = [
            {
                "tipo_crime": str(rec["tipo_crime"]),
                "ano": int(rec["ano"]),
                "mes": int(rec["mes_num"]),
                "ocorrencias": int(rec["ocorrencias"]),
            }
            for rec in mensal_tipo.to_dict(orient="records")
        ]

        anual_tipo = (
            df_uf.groupby(["tipo_crime", "ano"])["ocorrencias"]
            .sum()
            .reset_index()
            .sort_values(["tipo_crime", "ano"])
        )
        result["anual_uf_tipo"] = [
            {
                "tipo_crime": str(rec["tipo_crime"]),
                "ano": int(rec["ano"]),
                "ocorrencias": int(rec["ocorrencias"]),
            }
            for rec in anual_tipo.to_dict(orient="records")
        ]
    else:
        result["mensal_uf_tipo"] = []
        result["anual_uf_tipo"] = []

    return result


def build_atlas_violencia() -> dict:
    """
    Long-term Atlas da Violência series.
    Reads the downloaded XLSX if available.
    """
    path = RAW_DIR / "atlas" / "atlas_violencia.xlsx"
    if not path.exists():
        logger.warning("Atlas da Violência XLSX not found")
        return {"nota": "Arquivo não encontrado. Execute download_data.py.", "dados": []}

    try:
        logger.info("Reading %s ...", path.name)
        df = pd.read_excel(path)

        # Atlas structure varies; try to find Paraná rows
        # Known UF column patterns (tried in priority order)
        col_lower = {c: c.lower().strip() for c in df.columns}
        df = df.rename(columns=col_lower)

        # Try filtering for PR using known column name patterns
        uf_col_candidates = ("sigla_uf", "uf", "nome_uf", "estado")
        uf_col = None
        for candidate in uf_col_candidates:
            if candidate in df.columns:
                uf_col = candidate
                break

        if uf_col is not None:
            mask = df[uf_col].astype(str).str.strip().str.upper().isin({"PR", "PARANÁ"})
            df_pr = df[mask].copy()
            if df_pr.empty:
                logger.warning(
                    "Atlas: UF column '%s' found but no PR/PARANÁ rows matched. "
                    "Unique values: %s",
                    uf_col,
                    df[uf_col].unique()[:10].tolist(),
                )
        else:
            logger.warning(
                "Atlas: no UF column found. Tried columns: %s. "
                "Available columns: %s. Using all rows.",
                uf_col_candidates,
                list(df.columns),
            )
            df_pr = df.copy()

        # Try to identify value columns for better error reporting
        value_col_candidates = ("taxa_homicidio", "num_homicidios", "taxa")
        found_value_cols = [c for c in value_col_candidates if c in df_pr.columns]
        if not found_value_cols and not df_pr.empty:
            logger.info(
                "Atlas: none of the expected value columns %s found. "
                "Available columns: %s",
                value_col_candidates,
                list(df_pr.columns),
            )

        records = df_pr.to_dict(orient="records")
        # Convert numpy types to native Python
        clean = json.loads(json.dumps(records, default=str))
        logger.info("%d rows for Atlas da Violência", len(clean))
        return {"fonte": "IPEA / Atlas da Violência", "dados": clean}

    except Exception as exc:
        logger.error("Could not parse Atlas XLSX: %s", exc)
        return {"nota": f"Erro ao processar: {exc}", "dados": []}


def build_geo_map() -> list[dict]:
    """
    Municipality -> mesoregion mapping via IBGE API.
    GET https://servicodados.ibge.gov.br/api/v1/localidades/estados/41/municipios
    """
    logger.info("Fetching municipality -> mesoregion mapping from IBGE API ...")
    url = "https://servicodados.ibge.gov.br/api/v1/localidades/estados/41/municipios"
    try:
        resp = requests.get(url, timeout=30)
        resp.raise_for_status()
        data = resp.json()
    except Exception as exc:
        logger.error("IBGE API request failed: %s", exc)
        return []

    records = [
        {
            "cod_ibge": mun["id"],
            "municipio": mun["nome"],
            "microrregiao": mun.get("microrregiao", {}).get("nome", ""),
            "mesorregiao": mun.get("microrregiao", {}).get("mesorregiao", {}).get("nome", ""),
        }
        for mun in data
    ]

    logger.info("%d municipalities mapped", len(records))
    return records


def build_metadata(
    df_mun: pd.DataFrame,
    df_uf: pd.DataFrame,
    pop_fonte: str,
) -> dict:
    """Dataset metadata summary."""
    meta: dict[str, Any] = {
        "gerado_em": datetime.now().isoformat(timespec="seconds"),
        "populacao_fonte": pop_fonte,
        "fontes": {
            "sinesp_municipios": {
                "arquivo": "indicadores_municipios.xlsx",
                "sheet": "PR",
                "periodo": "",
                "municipios": 0,
                "registros": 0,
                "nota": "Apenas total de vítimas (sem detalhamento por tipo de crime)",
            },
            "sinesp_uf": {
                "arquivo": "indicadores_uf.xlsx",
                "sheet": "Ocorrências",
                "periodo": "",
                "tipos_crime": [],
                "registros": 0,
                "nota": "9 tipos de crime, nível estadual, mensal",
            },
            "atlas_violencia": {
                "arquivo": "atlas_violencia.xlsx",
                "nota": "Série longa IPEA",
            },
            "sesp_pr": {
                "nota": "Relatórios PDF (criminal, mortes, drogas, trânsito) 2007-2025",
            },
            "ibge": {
                "nota": "Estimativas populacionais por município (SIDRA tabela 6579)",
            },
        },
    }

    if not df_mun.empty:
        meta["fontes"]["sinesp_municipios"]["periodo"] = (
            f"{int(df_mun['ano'].min())}-{int(df_mun['ano'].max())}"
        )
        meta["fontes"]["sinesp_municipios"]["municipios"] = int(df_mun["cod_ibge"].nunique())
        meta["fontes"]["sinesp_municipios"]["registros"] = len(df_mun)

    if not df_uf.empty:
        meta["fontes"]["sinesp_uf"]["periodo"] = (
            f"{int(df_uf['ano'].min())}-{int(df_uf['ano'].max())}"
        )
        meta["fontes"]["sinesp_uf"]["tipos_crime"] = sorted(df_uf["tipo_crime"].unique().tolist())
        meta["fontes"]["sinesp_uf"]["registros"] = len(df_uf)

    return meta


def copy_geojson() -> None:
    """Copy mun_PR.json -> municipios.geojson"""
    src = BASE_DIR / "mun_PR.json"
    dest = OUT_DIR / "municipios.geojson"
    if not src.exists():
        logger.warning("%s not found - skipping geojson copy", src)
        return
    shutil.copy2(src, dest)
    size_kb = dest.stat().st_size / 1024
    logger.info("[OK] municipios.geojson  (%.1f KB, copied from mun_PR.json)", size_kb)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(message)s",
        datefmt="%H:%M:%S",
    )

    logger.info("Base dir : %s", BASE_DIR)
    logger.info("Output   : %s", OUT_DIR)
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    # Load population data
    logger.info("--- Loading population data ---")
    pop_lookup, pop_fonte = load_population()
    if not pop_lookup:
        logger.warning("No population data available - per-capita rates will be omitted")

    # Load raw data
    logger.info("--- Loading municipal data ---")
    df_mun = load_municipios()

    logger.info("--- Loading UF data ---")
    df_uf = load_uf()

    logger.info("--- Loading UF victims by sex ---")
    df_vit = load_uf_vitimas()

    # Build outputs
    logger.info("--- Building output JSONs ---")

    _save_json(build_criminalidade(df_mun, pop_lookup, pop_fonte), "criminalidade.json")
    _save_json(build_violencia_letal(df_uf), "violencia_letal.json")
    _save_json(build_patrimonio(df_uf), "patrimonio.json")
    _save_json(build_vitimas_sexo(df_vit), "vitimas_sexo.json")
    _save_json(build_drogas(), "drogas.json")
    _save_json(build_serie_historica(df_mun, df_uf, pop_lookup), "serie_historica.json")
    _save_json(build_atlas_violencia(), "atlas_violencia.json")
    _save_json(build_geo_map(), "geo_map.json")
    _save_json(build_metadata(df_mun, df_uf, pop_fonte), "metadata.json")
    copy_geojson()

    logger.info("=== Preprocessing complete ===")


if __name__ == "__main__":
    main()
