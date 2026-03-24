import React, { useState, useMemo } from 'react'
import { Search, ArrowUpDown, ChevronUp, ChevronDown } from 'lucide-react'
import { formatNumber, formatTaxa } from '../utils/format'

function RankingTable({ dados, titulo, className = '' }) {
  const [busca, setBusca] = useState('')
  const [sortKey, setSortKey] = useState('taxa_100k')
  const [sortDir, setSortDir] = useState('desc')

  const handleSort = (key) => {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir('desc')
    }
  }

  const rows = useMemo(() => {
    if (!dados || !Array.isArray(dados)) return []

    let filtered = dados
    if (busca) {
      const term = busca.toLowerCase()
      filtered = dados.filter(
        (d) =>
          (d.municipio || '').toLowerCase().includes(term) ||
          (d.mesorregiao || '').toLowerCase().includes(term)
      )
    }

    const sorted = [...filtered].sort((a, b) => {
      const va = a[sortKey] ?? 0
      const vb = b[sortKey] ?? 0
      return sortDir === 'asc' ? va - vb : vb - va
    })

    return sorted
  }, [dados, busca, sortKey, sortDir])

  const SortIcon = ({ colKey }) => {
    if (sortKey !== colKey) return <ArrowUpDown className="w-3 h-3 text-dark-300" />
    return sortDir === 'asc'
      ? <ChevronUp className="w-3 h-3 text-alert-500" />
      : <ChevronDown className="w-3 h-3 text-alert-500" />
  }

  return (
    <div className={`card ${className}`}>
      {titulo && <h3 className="section-title">{titulo}</h3>}

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-300" />
        <input
          type="text"
          placeholder="Buscar municipio..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          className="w-full pl-9 pr-4 py-2 text-sm border border-neutral-200 rounded-lg bg-white focus:ring-2 focus:ring-alert-300 focus:border-alert-400 outline-none"
        />
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-200">
              <th className="text-left py-2.5 px-3 text-dark-400 font-medium w-10">#</th>
              <th
                className="text-left py-2.5 px-3 text-dark-400 font-medium cursor-pointer hover:text-dark-700"
                onClick={() => handleSort('municipio')}
              >
                <span className="inline-flex items-center gap-1">
                  Municipio <SortIcon colKey="municipio" />
                </span>
              </th>
              <th className="text-left py-2.5 px-3 text-dark-400 font-medium hidden sm:table-cell">
                Mesorregiao
              </th>
              <th
                className="text-right py-2.5 px-3 text-dark-400 font-medium cursor-pointer hover:text-dark-700"
                onClick={() => handleSort('ocorrencias')}
              >
                <span className="inline-flex items-center gap-1 justify-end">
                  Ocorrencias <SortIcon colKey="ocorrencias" />
                </span>
              </th>
              <th
                className="text-right py-2.5 px-3 text-dark-400 font-medium cursor-pointer hover:text-dark-700"
                onClick={() => handleSort('taxa_100k')}
              >
                <span className="inline-flex items-center gap-1 justify-end">
                  Taxa 100k <SortIcon colKey="taxa_100k" />
                </span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, 50).map((row, i) => (
              <tr
                key={row.municipio || i}
                className="border-b border-neutral-100 hover:bg-neutral-50 transition-colors"
              >
                <td className="py-2 px-3 text-dark-300 font-medium">{i + 1}</td>
                <td className="py-2 px-3 text-dark-800 font-medium">{row.municipio || '-'}</td>
                <td className="py-2 px-3 text-dark-400 hidden sm:table-cell">{row.mesorregiao || '-'}</td>
                <td className="py-2 px-3 text-right text-dark-700">{formatNumber(row.ocorrencias ?? row.total)}</td>
                <td className="py-2 px-3 text-right font-medium text-alert-700">{formatTaxa(row.taxa_100k ?? row.taxa)}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="py-8 text-center text-dark-300 text-sm">
                  Nenhum resultado encontrado
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {rows.length > 50 && (
        <p className="text-xs text-dark-300 mt-3 text-center">
          Exibindo 50 de {formatNumber(rows.length)} municipios
        </p>
      )}
    </div>
  )
}

export default RankingTable
