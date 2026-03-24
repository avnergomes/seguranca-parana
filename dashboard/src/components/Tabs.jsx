import React from 'react'
import { Eye, Crosshair, Car, Pill, TrendingUp, MapPin } from 'lucide-react'

const TABS = [
  { id: 'visao-geral', label: 'Visao Geral', icon: Eye },
  { id: 'violencia-letal', label: 'Violencia Letal', icon: Crosshair },
  { id: 'crimes-patrimoniais', label: 'Crimes Patrimoniais', icon: Car },
  { id: 'drogas-armas', label: 'Drogas e Armas', icon: Pill },
  { id: 'serie-historica', label: 'Serie Historica', icon: TrendingUp },
  { id: 'perfil-municipal', label: 'Perfil Municipal', icon: MapPin },
]

function Tabs({ activeTab, onTabChange }) {
  return (
    <div className="flex overflow-x-auto gap-1 bg-white rounded-xl shadow-card p-1.5 border border-neutral-200/60">
      {TABS.map(({ id, label, icon: Icon }) => {
        const isActive = activeTab === id
        return (
          <button
            key={id}
            onClick={() => onTabChange(id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
              isActive
                ? 'bg-alert-500 text-white shadow-sm'
                : 'text-dark-500 hover:text-dark-700 hover:bg-neutral-100'
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        )
      })}
    </div>
  )
}

export default Tabs
