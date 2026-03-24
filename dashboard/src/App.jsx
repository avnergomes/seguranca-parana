import React, { useState } from 'react'
import { useData } from './hooks/useData'
import { formatNumber } from './utils/format'

function App() {
  const {
    loading,
    erro,
    serieHistorica,
    geoData,
    geoLookup,
    metadata,
    filtros,
    setFiltros,
    anos,
    mesorregioes,
    municipios,
    dadosFiltrados,
  } = useData()

  const [activeTab, setActiveTab] = useState('visao-geral')

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-neutral-200 rounded w-64" />
          <div className="h-4 bg-neutral-200 rounded w-96" />
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {[...Array(6)].map((_, i) => <div key={i} className="bg-white rounded-2xl shadow p-6 h-24" />)}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-2xl shadow p-6 h-72" />
            <div className="bg-white rounded-2xl shadow p-6 h-72" />
          </div>
        </div>
      </div>
    )
  }

  if (erro) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center p-8">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md text-center">
          <h2 className="text-lg font-bold text-red-600 mb-2">Erro ao carregar dados</h2>
          <p className="text-sm text-gray-500 mb-4">{erro}</p>
          <button onClick={() => window.location.reload()} className="px-4 py-2 bg-orange-500 text-white rounded-lg">
            Recarregar
          </button>
        </div>
      </div>
    )
  }

  const crim = dadosFiltrados?.criminalidade || {}
  const vl = dadosFiltrados?.violenciaLetal || {}
  const pat = dadosFiltrados?.patrimonio || {}
  const anoAtual = filtros.anoFim || anos[anos.length - 1]

  const tabs = [
    { id: 'visao-geral', label: 'Visao Geral' },
    { id: 'violencia-letal', label: 'Violencia Letal' },
    { id: 'crimes-patrimoniais', label: 'Crimes Patrimoniais' },
    { id: 'drogas-armas', label: 'Drogas e Armas' },
    { id: 'serie-historica', label: 'Serie Historica' },
    { id: 'perfil-municipal', label: 'Perfil Municipal' },
  ]

  // Helper: sum values matching partial key in an object
  const sumKeys = (obj, ...terms) => {
    if (!obj) return 0
    let total = 0
    for (const [k, v] of Object.entries(obj)) {
      if (k === 'ano') continue
      if (terms.some(t => k.toLowerCase().includes(t))) total += v || 0
    }
    return total
  }

  // KPI data
  const getByAno = (arr, ano) => (arr || []).find(r => r.ano === ano)
  const crimAtual = getByAno(crim.estado, anoAtual)
  const crimPrev = getByAno(crim.estado, anoAtual - 1)
  const vlAtual = getByAno(vl.estado, anoAtual)
  const vlPrev = getByAno(vl.estado, anoAtual - 1)
  const patAtual = getByAno(pat.estado, anoAtual)
  const patPrev = getByAno(pat.estado, anoAtual - 1)

  const pctChange = (cur, prev) => {
    if (!cur || !prev || prev === 0) return null
    return ((cur - prev) / prev * 100).toFixed(1)
  }

  const KpiCard = ({ titulo, valor, anterior, icon, bad = true }) => {
    const pct = pctChange(valor, anterior)
    const corPct = pct === null ? '' : (Number(pct) > 2 ? (bad ? 'text-red-600' : 'text-green-600') : Number(pct) < -2 ? (bad ? 'text-green-600' : 'text-red-600') : 'text-gray-500')
    return (
      <div className="bg-white rounded-2xl shadow p-4">
        <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">{titulo}</p>
        <p className="text-2xl font-bold text-gray-900">{valor != null ? formatNumber(valor) : '-'}</p>
        {pct !== null && <p className={`text-xs font-medium mt-1 ${corPct}`}>{Number(pct) > 0 ? '+' : ''}{pct}% vs anterior</p>}
      </div>
    )
  }

  // Ranking data: top municipalities by vitimas
  const topMunicipios = (crim.anual || [])
    .filter(r => r.ano === anoAtual)
    .sort((a, b) => b.vitimas - a.vitimas)
    .slice(0, 15)

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-5 flex items-center justify-between">
          <div>
            <h1 className="font-bold text-2xl text-gray-900">Seguranca Parana</h1>
            <p className="text-sm text-gray-500">Indicadores de seguranca publica — 399 municipios</p>
          </div>
          <div className="text-xs text-gray-400">
            {metadata?.gerado_em && `Atualizado: ${metadata.gerado_em.split('T')[0]}`}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Tabs */}
        <nav className="flex gap-1 overflow-x-auto border-b border-gray-200">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                activeTab === t.id ? 'border-orange-500 text-orange-600' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>

        {/* Filters */}
        <div className="bg-white rounded-2xl shadow p-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Ano inicial</label>
              <select value={filtros.anoInicio || ''} onChange={e => setFiltros({ anoInicio: Number(e.target.value) })} className="w-full text-sm border rounded-lg px-2 py-1.5">
                {anos.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Ano final</label>
              <select value={filtros.anoFim || ''} onChange={e => setFiltros({ anoFim: Number(e.target.value) })} className="w-full text-sm border rounded-lg px-2 py-1.5">
                {anos.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Mesorregiao</label>
              <select value={filtros.mesorregiao} onChange={e => setFiltros({ mesorregiao: e.target.value, municipio: 'todos' })} className="w-full text-sm border rounded-lg px-2 py-1.5">
                <option value="todas">Todas</option>
                {mesorregioes.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Municipio</label>
              <select value={filtros.municipio} onChange={e => setFiltros({ municipio: e.target.value })} className="w-full text-sm border rounded-lg px-2 py-1.5">
                <option value="todos">Todos</option>
                {municipios.map(m => <option key={m.cod} value={m.cod}>{m.nome}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* VISAO GERAL */}
        {activeTab === 'visao-geral' && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              <KpiCard titulo="Vitimas Totais" valor={crimAtual?.vitimas} anterior={crimPrev?.vitimas} />
              <KpiCard titulo="Homicidios" valor={sumKeys(vlAtual, 'homic')} anterior={sumKeys(vlPrev, 'homic')} />
              <KpiCard titulo="Tentativas" valor={sumKeys(vlAtual, 'tentativa')} anterior={sumKeys(vlPrev, 'tentativa')} />
              <KpiCard titulo="Roubos Veic." valor={sumKeys(patAtual, 'roubo de ve')} anterior={sumKeys(patPrev, 'roubo de ve')} />
              <KpiCard titulo="Furtos Veic." valor={sumKeys(patAtual, 'furto')} anterior={sumKeys(patPrev, 'furto')} />
              <KpiCard titulo="Latrocinios" valor={sumKeys(vlAtual, 'latroc', 'morte')} anterior={sumKeys(vlPrev, 'latroc', 'morte')} />
            </div>

            {/* Serie temporal estado */}
            <div className="bg-white rounded-2xl shadow p-6">
              <h3 className="font-bold text-gray-900 mb-4">Evolucao Temporal — Vitimas ({anos[0]}-{anos[anos.length-1]})</h3>
              <div className="flex items-end gap-1 h-48">
                {(crim.estado || []).map((d, i) => {
                  const max = Math.max(...(crim.estado || []).map(r => r.vitimas || 0))
                  const h = max > 0 ? ((d.vitimas || 0) / max) * 100 : 0
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1">
                      <span className="text-xs text-gray-500">{formatNumber(d.vitimas)}</span>
                      <div className="w-full bg-orange-500 rounded-t" style={{ height: `${h}%` }} title={`${d.ano}: ${d.vitimas}`} />
                      <span className="text-xs text-gray-400">{d.ano}</span>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Top municipios */}
            <div className="bg-white rounded-2xl shadow p-6">
              <h3 className="font-bold text-gray-900 mb-4">Top Municipios — Vitimas ({anoAtual})</h3>
              <div className="space-y-2">
                {topMunicipios.map((m, i) => {
                  const max = topMunicipios[0]?.vitimas || 1
                  const pct = (m.vitimas / max) * 100
                  const nome = geoLookup[m.cod_ibge]?.municipio || m.municipio || m.cod_ibge
                  return (
                    <div key={i} className="flex items-center gap-3">
                      <span className="text-xs text-gray-400 w-5 text-right">{i + 1}</span>
                      <span className="text-sm text-gray-700 w-40 truncate">{nome}</span>
                      <div className="flex-1 bg-gray-100 rounded-full h-4">
                        <div className="bg-orange-500 h-4 rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-sm font-medium text-gray-900 w-16 text-right">{formatNumber(m.vitimas)}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        {/* VIOLENCIA LETAL */}
        {activeTab === 'violencia-letal' && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl shadow p-6">
              <h3 className="font-bold text-gray-900 mb-4">Violencia Letal por Tipo (UF)</h3>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 text-gray-500">Ano</th>
                    {vl.estado?.[0] && Object.keys(vl.estado[0]).filter(k => k !== 'ano').map(k => (
                      <th key={k} className="text-right py-2 text-gray-500">{k}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(vl.estado || []).map((row, i) => (
                    <tr key={i} className="border-b border-gray-100">
                      <td className="py-2 font-medium">{row.ano}</td>
                      {Object.entries(row).filter(([k]) => k !== 'ano').map(([k, v]) => (
                        <td key={k} className="text-right py-2">{formatNumber(v)}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* CRIMES PATRIMONIAIS */}
        {activeTab === 'crimes-patrimoniais' && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl shadow p-6">
              <h3 className="font-bold text-gray-900 mb-4">Crimes Patrimoniais por Tipo (UF)</h3>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 text-gray-500">Ano</th>
                    {pat.estado?.[0] && Object.keys(pat.estado[0]).filter(k => k !== 'ano').map(k => (
                      <th key={k} className="text-right py-2 text-gray-500">{k}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(pat.estado || []).map((row, i) => (
                    <tr key={i} className="border-b border-gray-100">
                      <td className="py-2 font-medium">{row.ano}</td>
                      {Object.entries(row).filter(([k]) => k !== 'ano').map(([k, v]) => (
                        <td key={k} className="text-right py-2">{formatNumber(v)}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* DROGAS E ARMAS */}
        {activeTab === 'drogas-armas' && (
          <div className="bg-white rounded-2xl shadow p-8 text-center">
            <p className="text-gray-500">Dados de drogas e armas nao disponiveis no SINESP. Consultar relatorios SESP-PR/CAPE.</p>
          </div>
        )}

        {/* SERIE HISTORICA */}
        {activeTab === 'serie-historica' && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl shadow p-6">
              <h3 className="font-bold text-gray-900 mb-4">Evolucao Anual por Tipo de Crime (2015-2022)</h3>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 text-gray-500">Tipo</th>
                    <th className="text-left py-2 text-gray-500">Ano</th>
                    <th className="text-right py-2 text-gray-500">Ocorrencias</th>
                  </tr>
                </thead>
                <tbody>
                  {(serieHistorica?.anual_uf_tipo || []).map((r, i) => (
                    <tr key={i} className="border-b border-gray-100">
                      <td className="py-1.5">{r.tipo_crime}</td>
                      <td className="py-1.5">{r.ano}</td>
                      <td className="text-right py-1.5">{formatNumber(r.ocorrencias)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* PERFIL MUNICIPAL */}
        {activeTab === 'perfil-municipal' && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl shadow p-6">
              <h3 className="font-bold text-gray-900 mb-3">Selecione um Municipio</h3>
              <select
                value={filtros.municipio}
                onChange={e => setFiltros({ municipio: e.target.value })}
                className="w-full max-w-md text-sm border rounded-lg px-3 py-2.5"
              >
                <option value="todos">Escolha...</option>
                {municipios.map(m => <option key={m.cod} value={m.cod}>{m.nome}</option>)}
              </select>
            </div>
            {filtros.municipio !== 'todos' && (
              <div className="bg-white rounded-2xl shadow p-6">
                <h3 className="font-bold text-gray-900 mb-4">
                  {geoLookup[filtros.municipio]?.municipio} — {geoLookup[filtros.municipio]?.mesorregiao}
                </h3>
                <table className="w-full text-sm">
                  <thead><tr className="border-b"><th className="text-left py-2">Ano</th><th className="text-right py-2">Vitimas</th></tr></thead>
                  <tbody>
                    {(crim.anual || []).filter(r => String(r.cod_ibge) === String(filtros.municipio)).map((r, i) => (
                      <tr key={i} className="border-b border-gray-100">
                        <td className="py-1.5">{r.ano}</td>
                        <td className="text-right py-1.5">{formatNumber(r.vitimas)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t mt-12 py-8">
        <div className="max-w-7xl mx-auto px-4 text-center text-xs text-gray-400">
          <p>Fontes: SINESP/MJ, SESP-PR/CAPE, IBGE. Dados sujeitos a defasagem temporal e limitacoes de sub-registro.</p>
          <p className="mt-1">DataGeo Parana — Inteligencia Territorial Multissetorial</p>
        </div>
      </footer>
    </div>
  )
}

export default App
