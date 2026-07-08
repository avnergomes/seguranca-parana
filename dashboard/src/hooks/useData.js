import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { feature } from 'topojson-client'

const BASE = import.meta.env.BASE_URL + 'data/'
// Malha reduzida self-hosted (749 KB) como primaria; CDN externo (4,4 MB) como
// fallback. Mesmas propriedades e object key 'municipalities' nas duas fontes.
const TOPO_URL = 'https://datageoparana.github.io/assets/parana-municipalities.min.topojson'
const TOPO_URL_FALLBACK = 'https://cdn.jsdelivr.net/gh/datageoparana/datageoparana.github.io@main/assets/parana-municipalities.topojson'

async function fetchJson(path) {
  const res = await fetch(BASE + path)
  if (!res.ok) throw new Error(`Falha ao carregar ${path}: ${res.status}`)
  return res.json()
}

async function fetchTopoFrom(url) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Falha ao carregar TopoJSON: ${res.status}`)
  const topo = await res.json()
  return feature(topo, topo.objects.municipalities)
}

// Tenta a malha primaria (self-hosted); em qualquer falha (rede ou res.ok false)
// tenta o fallback (CDN externo) antes de propagar o erro. Usado em TODOS os
// fetches do topojson (carga inicial e retry).
async function fetchTopo() {
  try {
    return await fetchTopoFrom(TOPO_URL)
  } catch {
    return await fetchTopoFrom(TOPO_URL_FALLBACK)
  }
}

export function useData() {
  const [raw, setRaw] = useState(null)
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState(null)

  // Malha municipal (topojson de CDN externo) fora do caminho critico:
  // falha do CDN nao derruba o painel, os dados locais continuam servindo.
  const [geo, setGeo] = useState(null)
  const [geoStatus, setGeoStatus] = useState('carregando') // 'carregando' | 'ok' | 'erro'
  const aliveRef = useRef(true)
  useEffect(() => {
    aliveRef.current = true
    return () => { aliveRef.current = false }
  }, [])

  const [filtros, setFiltrosState] = useState({
    anoInicio: null,
    anoFim: null,
    mesorregiao: 'todas',
    regional: 'todas',
    municipio: 'todos',
  })

  const loadTopo = useCallback(async () => {
    setGeoStatus('carregando')
    try {
      const g = await fetchTopo()
      if (!aliveRef.current) return
      setGeo(g)
      setGeoStatus('ok')
      // Selecoes feitas sobre as listas de fallback (malha IBGE local) podem
      // nao existir na malha IDR; volta meso/regional ao padrao e preserva o
      // municipio (o codigo IBGE e o mesmo nas duas fontes).
      setFiltrosState(f => (
        f.mesorregiao === 'todas' && f.regional === 'todas'
          ? f
          : { ...f, mesorregiao: 'todas', regional: 'todas' }
      ))
    } catch (e) {
      if (aliveRef.current) setGeoStatus('erro')
    }
  }, [])

  useEffect(() => { loadTopo() }, [loadTopo])

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const [crim, vl, pat, vitSexo, drug, serie, atlas, geoMap, meta] = await Promise.all([
          fetchJson('criminalidade.json'),
          fetchJson('violencia_letal.json'),
          fetchJson('patrimonio.json'),
          fetchJson('vitimas_sexo.json'),
          fetchJson('drogas.json'),
          fetchJson('serie_historica.json'),
          fetchJson('atlas_violencia.json'),
          fetchJson('geo_map.json'),
          fetchJson('metadata.json'),
        ])
        if (cancelled) return
        setRaw({ crim, vl, pat, vitSexo, drug, serie, atlas, geoMap, meta })
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

  // Atributos municipais unificados: topo (malha IDR) quando disponivel;
  // fallback tabular local (geo_map.json, malha IBGE, sem regionais IDR)
  // quando o CDN externo falha.
  const geoAttrs = useMemo(() => {
    if (geo?.features) {
      return geo.features.map(f => ({
        cod: f.properties.CodIbge,
        municipio: f.properties.Municipio,
        mesorregiao: f.properties.MesoIdr,
        regional: f.properties.RegIdr,
      }))
    }
    if (geoStatus === 'erro' && Array.isArray(raw?.geoMap)) {
      return raw.geoMap.map(m => ({
        cod: m.cod_ibge,
        municipio: m.municipio,
        mesorregiao: m.mesorregiao,
        regional: null,
      }))
    }
    return []
  }, [geo, geoStatus, raw])

  const geoLookup = useMemo(() => {
    const m = {}
    for (const a of geoAttrs) {
      m[a.cod] = { cod_ibge: a.cod, municipio: a.municipio, mesorregiao: a.mesorregiao, regional: a.regional }
    }
    return m
  }, [geoAttrs])

  const anos = useMemo(() => {
    if (!raw) return []
    return [...new Set(raw.crim.map(r => r.ano))].sort((a, b) => a - b)
  }, [raw])

  const mesorregioes = useMemo(() => {
    return [...new Set(geoAttrs.map(a => a.mesorregiao).filter(Boolean))].sort()
  }, [geoAttrs])

  const regionais = useMemo(() => {
    let feats = geoAttrs
    if (filtros.mesorregiao !== 'todas') feats = feats.filter(a => a.mesorregiao === filtros.mesorregiao)
    return [...new Set(feats.map(a => a.regional).filter(Boolean))].sort()
  }, [geoAttrs, filtros.mesorregiao])

  const municipios = useMemo(() => {
    let feats = geoAttrs
    if (filtros.mesorregiao !== 'todas') feats = feats.filter(a => a.mesorregiao === filtros.mesorregiao)
    if (filtros.regional !== 'todas') feats = feats.filter(a => a.regional === filtros.regional)
    return feats.map(a => ({ cod: a.cod, nome: a.municipio })).sort((x, y) => x.nome.localeCompare(y.nome))
  }, [geoAttrs, filtros.mesorregiao, filtros.regional])

  // Filtered cod set (null = no geographic filter)
  const filteredCods = useMemo(() => {
    if (geoAttrs.length === 0) return null
    if (filtros.mesorregiao === 'todas' && filtros.regional === 'todas' && filtros.municipio === 'todos') return null
    let feats = geoAttrs
    if (filtros.mesorregiao !== 'todas') feats = feats.filter(a => a.mesorregiao === filtros.mesorregiao)
    if (filtros.regional !== 'todas') feats = feats.filter(a => a.regional === filtros.regional)
    if (filtros.municipio !== 'todos') feats = feats.filter(a => String(a.cod) === String(filtros.municipio))
    return new Set(feats.map(a => Number(a.cod)))
  }, [geoAttrs, filtros])

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
    geoData: geo,
    geoStatus,
    retryTopo: loadTopo,
    geoLookup,
    metadata: raw?.meta || null,
    filtros, setFiltros,
    anos, mesorregioes, regionais, municipios,
    dadosFiltrados,
  }
}
