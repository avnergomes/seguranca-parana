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
import shutil
import sys
from datetime import datetime
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd
import requests

BASE_DIR = Path(__file__).parent.parent
RAW_DIR = BASE_DIR / "data" / "raw"
OUT_DIR = BASE_DIR / "dashboard" / "public" / "data"

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
    print(f"  [OK] {name}  ({size_kb:.1f} KB)")


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
        print(f"  [WARN] {path} not found - run download_data.py first")
        return pd.DataFrame()

    print(f"  Reading {path.name} sheet='PR' ...")
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
    print(f"  {len(df)} rows, {df['cod_ibge'].nunique()} municipalities, "
          f"{df['ano'].min()}-{df['ano'].max()}")
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
        print(f"  [WARN] {path} not found - run download_data.py first")
        return pd.DataFrame()

    print(f"  Reading {path.name} sheet='Ocorrências' ...")
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

    print(f"  {len(df)} rows, {df['tipo_crime'].nunique()} crime types, "
          f"{df['ano'].min()}-{df['ano'].max()}")
    return df


# ---------------------------------------------------------------------------
# Output builders
# ---------------------------------------------------------------------------

def build_criminalidade(df_mun: pd.DataFrame) -> list[dict]:
    """Municipal-level vitimas data -> criminalidade.json"""
    if df_mun.empty:
        return []

    records = []
    for _, row in df_mun.iterrows():
        records.append({
            "cod_ibge": int(row["cod_ibge"]),
            "municipio": str(row["municipio"]).strip(),
            "ano": int(row["ano"]),
            "mes": int(row["mes"]),
            "vitimas": int(row["vitimas"]),
        })
    return records


def build_violencia_letal(df_uf: pd.DataFrame) -> list[dict]:
    """UF lethal violence crimes -> violencia_letal.json"""
    if df_uf.empty:
        return []

    subset = df_uf[df_uf["tipo_crime"].isin(CRIMES_LETAIS)].copy()
    records = []
    for _, row in subset.iterrows():
        records.append({
            "tipo_crime": str(row["tipo_crime"]),
            "ano": int(row["ano"]),
            "mes": int(row["mes_num"]),
            "ocorrencias": int(row["ocorrencias"]),
        })
    return records


def build_patrimonio(df_uf: pd.DataFrame) -> list[dict]:
    """UF property crimes -> patrimonio.json"""
    if df_uf.empty:
        return []

    subset = df_uf[df_uf["tipo_crime"].isin(CRIMES_PATRIMONIO)].copy()
    records = []
    for _, row in subset.iterrows():
        records.append({
            "tipo_crime": str(row["tipo_crime"]),
            "ano": int(row["ano"]),
            "mes": int(row["mes_num"]),
            "ocorrencias": int(row["ocorrencias"]),
        })
    return records


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


