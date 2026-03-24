import React from 'react'
import { Users, Crosshair, Target, Car, Truck, Skull } from 'lucide-react'
import { formatNumber } from '../utils/format'

function KpiCard({ titulo, valor, valorAnterior, icon: Icon, iconBg, iconColor }) {
  let varTexto = ''
  let varCor = ''
  if (valor != null && valorAnterior != null && valorAnterior > 0) {
    const pct = ((valor - valorAnterior) / valorAnterior) * 100
    varTexto = `${pct > 0 ? '+' : ''}${pct.toFixed(1)}%`
    // For crime: increase = bad (red), decrease = good (green)
    varCor = pct > 2 ? 'text-danger-600' : pct < -2 ? 'text-emerald-600' : 'text-dark-400'
  }

  return (
    <div className="card flex items-start gap-4">
      <div className={`flex items-center justify-center w-11 h-11 rounded-lg shrink-0 ${iconBg}`}>
        <Icon className={`w-5 h-5 ${iconColor}`} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-dark-400 truncate uppercase tracking-wide">{titulo}</p>
        <p className="text-2xl font-display font-bold text-dark-900 mt-0.5">
          {valor != null ? formatNumber(valor) : '-'}
        </p>
        {varTexto && (
          <p className={`text-xs font-medium mt-1 ${varCor}`}>
            {varTexto} vs ano anterior
          </p>
        )}
      </div>
    </div>
  )
}

/**
 * Props:
 *   estadoCrim: [{ano, vitimas}]
 *   estadoVl:   [{ano, "Homicídio doloso": N, "Tentativa de homicídio": N, ...}]
 *   estadoPat:  [{ano, "Roubo de veículo": N, "Furto de veículo": N, ...}]
 *   anoAtual:   number
 */
function KpiCards({ estadoCrim, estadoVl, estadoPat, anoAtual }) {
  const getByAno = (arr, ano) => (arr || []).find(r => r.ano === ano)
  const getByAnoPrev = (arr, ano) => (arr || []).find(r => r.ano === ano - 1)

  const crimAtual = getByAno(estadoCrim, anoAtual)
  const crimPrev = getByAnoPrev(estadoCrim, anoAtual)

  const vlAtual = getByAno(estadoVl, anoAtual)
  const vlPrev = getByAnoPrev(estadoVl, anoAtual)

  const patAtual = getByAno(estadoPat, anoAtual)
  const patPrev = getByAnoPrev(estadoPat, anoAtual)

  // Helper: sum values matching partial key
  const sumKeys = (obj, ...terms) => {
    if (!obj) return null
    let total = 0
    let found = false
    for (const [k, v] of Object.entries(obj)) {
      if (k === 'ano') continue
      const kl = k.toLowerCase()
      if (terms.some(t => kl.includes(t))) {
        total += v || 0
        found = true
      }
    }
    return found ? total : null
  }

  const kpis = [
    {
      titulo: 'Vitimas Totais',
      valor: crimAtual?.vitimas,
      valorAnterior: crimPrev?.vitimas,
      icon: Users,
      iconBg: 'bg-alert-100',
      iconColor: 'text-alert-600',
    },
    {
      titulo: 'Homicidios Dolosos',
      valor: sumKeys(vlAtual, 'homic'),
      valorAnterior: sumKeys(vlPrev, 'homic'),
      icon: Crosshair,
      iconBg: 'bg-danger-100',
      iconColor: 'text-danger-600',
    },
    {
      titulo: 'Tentativas Homicidio',
      valor: sumKeys(vlAtual, 'tentativa'),
      valorAnterior: sumKeys(vlPrev, 'tentativa'),
      icon: Target,
      iconBg: 'bg-amber-100',
      iconColor: 'text-amber-600',
    },
    {
      titulo: 'Roubos de Veiculos',
      valor: sumKeys(patAtual, 'roubo de ve'),
      valorAnterior: sumKeys(patPrev, 'roubo de ve'),
      icon: Car,
      iconBg: 'bg-secondary-100',
      iconColor: 'text-secondary-600',
    },
    {
      titulo: 'Furtos de Veiculos',
      valor: sumKeys(patAtual, 'furto'),
      valorAnterior: sumKeys(patPrev, 'furto'),
      icon: Truck,
      iconBg: 'bg-water-100',
      iconColor: 'text-water-600',
    },
    {
      titulo: 'Latrocinios',
      valor: sumKeys(vlAtual, 'latroc', 'morte'),
      valorAnterior: sumKeys(vlPrev, 'latroc', 'morte'),
      icon: Skull,
      iconBg: 'bg-danger-100',
      iconColor: 'text-danger-700',
    },
  ]

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
      {kpis.map((kpi) => (
        <KpiCard key={kpi.titulo} {...kpi} />
      ))}
    </div>
  )
}

export default KpiCards
