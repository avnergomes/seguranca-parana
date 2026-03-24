import { useState, useEffect, useMemo, useCallback } from 'react'

const BASE = import.meta.env.BASE_URL + 'data/'

async function fetchJson(path) {
  const res = await fetch(BASE + path)
  if (!res.ok) throw new Error(`Falha ao carregar ${path}: ${res.status}`)
  return res.json()
}

export function useData() {
  const [criminalidade, setCriminalidade] = useState(null)
  const [violenciaLetal, setViolenciaLetal] = useState(null)
  const [patrimonio, setPatrimonio] = useState(null)
  const [drogas, setDrogas] = useState(null)
  const [serieHistorica, setSerieHistorica] = useState(null)
  const [atlasViolencia, setAtlasViolencia] = useState(null)
  const [geoData, setGeoData] = useState(null)
  const [geoMap, setGeoMap] = useState(null)
  const [metadata, setMetadata] = useState(null)
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
        setCriminalidade(crim)
        setViolenciaLetal(vl)
        setPatrimonio(pat)
        setDrogas(drug)
        setSerieHistorica(serie)
        setAtlasViolencia(atlas)
        setGeoData(geo)
        setGeoMap(gmap)
        setMetadata(meta)

        const anos = crim?.anos || []
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

  const anos = useMemo(() => criminalidade?.anos || [], [criminalidade])

  const mesorregioes = useMemo(() => {
    if (!geoMap) return []
    const set = new Set(Object.values(geoMap).map(m => m.mesorregiao))
    return [...set].sort()
  }, [geoMap])

  const municipios = useMemo(() => {
    if (!geoMap) return []
    let list = Object.entries(geoMap).map(([cod, info]) => ({
      cod, nome: info.municipio, mesorregiao: info.mesorregiao,
    }))
    if (filtros.mesorregiao !== 'todas') {
      list = list.filter(m => m.mesorregiao === filtros.mesorregiao)
    }
    return list.sort((a, b) => a.nome.localeCompare(b.nome))
  }, [geoMap, filtros.mesorregiao])

  const dadosFiltrados = useMemo(() => {
    if (!criminalidade) return null

    const filtrarMunicipios = (dataset) => {
      if (!dataset?.municipios) return dataset
      let munsFiltered = { ...dataset.municipios }

      if (filtros.mesorregiao !== 'todas' && geoMap) {
        const codsMeso = new Set(
          Object.entries(geoMap)
            .filter(([, info]) => info.mesorregiao === filtros.mesorregiao)
            .map(([cod]) => cod)
        )
        munsFiltered = Object.fromEntries(
          Object.entries(munsFiltered).filter(([cod]) => codsMeso.has(cod))
        )
      }

      if (filtros.municipio !== 'todos') {
        munsFiltered = Object.fromEntries(
          Object.entries(munsFiltered).filter(([cod]) => cod === filtros.municipio)
        )
      }

      if (filtros.anoInicio && filtros.anoFim) {
        const newMuns = {}
        for (const [cod, mun] of Object.entries(munsFiltered)) {
          const dadosFilt = {}
          for (const [anoStr, dados] of Object.entries(mun.dados || {})) {
            const ano = parseInt(anoStr)
            if (ano >= filtros.anoInicio && ano <= filtros.anoFim) {
              dadosFilt[anoStr] = dados
            }
          }
          newMuns[cod] = { ...mun, dados: dadosFilt }
        }
        munsFiltered = newMuns
      }

      return { ...dataset, municipios: munsFiltered }
    }

    return {
      criminalidade: filtrarMunicipios(criminalidade),
      violenciaLetal: filtrarMunicipios(violenciaLetal),
      patrimonio: filtrarMunicipios(patrimonio),
      drogas: filtrarMunicipios(drogas),
    }
  }, [criminalidade, violenciaLetal, patrimonio, drogas, geoMap, filtros])

  const setFiltros = useCallback((updates) => {
    setFiltrosState(f => ({ ...f, ...updates }))
  }, [])

  return {
    loading,
    erro,
    criminalidade,
    violenciaLetal,
    patrimonio,
    drogas,
    serieHistorica,
    atlasViolencia,
    geoData,
    geoMap,
    metadata,
    filtros,
    setFiltros,
    anos,
    mesorregioes,
    municipios,
    dadosFiltrados,
  }
}
