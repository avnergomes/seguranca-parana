import { useState, useEffect, useMemo, useCallback } from 'react'

const BASE = import.meta.env.BASE_URL + 'data/'

async function fetchJson(path) {
  const res = await fetch(BASE + path)
  if (!res.ok) throw new Error(`Falha ao carregar ${path}: ${res.status}`)
  return res.json()
}

/**
 * Data structures from ETL:
 *   criminalidade.json    - array [{cod_ibge, municipio, ano, mes, vitimas}]
 *   violencia_letal.json  - array [{tipo_crime, ano, mes, ocorrencias}]  (UF-level)
 *   patrimonio.json       - array [{tipo_crime, ano, mes, ocorrencias}]  (UF-level)
 *   drogas.json           - {nota, ...}  (placeholder)
 *   serie_historica.json  - {mensal_municipal[], anual_municipal[], mensal_uf_tipo[], anual_uf_tipo[]}
 *   atlas_violencia.json  - {nota, dados}
 *   municipios.geojson    - GeoJSON FeatureCollection
 *   geo_map.json          - array [{cod_ibge, municipio, microrregiao, mesorregiao}]
 *   metadata.json         - {gerado_em, fontes}
 */

export function useData() {
  const [raw, setRaw] = useState(null)
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState(null)

  const [filtros, setFiltrosState] = useState({
    anoInicio: null,
    anoFim: null,
    mesorregiao: 'todas',
    municipio: 'todos',
    tipoCrime: 'todos',
  })

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const [crim, vl, pat, drug, serie, atlas, geo, gmap, meta] = await Promise.all([
          fetchJson('criminalidade.json'),
          fetchJson('violencia_letal.json'),
          fetchJson('patrimonio.json'),
          fetchJson('drogas.json'),
          fetchJson('serie_historica.json'),
          fetchJson('atlas_violencia.json'),
          fetchJson('municipios.geojson'),
          fetchJson('geo_map.json'),
          fetchJson('metadata.json'),
        ])
        if (cancelled) return
        setRaw({ crim, vl, pat, drug, serie, atlas, geo, gmap, meta })

        // Set initial year range from data
        const anos = [...new Set(crim.map(r => r.ano))].sort((a, b) => a - b)
        if (anos.length > 0) {
          setFiltrosState(f => ({ ...f, anoInicio: anos[0], anoFim: anos[anos.length - 1] }))
        }
      } catch (e) {
        if (!cancelled) setErro(e.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  // Derived: list of years
  const anos = useMemo(() => {
    if (!raw) return []
    return [...new Set(raw.crim.map(r => r.ano))].sort((a, b) => a - b)
  }, [raw])

  // Derived: geo lookup (cod_ibge -> {municipio, mesorregiao})
  const geoLookup = useMemo(() => {
    if (!raw?.gmap) return {}
    const map = {}
    for (const r of raw.gmap) {
      map[r.cod_ibge] = r
    }
    return map
  }, [raw])

  // Derived: list of mesorregioes
  const mesorregioes = useMemo(() => {
    if (!raw?.gmap) return []
    return [...new Set(raw.gmap.map(r => r.mesorregiao))].sort()
  }, [raw])

  // Derived: list of municipios (filtered by mesorregiao)
  const municipios = useMemo(() => {
    if (!raw?.gmap) return []
    let list = raw.gmap.map(r => ({ cod: r.cod_ibge, nome: r.municipio, mesorregiao: r.mesorregiao }))
    if (filtros.mesorregiao !== 'todas') {
      list = list.filter(m => m.mesorregiao === filtros.mesorregiao)
    }
    return list.sort((a, b) => a.nome.localeCompare(b.nome))
  }, [raw, filtros.mesorregiao])

  // Filtered data
  const dadosFiltrados = useMemo(() => {
    if (!raw) return null

    // Filter criminalidade (municipal array)
    let crim = raw.crim
    if (filtros.anoInicio) crim = crim.filter(r => r.ano >= filtros.anoInicio)
    if (filtros.anoFim) crim = crim.filter(r => r.ano <= filtros.anoFim)
    if (filtros.mesorregiao !== 'todas') {
      const codsMeso = new Set(
        raw.gmap.filter(g => g.mesorregiao === filtros.mesorregiao).map(g => g.cod_ibge)
      )
      crim = crim.filter(r => codsMeso.has(r.cod_ibge))
    }
    if (filtros.municipio !== 'todos') {
      crim = crim.filter(r => String(r.cod_ibge) === String(filtros.municipio))
    }

    // Filter UF-level data by year
    let vl = raw.vl
    let pat = raw.pat
    if (filtros.anoInicio) {
      vl = vl.filter(r => r.ano >= filtros.anoInicio)
      pat = pat.filter(r => r.ano >= filtros.anoInicio)
    }
    if (filtros.anoFim) {
      vl = vl.filter(r => r.ano <= filtros.anoFim)
      pat = pat.filter(r => r.ano <= filtros.anoFim)
    }

    // Aggregate criminalidade by municipality x year
    const munAno = {}
    for (const r of crim) {
      const key = `${r.cod_ibge}_${r.ano}`
      if (!munAno[key]) munAno[key] = { cod_ibge: r.cod_ibge, municipio: r.municipio, ano: r.ano, vitimas: 0 }
      munAno[key].vitimas += r.vitimas
    }
    const crimAnual = Object.values(munAno)

    // Aggregate estado by year
    const estadoAno = {}
    for (const r of crim) {
      if (!estadoAno[r.ano]) estadoAno[r.ano] = { ano: r.ano, vitimas: 0 }
      estadoAno[r.ano].vitimas += r.vitimas
    }
    const estadoAnual = Object.values(estadoAno).sort((a, b) => a.ano - b.ano)

    // Aggregate UF by year
    const vlAnual = {}
    for (const r of vl) {
      if (!vlAnual[r.ano]) vlAnual[r.ano] = { ano: r.ano }
      vlAnual[r.ano][r.tipo_crime] = (vlAnual[r.ano][r.tipo_crime] || 0) + r.ocorrencias
    }
    const vlEstado = Object.values(vlAnual).sort((a, b) => a.ano - b.ano)

    const patAnual = {}
    for (const r of pat) {
      if (!patAnual[r.ano]) patAnual[r.ano] = { ano: r.ano }
      patAnual[r.ano][r.tipo_crime] = (patAnual[r.ano][r.tipo_crime] || 0) + r.ocorrencias
    }
    const patEstado = Object.values(patAnual).sort((a, b) => a.ano - b.ano)

    return {
      criminalidade: {
        rows: crim,
        anual: crimAnual,
        estado: estadoAnual,
      },
      violenciaLetal: {
        rows: vl,
        estado: vlEstado,
      },
      patrimonio: {
        rows: pat,
        estado: patEstado,
      },
      drogas: raw.drug,
    }
  }, [raw, filtros])

  const setFiltros = useCallback((updates) => {
    setFiltrosState(f => ({ ...f, ...updates }))
  }, [])

  return {
    loading,
    erro,
    // Raw data for specific components
    serieHistorica: raw?.serie || null,
    atlasViolencia: raw?.atlas || null,
    geoData: raw?.geo || null,
    geoLookup,
    metadata: raw?.meta || null,
    // Filters
    filtros,
    setFiltros,
    anos,
    mesorregioes,
    municipios,
    // Filtered + aggregated
    dadosFiltrados,
  }
}
