import React, { useMemo } from 'react'
import { MapContainer, TileLayer, GeoJSON } from 'react-leaflet'
import { getMapColor, calcBreaks, formatNumber, formatTaxa } from '../utils/format'

const PARANA_CENTER = [-24.89, -51.55]
const PARANA_ZOOM = 7

const TILE_URL = 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png'
const TILE_ATTR = '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>'

function Legend({ breaks }) {
  const colors = ['#fff7ed', '#ffedd5', '#fed7aa', '#fdba74', '#fb923c', '#f97316', '#ea580c', '#c2410c', '#9a3412']

  return (
    <div className="absolute bottom-4 right-4 bg-white rounded-lg shadow-card p-3 z-[1000] text-xs">
      <p className="font-semibold text-dark-700 mb-1.5">Taxa por 100k hab.</p>
      <div className="flex flex-col gap-0.5">
        {breaks.map((brk, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <span
              className="w-4 h-3 rounded-sm inline-block"
              style={{ backgroundColor: colors[i] }}
            />
            <span className="text-dark-500">{formatTaxa(brk)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function MapChart({ geojson, dados, indicador = 'vitimas' }) {
  const { breaks, dataMap } = useMemo(() => {
    if (!dados || !geojson) return { breaks: [], dataMap: {} }

    const municipios = dados.municipios || []
    const map = {}
    municipios.forEach((m) => {
      const key = (m.municipio || '').toUpperCase()
      const value = m.taxa_100k ?? m.taxa ?? m.ocorrencias ?? 0
      if (!map[key] || value > map[key].value) {
        map[key] = { ...m, value }
      }
    })

    const values = Object.values(map).map((m) => m.value)
    return { breaks: calcBreaks(values), dataMap: map }
  }, [dados, geojson])

  const style = (feature) => {
    const name = (feature.properties?.NM_MUN || feature.properties?.name || '').toUpperCase()
    const entry = dataMap[name]
    const value = entry?.value ?? null

    return {
      fillColor: getMapColor(value, breaks),
      weight: 1,
      opacity: 1,
      color: '#d1d1d6',
      fillOpacity: 0.8,
    }
  }

  const onEachFeature = (feature, layer) => {
    const name = feature.properties?.NM_MUN || feature.properties?.name || 'Desconhecido'
    const meso = feature.properties?.NM_MESO || feature.properties?.mesorregiao || ''
    const entry = dataMap[name.toUpperCase()]
    const valor = entry ? formatNumber(entry.value) : '-'

    layer.bindTooltip(
      `<strong>${name}</strong>${meso ? `<br/><span style="color:#737378">${meso}</span>` : ''}<br/>Valor: ${valor}`,
      { sticky: true }
    )

    layer.on({
      mouseover: (e) => {
        e.target.setStyle({
          weight: 2,
          color: '#ea580c',
          fillOpacity: 0.9,
        })
      },
      mouseout: (e) => {
        e.target.setStyle(style(feature))
      },
    })
  }

  if (!geojson) {
    return (
      <div className="card h-96 flex items-center justify-center text-dark-400 text-sm">
        Carregando mapa...
      </div>
    )
  }

  return (
    <div className="card p-0 overflow-hidden relative">
      <MapContainer
        center={PARANA_CENTER}
        zoom={PARANA_ZOOM}
        className="h-96 w-full rounded-xl"
        scrollWheelZoom={false}
      >
        <TileLayer url={TILE_URL} attribution={TILE_ATTR} />
        <GeoJSON
          key={JSON.stringify(breaks)}
          data={geojson}
          style={style}
          onEachFeature={onEachFeature}
        />
      </MapContainer>
      {breaks.length > 0 && <Legend breaks={breaks} />}
    </div>
  )
}

export default MapChart
