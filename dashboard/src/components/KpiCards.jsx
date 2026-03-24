import React, { useMemo } from 'react'
import { Users, Crosshair, Target, Car, Truck, Skull } from 'lucide-react'
import { formatNumber, formatVariacao } from '../utils/format'

function getValor(items, ...keywords) {
  if (!items || !Array.isArray(items)) return null
  const normalized = keywords.map((k) => k.toLowerCase())
  return items.find((item) => {
    const key = (item.tipo_crime || item.natureza || item.indicador || '').toLowerCase()
    return normalized.some((kw) => key.includes(kw))
  })
}

function KpiCard({ titulo, valor, variacao, icon: Icon, iconBg, iconColor }) {
  const varInfo = formatVariacao(variacao)

  return (
    <div className="card flex items-start gap-4">
      <div className={`flex items-center justify-center w-11 h-11 rounded-lg ${iconBg}`}>
        <Icon className={`w-5 h-5 ${iconColor}`} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-dark-400 truncate">{titulo}</p>
        <p className="text-2xl font-display font-bold text-dark-900 mt-0.5">
          {formatNumber(valor)}
        </p>
        {variacao != null && !isNaN(variacao) && (
          <p className={`text-xs font-medium mt-1 ${varInfo.color}`}>
            {varInfo.text} vs ano anterior
          </p>
        )}
      </div>
    </div>
  )
}

function KpiCards({ dados, violenciaLetal, patrimonio }) {
  const kpis = useMemo(() => {
    const estadoData = dados?.estado || {}
    const vlMunicipios = violenciaLetal?.municipios || []
    const patMunicipios = patrimonio?.municipios || []

    // Get most recent year data
    const vlAtual = vlMunicipios.length > 0
      ? vlMunicipios
      : []
    const patAtual = patMunicipios.length > 0
      ? patMunicipios
      : []

    const vitimasTotal = estadoData.total_vitimas || estadoData.vitimas || null
    const vitimasVar = estadoData.variacao_vitimas || null

    const homicidio = getValor(vlAtual, 'homic')
    const tentativa = getValor(vlAtual, 'tentativa')
    const latrocinio = getValor(vlAtual, 'latroc', 'morte')
    const rouboVeic = getValor(patAtual, 'roubo de ve')
    const furtoVeic = getValor(patAtual, 'furto')

    return [
      {
        titulo: 'Vitimas Totais',
        valor: vitimasTotal,
        variacao: vitimasVar,
        icon: Users,
        iconBg: 'bg-alert-100',
        iconColor: 'text-alert-600',
      },
      {
        titulo: 'Homicidios Dolosos',
        valor: homicidio?.total || homicidio?.ocorrencias || null,
        variacao: homicidio?.variacao || null,
        icon: Crosshair,
        iconBg: 'bg-danger-100',
        iconColor: 'text-danger-600',
      },
      {
        titulo: 'Tentativas de Homicidio',
        valor: tentativa?.total || tentativa?.ocorrencias || null,
        variacao: tentativa?.variacao || null,
        icon: Target,
        iconBg: 'bg-amber-100',
        iconColor: 'text-amber-600',
      },
      {
        titulo: 'Roubos de Veiculos',
        valor: rouboVeic?.total || rouboVeic?.ocorrencias || null,
        variacao: rouboVeic?.variacao || null,
        icon: Car,
        iconBg: 'bg-secondary-100',
        iconColor: 'text-secondary-600',
      },
      {
        titulo: 'Furtos de Veiculos',
        valor: furtoVeic?.total || furtoVeic?.ocorrencias || null,
        variacao: furtoVeic?.variacao || null,
        icon: Truck,
        iconBg: 'bg-water-100',
        iconColor: 'text-water-600',
      },
      {
        titulo: 'Latrocinios',
        valor: latrocinio?.total || latrocinio?.ocorrencias || null,
        variacao: latrocinio?.variacao || null,
        icon: Skull,
        iconBg: 'bg-danger-100',
        iconColor: 'text-danger-700',
      },
    ]
  }, [dados, violenciaLetal, patrimonio])

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
      {kpis.map((kpi) => (
        <KpiCard key={kpi.titulo} {...kpi} />
      ))}
    </div>
  )
}

export default KpiCards
