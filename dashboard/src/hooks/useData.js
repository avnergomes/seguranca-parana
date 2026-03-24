import { useState, useEffect, useMemo, useCallback } from 'react'

const BASE = import.meta.env.BASE_URL + 'data/'

async function fetchJson(path) {
  const res = await fetch(BASE + path)
  if (!res.ok) throw new Error(`Falha ao carregar ${path}: ${res.status}`)
  return res.json()
}

export function useData() {
  const [raw, setRaw] = useState(null)
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState(null)

  const [filtros, setFiltrosState] = useState({
    anoInicio: null,
    anoFim: null,
    mesorregiao: 'todas',
    regional: 'todas',
    municipio: 'todos',
  })

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const [crim, vl, pat, vitSexo, drug, serie, atlas, geo, meta] = await Promise.all([
          fetchJson('criminalidade.json'),
          fetchJson('violencia_letal.json'),
          fetchJson('patrimonio.json'),
          fetchJson('vitimas_sexo.json'),
          fetchJson('drogas.json'),
          fetchJson('serie_historica.json'),
          fetchJson('atlas_violencia.json'),
          fetchJson('municipios.geojson'),
          fetchJson('metadata.json'),
        ])
        if (cancelled) return
        setRaw({ crim, vl, pat, vitSexo, drug, serie, atlas, geo, meta })
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

  // GeoJSON-derived lookup
  const geoLookup = useMemo(() => {
    if (!raw?.geo?.features) return {}
    const m = {}
    for (const f of raw.geo.features) {
      const p = f.properties
      m[p.CodIbge] = { cod_ibge: p.CodIbge, municipio: p.Municipio, mesorregiao: p.MesoIdr, regional: p.RegIdr }
    }
    return m
  }, [raw])

  const anos = useMemo(() => {
    if (!raw) return []
    return [...new Set(raw.crim.map(r => r.ano))].sort((a, b) => a - b)
  }, [raw])

  const mesorregioes = useMemo(() => {
    if (!raw?.geo?.features) return []
    return [...new Set(raw.geo.features.map(f => f.properties.MesoIdr))].sort()
  }, [raw])

  const regionais = useMemo(() => {
    if (!raw?.geo?.features) return []
    let feats = raw.geo.features
    if (filtros.mesorregiao !== 'todas') feats = feats.filter(f => f.properties.MesoIdr === filtros.mesorregiao)
    return [...new Set(feats.map(f => f.properties.RegIdr))].sort()
  }, [raw, filtros.mesorregiao])

  const municipios = useMemo(() => {
    if (!raw?.geo?.features) return []
    let feats = raw.geo.features
    if (filtros.mesorregiao !== 'todas') feats = feats.filter(f => f.properties.MesoIdr === filtros.mesorregiao)
    if (filtros.regional !== 'todas') feats = feats.filter(f => f.properties.RegIdr === filtros.regional)
    return feats.map(f => ({ cod: f.properties.CodIbge, nome: f.properties.Municipio })).sort((a, b) => a.nome.localeCompare(b.nome))
  }, [raw, filtros.mesorregiao, filtros.regional])

  // Filtered cod set (null = no geographic filter)
  const filteredCods = useMemo(() => {
    if (!raw?.geo?.features) return null
    if (filtros.mesorregiao === 'todas' && filtros.regional === 'todas' && filtros.municipio === 'todos') return null
    let feats = raw.geo.features
    if (filtros.mesorregiao !== 'todas') feats = feats.filter(f => f.properties.MesoIdr === filtros.mesorregiao)
    if (filtros.regional !== 'todas') feats = feats.filter(f => f.properties.RegIdr === filtros.regional)
    if (filtros.municipio !== 'todos') feats = feats.filter(f => f.properties.CodIbge === filtros.municipio)
    return new Set(feats.map(f => Number(f.properties.CodIbge)))
  }, [raw, filtros])

  // Year filter helper
  const inYear = useCallback((ano) => {
    if (filtros.anoInicio && ano < filtros.anoInicio) return false
    if (filtros.anoFim && ano > filtros.anoFim) return false
    return true
  }, [filtros.anoInicio, filtros.anoFim])

  // ALL filtered datasets
  const dadosFiltrados = useMemo(() => {
    if (!raw) return null

    // Municipal data filtered by year + geography
    const crim = raw.crim.filter(r => inYear(r.ano) && (!filteredCods || filteredCods.has(r.cod_ibge)))

    // UF data filtered by year only (no geographic breakdown at UF level)
    const vl = raw.vl.filter(r => inYear(r.ano))
    const pat = raw.pat.filter(r => inYear(r.ano))
    const vitSexo = raw.vitSexo.filter(r => inYear(r.ano))

    // Aggregate municipal -> by municipality × year
    const munAno = {}
    for (const r of crim) {
      const key = `${r.cod_ibge}_${r.ano}`
      if (!munAno[key]) munAno[key] = { cod_ibge: r.cod_ibge, municipio: r.municipio, ano: r.ano, vitimas: 0 }
      munAno[key].vitimas += r.vitimas
    }

    // Aggregate municipal -> estado by year
    const estadoAno = {}
    for (const r of crim) {
      if (!estadoAno[r.ano]) estadoAno[r.ano] = { ano: r.ano, vitimas: 0 }
      estadoAno[r.ano].vitimas += r.vitimas
    }

    // Aggregate UF ocorrencias by year (pivoted: one row per year with all crime types as columns)
    const vlByYear = {}
    for (const r of vl) {
      if (!vlByYear[r.ano]) vlByYear[r.ano] = { ano: r.ano }
      vlByYear[r.ano][r.tipo_crime] = (vlByYear[r.ano][r.tipo_crime] || 0) + r.ocorrencias
    }
    const patByYear = {}
    for (const r of pat) {
      if (!patByYear[r.ano]) patByYear[r.ano] = { ano: r.ano }
      patByYear[r.ano][r.tipo_crime] = (patByYear[r.ano][r.tipo_crime] || 0) + r.ocorrencias
    }

    // Vitimas by sex, pivoted by year
    const vitSexoByYear = {}
    for (const r of vitSexo) {
      if (!vitSexoByYear[r.ano]) vitSexoByYear[r.ano] = { ano: r.ano }
      const key = `${r.tipo_crime} (${r.sexo})`
      vitSexoByYear[r.ano][key] = (vitSexoByYear[r.ano][key] || 0) + r.vitimas
    }

    return {
      criminalidade: {
        rows: crim,
        anual: Object.values(munAno),
        estado: Object.values(estadoAno).sort((a, b) => a.ano - b.ano),
      },
      violenciaLetal: {
        rows: vl,
        estado: Object.values(vlByYear).sort((a, b) => a.ano - b.ano),
      },
      patrimonio: {
        rows: pat,
        estado: Object.values(patByYear).sort((a, b) => a.ano - b.ano),
      },
      vitimasSexo: {
        rows: vitSexo,
        estado: Object.values(vitSexoByYear).sort((a, b) => a.ano - b.ano),
      },
      drogas: raw.drug,
    }
  }, [raw, inYear, filteredCods])

  const setFiltros = useCallback((updates) => {
    setFiltrosState(f => {
      const next = { ...f, ...updates }
      if (updates.mesorregiao !== undefined) { next.regional = 'todas'; next.municipio = 'todos' }
      if (updates.regional !== undefined) { next.municipio = 'todos' }
      return next
    })
  }, [])

  return {
    loading, erro,
    serieHistorica: raw?.serie || null,
    atlasViolencia: raw?.atlas || null,
    geoData: raw?.geo || null,
    geoLookup,
    metadata: raw?.meta || null,
    filtros, setFiltros,
    anos, mesorregioes, regionais, municipios,
    dadosFiltrados,
  }
}