def build_serie_historica(
    df_mun: pd.DataFrame,
    df_uf: pd.DataFrame,
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
        result["mensal_municipal"] = [
            {"ano": int(r["ano"]), "mes": int(r["mes"]), "vitimas": int(r["vitimas"])}
            for _, r in mensal.iterrows()
        ]

        anual = (
            df_mun.groupby("ano")["vitimas"]
            .sum()
            .reset_index()
            .sort_values("ano")
        )
        result["anual_municipal"] = [
            {"ano": int(r["ano"]), "vitimas": int(r["vitimas"])}
            for _, r in anual.iterrows()
        ]
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
                "tipo_crime": str(r["tipo_crime"]),
                "ano": int(r["ano"]),
                "mes": int(r["mes_num"]),
                "ocorrencias": int(r["ocorrencias"]),
            }
            for _, r in mensal_tipo.iterrows()
        ]

        anual_tipo = (
            df_uf.groupby(["tipo_crime", "ano"])["ocorrencias"]
            .sum()
            .reset_index()
            .sort_values(["tipo_crime", "ano"])
        )
        result["anual_uf_tipo"] = [
            {
                "tipo_crime": str(r["tipo_crime"]),
                "ano": int(r["ano"]),
                "ocorrencias": int(r["ocorrencias"]),
            }
            for _, r in anual_tipo.iterrows()
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
        print("  [WARN] Atlas da Violência XLSX not found")
        return {"nota": "Arquivo não encontrado. Execute download_data.py.", "dados": []}

    try:
        print(f"  Reading {path.name} ...")
        df = pd.read_excel(path)

        # Atlas structure varies; try to find Paraná rows
        # Common columns: sigla_uf or nome_uf, ano, taxa_homicidio, etc.
        col_lower = {c: c.lower().strip() for c in df.columns}
        df = df.rename(columns=col_lower)

        # Try filtering for PR
        uf_col = None
        for candidate in ("sigla_uf", "uf", "nome_uf", "estado"):
            if candidate in df.columns:
                uf_col = candidate
                break

        if uf_col is not None:
            mask = df[uf_col].astype(str).str.strip().str.upper().isin({"PR", "PARANÁ"})
            df_pr = df[mask].copy()
        else:
            df_pr = df.copy()

        records = df_pr.to_dict(orient="records")
        # Convert numpy types to native Python
        clean = json.loads(json.dumps(records, default=str))
        print(f"  {len(clean)} rows for Atlas da Violência")
        return {"fonte": "IPEA / Atlas da Violência", "dados": clean}

    except Exception as exc:
        print(f"  [FAIL] Could not parse Atlas XLSX: {exc}")
        return {"nota": f"Erro ao processar: {exc}", "dados": []}


def build_geo_map() -> list[dict]:
    """
    Municipality -> mesoregion mapping via IBGE API.
    GET https://servicodados.ibge.gov.br/api/v1/localidades/estados/41/municipios
    """
    print("  Fetching municipality -> mesoregion mapping from IBGE API ...")
    url = "https://servicodados.ibge.gov.br/api/v1/localidades/estados/41/municipios"
    try:
        resp = requests.get(url, timeout=30)
        resp.raise_for_status()
        data = resp.json()
    except Exception as exc:
        print(f"  [FAIL] IBGE API: {exc}")
        return []

    records = []
    for mun in data:
        micro = mun.get("microrregiao", {})
        meso = micro.get("mesorregiao", {})
        records.append({
            "cod_ibge": mun["id"],
            "municipio": mun["nome"],
            "microrregiao": micro.get("nome", ""),
            "mesorregiao": meso.get("nome", ""),
        })

    print(f"  {len(records)} municipalities mapped")
    return records


def build_metadata(df_mun: pd.DataFrame, df_uf: pd.DataFrame) -> dict:
    """Dataset metadata summary."""
    meta: dict[str, Any] = {
        "gerado_em": datetime.now().isoformat(timespec="seconds"),
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
        print(f"  [WARN] {src} not found - skipping geojson copy")
        return
    shutil.copy2(src, dest)
    size_kb = dest.stat().st_size / 1024
    print(f"  [OK] municipios.geojson  ({size_kb:.1f} KB, copied from mun_PR.json)")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    print(f"Base dir : {BASE_DIR}")
    print(f"Output   : {OUT_DIR}")
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    # Load raw data
    print("\n--- Loading municipal data ---")
    df_mun = load_municipios()

    print("\n--- Loading UF data ---")
    df_uf = load_uf()

    # Build outputs
    print("\n--- Building output JSONs ---")

    _save_json(build_criminalidade(df_mun), "criminalidade.json")
    _save_json(build_violencia_letal(df_uf), "violencia_letal.json")
    _save_json(build_patrimonio(df_uf), "patrimonio.json")
    _save_json(build_drogas(), "drogas.json")
    _save_json(build_serie_historica(df_mun, df_uf), "serie_historica.json")
    _save_json(build_atlas_violencia(), "atlas_violencia.json")
    _save_json(build_geo_map(), "geo_map.json")
    _save_json(build_metadata(df_mun, df_uf), "metadata.json")
    copy_geojson()

    print("\n=== Preprocessing complete ===")


if __name__ == "__main__":
    main()
