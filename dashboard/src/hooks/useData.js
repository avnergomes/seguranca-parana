import { useState, useEffect, useMemo, useCallback } from 'react'

const BASE = import.meta.env.BASE_URL + 'data/'

const INITIAL_FILTROS = {
  anoInicio: null,
  anoFim: null,
  mesorregiao: '',
  municipio: '',
  tipoCrime: '',
}

async function fetchJson(path) {
  const res = await fetch(BASE + path)
  if (!res.ok) throw new Error(`Falha ao carregar ${path}: ${res.status}`)
  return res.json()
}

export function useData() {
  const [dados, setDados] = useState({
    criminalidade: null,
    violenciaLetal: null,
    patrimonio: null,
    drogas: null,
    atlas: null,
    geojson: null,
    metadata: null,
  })
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState(null)
  const [filtros, setFiltros] = useState(INITIAL_FILTROS)

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const [
          criminalidade,
          violenciaLetal,
          patrimonio,
          drogas,
          atlas,
          geojson,
          metadata,
        ] = await Promise.all([
          fetchJson('criminalidade.json'),
          fetchJson('violencia_letal.json'),
          fetchJson('patrimonio.json'),
          fetchJson('drogas_armas.json'),
          fetchJson('atlas_temporal.json'),
          fetchJson('municipios.geojson'),
          fetchJson('metadata.json'),
        ])

        if (!cancelled) {
          setDados({ criminalidade, violenciaLetal, patrimonio, drogas, atlas, geojson, metadata })
          setLoading(false)
        }
      } catch (e) {
        if (!cancelled) {
          setErro(e.message)
          setLoading(false)
        }
      }
    }

    load()
    return () => { cancelled = true }
  }, [])

  const anos = useMemo(() => {
    if (!dados.criminalidade) return []
    const set = new Set()
    const municipios = dados.criminalidade.municipios || []
    municipios.forEach((m) => {
      if (m.ano) set.add(m.ano)
    })
    return [...set].sort((a, b) => a - b)
  }, [dados.criminalidade])

  const mesorregioes = useMemo(() => {
    if (!dados.criminalidade) return []
    const set = new Set()
    const municipios = dados.criminalidade.municipios || []
    municipios.forEach((m) => {
      if (m.mesorregiao) set.add(m.mesorregiao)
    })
    return [...set].sort()
  }, [dados.criminalidade])

  const municipios = useMemo(() => {
    if (!dados.criminalidade) return []
    const municipiosData = dados.criminalidade.municipios || []
    let filtered = municipiosData
    if (filtros.mesorregiao) {
      filtered = filtered.filter((m) => m.mesorregiao === filtros.mesorregiao)
    }
    const set = new Set()
    filtered.forEach((m) => {
      if (m.municipio) set.add(m.municipio)
    })
    return [...set].sort()
  }, [dados.criminalidade, filtros.mesorregiao])

  const dadosFiltrados = useMemo(() => {
    if (!dados.criminalidade) return null

    const filterArray = (arr) => {
      if (!arr) return []
      return arr.filter((item) => {
        if (filtros.anoInicio && item.ano && item.ano < filtros.anoInicio) return false
        if (filtros.anoFim && item.ano && item.ano > filtros.anoFim) return false
        if (filtros.mesorregiao && item.mesorregiao && item.mesorregiao !== filtros.mesorregiao) return false
        if (filtros.municipio && item.municipio && item.municipio !== filtros.municipio) return false
        if (filtros.tipoCrime && item.tipo_crime && item.tipo_crime !== filtros.tipoCrime) return false
        return true
      })
    }

    return {
      criminalidade: {
        ...dados.criminalidade,
        municipios: filterArray(dados.criminalidade.municipios),
      },
      violenciaLetal: {
        ...dados.violenciaLetal,
        municipios: filterArray(dados.violenciaLetal?.municipios),
      },
      patrimonio: {
        ...dados.patrimonio,
        municipios: filterArray(dados.patrimonio?.municipios),
      },
      drogas: {
        ...dados.drogas,
        municipios: filterArray(dados.drogas?.municipios),
      },
      atlas: dados.atlas,
      geojson: dados.geojson,
      metadata: dados.metadata,
    }
  }, [dados, filtros])

  const resetFiltros = useCallback(() => {
    setFiltros(INITIAL_FILTROS)
  }, [])

  return {
    loading,
    erro,
    dados,
    filtros,
    setFiltros,
    resetFiltros,
    anos,
    mesorregioes,
    municipios,
    dadosFiltrados,
  }
}
