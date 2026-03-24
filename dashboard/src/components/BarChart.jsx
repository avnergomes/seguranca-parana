import React, { useMemo } from 'react'
import {
  BarChart as RechartsBarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts'
import { formatNumber } from '../utils/format'

const COLOR_PALETTE = [
  '#ea580c', '#f97316', '#fb923c', '#fdba74',
  '#14b8a6', '#0d9488', '#6366f1', '#4f46e5',
  '#0ea5e9', '#f59e0b',
]

function BarChart({ dados, titulo, topN = 10, horizontal = false, valueKey = 'ocorrencias', labelKey = 'municipio', className = '' }) {
  const chartData = useMemo(() => {
    if (!dados || !Array.isArray(dados)) return []

    const grouped = {}
    dados.forEach((d) => {
      const label = d[labelKey] || 'Outros'
      const value = d[valueKey] || d.total || d.ocorrencias || d.vitimas || 0
      grouped[label] = (grouped[label] || 0) + value
    })

    return Object.entries(grouped)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, topN)
  }, [dados, topN, valueKey, labelKey])

  if (chartData.length === 0) {
    return (
      <div className={`card flex items-center justify-center h-64 text-dark-400 text-sm ${className}`}>
        Sem dados para exibir
      </div>
    )
  }

  if (horizontal) {
    return (
      <div className={`card ${className}`}>
        {titulo && <h3 className="section-title">{titulo}</h3>}
        <ResponsiveContainer width="100%" height={Math.max(280, chartData.length * 36)}>
          <RechartsBarChart data={chartData} layout="vertical" margin={{ left: 100 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e9" horizontal={false} />
            <XAxis
              type="number"
              tick={{ fontSize: 11, fill: '#737378' }}
              tickFormatter={formatNumber}
            />
            <YAxis
              type="category"
              dataKey="name"
              tick={{ fontSize: 11, fill: '#737378' }}
              width={95}
            />
            <Tooltip
              formatter={(value) => formatNumber(value)}
              contentStyle={{
                borderRadius: '0.5rem',
                border: '1px solid #e5e5e9',
                fontSize: '0.875rem',
              }}
            />
            <Bar dataKey="value" name="Ocorrencias" radius={[0, 4, 4, 0]}>
              {chartData.map((_, i) => (
                <Cell key={i} fill={COLOR_PALETTE[i % COLOR_PALETTE.length]} />
              ))}
            </Bar>
          </RechartsBarChart>
        </ResponsiveContainer>
      </div>
    )
  }

  return (
    <div className={`card ${className}`}>
      {titulo && <h3 className="section-title">{titulo}</h3>}
      <ResponsiveContainer width="100%" height={320}>
        <RechartsBarChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e9" />
          <XAxis
            dataKey="name"
            tick={{ fontSize: 10, fill: '#737378' }}
            angle={-30}
            textAnchor="end"
            height={60}
          />
          <YAxis
            tick={{ fontSize: 11, fill: '#737378' }}
            tickFormatter={formatNumber}
          />
          <Tooltip
            formatter={(value) => formatNumber(value)}
            contentStyle={{
              borderRadius: '0.5rem',
              border: '1px solid #e5e5e9',
              fontSize: '0.875rem',
            }}
          />
          <Bar dataKey="value" name="Ocorrencias" radius={[4, 4, 0, 0]}>
            {chartData.map((_, i) => (
              <Cell key={i} fill={COLOR_PALETTE[i % COLOR_PALETTE.length]} />
            ))}
          </Bar>
        </RechartsBarChart>
      </ResponsiveContainer>
    </div>
  )
}

export default BarChart
