import React, { useMemo } from 'react'
import { Filter, X } from 'lucide-react'

const CRIME_TYPES_BY_TAB = {
  'visao-geral': [],
  'violencia-letal': ['Homicidio Doloso', 'Tentativa de Homicidio', 'Latrocinio', 'Morte por Interv. Policial'],
  'crimes-patrimoniais': ['Roubo de Veiculo', 'Furto de Veiculo', 'Roubo', 'Furto'],
  'drogas-armas': ['Trafico de Drogas', 'Posse de Drogas', 'Apreensao de Armas'],
  'serie-historica': [],
  'perfil-municipal': [],
}

function Filters({ filtros, setFiltros, anos, mesorregioes, municipios, activeTab }) {
  const tiposCrime = useMemo(() => {
    return CRIME_TYPES_BY_TAB[activeTab] || []
  }, [activeTab])

  const handleChange = (field, value) => {
    const updated = { ...filtros, [field]: value || (field === 'anoInicio' || field === 'anoFim' ? null : '') }
    // Reset dependent filters
    if (field === 'mesorregiao') {
      updated.municipio = ''
    }
    setFiltros(updated)
  }

  const activeFilters = []
  if (filtros.anoInicio) activeFilters.push({ key: 'anoInicio', label: `De: ${filtros.anoInicio}` })
  if (filtros.anoFim) activeFilters.push({ key: 'anoFim', label: `Ate: ${filtros.anoFim}` })
  if (filtros.mesorregiao) activeFilters.push({ key: 'mesorregiao', label: filtros.mesorregiao })
  if (filtros.municipio) activeFilters.push({ key: 'municipio', label: filtros.municipio })
  if (filtros.tipoCrime) activeFilters.push({ key: 'tipoCrime', label: filtros.tipoCrime })

  const removeFilter = (key) => {
    const resetValue = key === 'anoInicio' || key === 'anoFim' ? null : ''
    const updated = { ...filtros, [key]: resetValue }
    if (key === 'mesorregiao') updated.municipio = ''
    setFiltros(updated)
  }

  return (
    <div className="card">
      <div className="flex items-center gap-2 mb-3">
        <Filter className="w-4 h-4 text-alert-500" />
        <span className="text-sm font-semibold text-dark-700">Filtros</span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <select
          value={filtros.anoInicio || ''}
          onChange={(e) => handleChange('anoInicio', e.target.value ? Number(e.target.value) : null)}
          className="text-sm border border-neutral-200 rounded-lg px-3 py-2 bg-white focus:ring-2 focus:ring-alert-300 focus:border-alert-400 outline-none"
        >
          <option value="">Ano inicio</option>
          {anos.map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>

        <select
          value={filtros.anoFim || ''}
          onChange={(e) => handleChange('anoFim', e.target.value ? Number(e.target.value) : null)}
          className="text-sm border border-neutral-200 rounded-lg px-3 py-2 bg-white focus:ring-2 focus:ring-alert-300 focus:border-alert-400 outline-none"
        >
          <option value="">Ano fim</option>
          {anos.map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>

        <select
          value={filtros.mesorregiao}
          onChange={(e) => handleChange('mesorregiao', e.target.value)}
          className="text-sm border border-neutral-200 rounded-lg px-3 py-2 bg-white focus:ring-2 focus:ring-alert-300 focus:border-alert-400 outline-none"
        >
          <option value="">Todas mesorregioes</option>
          {mesorregioes.map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>

        <select
          value={filtros.municipio}
          onChange={(e) => handleChange('municipio', e.target.value)}
          className="text-sm border border-neutral-200 rounded-lg px-3 py-2 bg-white focus:ring-2 focus:ring-alert-300 focus:border-alert-400 outline-none"
        >
          <option value="">Todos municipios</option>
          {municipios.map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>

        {tiposCrime.length > 0 && (
          <select
            value={filtros.tipoCrime}
            onChange={(e) => handleChange('tipoCrime', e.target.value)}
            className="text-sm border border-neutral-200 rounded-lg px-3 py-2 bg-white focus:ring-2 focus:ring-alert-300 focus:border-alert-400 outline-none"
          >
            <option value="">Todos os crimes</option>
            {tiposCrime.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        )}
      </div>

      {activeFilters.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-3">
          {activeFilters.map(({ key, label }) => (
            <span
              key={key}
              className="inline-flex items-center gap-1 px-2.5 py-1 bg-alert-50 text-alert-700 text-xs font-medium rounded-full"
            >
              {label}
              <button
                onClick={() => removeFilter(key)}
                className="hover:bg-alert-200 rounded-full p-0.5 transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

export default Filters
