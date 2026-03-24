const brLocale = 'pt-BR'

export function formatNumber(value) {
  if (value == null || isNaN(value)) return '-'
  return new Intl.NumberFormat(brLocale).format(value)
}

export function formatTaxa(value) {
  if (value == null || isNaN(value)) return '-'
  return new Intl.NumberFormat(brLocale, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value)
}

export function formatVariacao(value) {
  if (value == null || isNaN(value)) return { text: '-', color: '' }
  const sign = value > 0 ? '+' : ''
  const text = `${sign}${formatTaxa(value)}%`
  // For crime stats: increase (positive) is bad (danger), decrease (negative) is good (emerald)
  const color = value > 0 ? 'text-danger-600' : value < 0 ? 'text-emerald-600' : 'text-dark-400'
  return { text, color }
}

export function formatDate(dateStr) {
  if (!dateStr) return '-'
  try {
    const date = new Date(dateStr)
    return new Intl.DateTimeFormat(brLocale, {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(date)
  } catch {
    return dateStr
  }
}

export function formatPeso(value) {
  if (value == null || isNaN(value)) return '-'
  if (value >= 1000) {
    return `${formatTaxa(value / 1000)} kg`
  }
  return `${formatTaxa(value)} g`
}

export function formatCompacto(value) {
  if (value == null || isNaN(value)) return '-'
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(1)}K`
  }
  return String(value)
}

export function nomeMes(mes) {
  const meses = [
    'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
    'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez',
  ]
  return meses[(mes - 1)] || '-'
}

export function getHeatColor(value, min, max) {
  if (value == null || isNaN(value)) return '#f5f5f7'
  const ratio = max === min ? 0 : (value - min) / (max - min)
  // From neutral to danger
  const colors = ['#fff7ed', '#fed7aa', '#fb923c', '#ea580c', '#9a3412']
  const idx = Math.min(Math.floor(ratio * (colors.length - 1)), colors.length - 2)
  return colors[Math.round(ratio * (colors.length - 1))]
}

export function getMapColor(value, breaks) {
  if (value == null || isNaN(value)) return '#f5f5f7'
  const colors = ['#fff7ed', '#ffedd5', '#fed7aa', '#fdba74', '#fb923c', '#f97316', '#ea580c', '#c2410c', '#9a3412']
  for (let i = 0; i < breaks.length; i++) {
    if (value <= breaks[i]) return colors[i]
  }
  return colors[colors.length - 1]
}

export function calcBreaks(values, numClasses = 8) {
  const sorted = values.filter((v) => v != null && !isNaN(v)).sort((a, b) => a - b)
  if (sorted.length === 0) return []
  const breaks = []
  for (let i = 1; i <= numClasses; i++) {
    const idx = Math.floor((i / numClasses) * (sorted.length - 1))
    breaks.push(sorted[idx])
  }
  return breaks
}
