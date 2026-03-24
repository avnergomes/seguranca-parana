import React, { useMemo } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { formatNumber } from '../utils/format'

const COLOR_PALETTE = [
  '#ea580c', '#f97316', '#fb923c',
  '#14b8a6', '#0d9488', '#0f766e',
  '#6366f1', '#4f46e5',
  '#0ea5e9', '#f59e0b',
]

function TimeSeriesChart({ dados, titulo, xKey = 'ano', className = '' }) {
  const { chartData, series } = useMemo(() => {
    if (!dados || !Array.isArray(dados) || dados.length === 0) {
      return { chartData: [], series: [] }
    }

    // Auto-detect numeric series keys (exclude xKey and string fields)
    const sample = dados[0]
    const seriesKeys = Object.keys(sample).filter((k) => {
      if (k === xKey) return false
      if (['municipio', 'mesorregiao', 'tipo_crime', 'natureza', 'indicador'].includes(k)) return false
      return typeof sample[k] === 'number'
    })

    // If data has tipo_crime field, pivot to separate series
    if (sample.tipo_crime && sample[xKey] != null) {
      const groups = {}
      const types = new Set()
      dados.forEach((d) => {
        const x = d[xKey]
        if (!groups[x]) groups[x] = { [xKey]: x }
        const tipo = d.tipo_crime
        types.add(tipo)
        groups[x][tipo] = (groups[x][tipo] || 0) + (d.total || d.ocorrencias || d.vitimas || 0)
      })

      const pivoted = Object.values(groups).sort((a, b) => a[xKey] - b[xKey])
      return { chartData: pivoted, series: [...types] }
    }

    return {
      chartData: [...dados].sort((a, b) => (a[xKey] || 0) - (b[xKey] || 0)),
      series: seriesKeys,
    }
  }, [dados, xKey])

  if (chartData.length === 0) {
    return (
      <div className={`card flex items-center justify-center h-64 text-dark-400 text-sm ${className}`}>
        Sem dados para exibir
      </div>
    )
  }

  return (
    <div className={`card ${className}`}>
      {titulo && <h3 className="section-title">{titulo}</h3>}
      <ResponsiveContainer width="100%" height={320}>
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e9" />
          <XAxis
            dataKey={xKey}
            tick={{ fontSize: 12, fill: '#737378' }}
            axisLine={{ stroke: '#d1d1d6' }}
          />
          <YAxis
            tick={{ fontSize: 12, fill: '#737378' }}
            axisLine={{ stroke: '#d1d1d6' }}
            tickFormatter={formatNumber}
          />
          <Tooltip
            formatter={(value) => formatNumber(value)}
            contentStyle={{
              borderRadius: '0.5rem',
              border: '1px solid #e5e5e9',
              boxShadow: '0 2px 15px -3px rgba(0,0,0,0.07)',
              fontSize: '0.875rem',
            }}
          />
          <Legend wrapperStyle={{ fontSize: '0.75rem' }} />
          {series.map((key, i) => (
            <Line
              key={key}
              type="monotone"
              dataKey={key}
              name={key}
              stroke={COLOR_PALETTE[i % COLOR_PALETTE.length]}
              strokeWidth={2}
              dot={{ r: 3 }}
              activeDot={{ r: 5 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

export default TimeSeriesChart
