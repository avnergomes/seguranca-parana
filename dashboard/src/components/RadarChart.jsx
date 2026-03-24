import React, { useMemo } from 'react'
import {
  Radar,
  RadarChart as RechartsRadar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Legend,
  Tooltip,
} from 'recharts'
import { formatNumber } from '../utils/format'

function RadarChart({ dados, dadosEstado, municipioSelecionado, titulo, className = '' }) {
  const chartData = useMemo(() => {
    if (!dados || !Array.isArray(dados)) return []

    // Get municipal data
    const munData = municipioSelecionado
      ? dados.filter((d) => d.municipio === municipioSelecionado)
      : []

    // Get state averages
    const estadoData = dadosEstado || []

    // Build radar axes from crime types
    const crimeTypes = new Set()
    ;[...munData, ...estadoData].forEach((d) => {
      const tipo = d.tipo_crime || d.natureza || d.indicador
      if (tipo) crimeTypes.add(tipo)
    })

    if (crimeTypes.size === 0) return []

    const munByType = {}
    munData.forEach((d) => {
      const tipo = d.tipo_crime || d.natureza || d.indicador
      if (tipo) {
        munByType[tipo] = (munByType[tipo] || 0) + (d.taxa_100k ?? d.taxa ?? d.ocorrencias ?? 0)
      }
    })

    const estadoByType = {}
    estadoData.forEach((d) => {
      const tipo = d.tipo_crime || d.natureza || d.indicador
      if (tipo) {
        estadoByType[tipo] = (estadoByType[tipo] || 0) + (d.taxa_100k ?? d.taxa ?? d.ocorrencias ?? 0)
      }
    })

    return [...crimeTypes].map((tipo) => ({
      crime: tipo.length > 18 ? tipo.slice(0, 18) + '...' : tipo,
      municipio: munByType[tipo] || 0,
      estado: estadoByType[tipo] || 0,
    }))
  }, [dados, dadosEstado, municipioSelecionado])

  if (chartData.length === 0) {
    return (
      <div className={`card flex items-center justify-center h-64 text-dark-400 text-sm ${className}`}>
        {municipioSelecionado
          ? 'Sem dados para o municipio selecionado'
          : 'Selecione um municipio para comparar'}
      </div>
    )
  }

  return (
    <div className={`card ${className}`}>
      {titulo && <h3 className="section-title">{titulo}</h3>}
      <ResponsiveContainer width="100%" height={350}>
        <RechartsRadar data={chartData}>
          <PolarGrid stroke="#e5e5e9" />
          <PolarAngleAxis
            dataKey="crime"
            tick={{ fontSize: 10, fill: '#737378' }}
          />
          <PolarRadiusAxis
            tick={{ fontSize: 9, fill: '#a3a3ab' }}
            axisLine={false}
          />
          <Tooltip
            formatter={(value) => formatNumber(value)}
            contentStyle={{
              borderRadius: '0.5rem',
              border: '1px solid #e5e5e9',
              fontSize: '0.875rem',
            }}
          />
          <Legend wrapperStyle={{ fontSize: '0.75rem' }} />
          <Radar
            name={municipioSelecionado || 'Municipio'}
            dataKey="municipio"
            stroke="#ea580c"
            fill="#ea580c"
            fillOpacity={0.3}
          />
          <Radar
            name="Media Estadual"
            dataKey="estado"
            stroke="#14b8a6"
            fill="#14b8a6"
            fillOpacity={0.15}
          />
        </RechartsRadar>
      </ResponsiveContainer>
    </div>
  )
}

export default RadarChart
