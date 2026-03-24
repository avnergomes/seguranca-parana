import React, { useState, useMemo } from 'react'
import { useData } from './hooks/useData'
import { formatNumber } from './utils/format'
import {
  LineChart, Line, BarChart as RBarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, Cell,
} from 'recharts'
import {
  Shield, MapPin, Calendar, BarChart3, Activity, TrendingUp, TrendingDown,
  Minus, Crosshair, Target, Car, Truck, Skull, Users, Filter, X, ExternalLink,
  Database, Search, Eye, Map,
} from 'lucide-react'

/* ── helpers ─────────────────────────────────────────────── */
const sumKeys = (obj, ...terms) => {
  if (!obj) return 0
  let total = 0
  for (const [k, v] of Object.entries(obj)) {
    if (k === 'ano') continue
    if (terms.some(t => k.toLowerCase().includes(t))) total += v || 0
  }
  return total
}
const pctChange = (cur, prev) => (!cur || !prev || prev === 0) ? null : ((cur - prev) / prev * 100)
const getByAno = (arr, ano) => (arr || []).find(r => r.ano === ano)

const COLORS = ['#ea580c','#f97316','#fb923c','#14b8a6','#0d9488','#6366f1','#0ea5e9','#f59e0b','#ef4444','#8b5cf6']

/* ── QuickStat ────────────────────────────────────────────── */
function QuickStat({ icon: Icon, label, sublabel }) {
  return (
    <div className="flex items-center gap-1.5 md:gap-2 px-2 py-1.5 md:px-4 md:py-2 bg-white/10 backdrop-blur-sm rounded-lg md:rounded-xl border border-white/20">
      <Icon className="w-4 h-4 md:w-5 md:h-5 text-alert-200 flex-shrink-0" />
      <div>
        <div className="text-sm md:text-lg font-bold">{label}</div>
        <div className="text-[10px] md:text-xs text-alert-200">{sublabel}</div>
      </div>
    </div>
  )
}

/* ── KpiCard ──────────────────────────────────────────────── */
function KpiCard({ titulo, valor, anterior, icon: Icon, colorBg, colorIcon, colorBar }) {
  const pct = pctChange(valor, anterior)
  const isUp = pct !== null && pct > 2
  const isDown = pct !== null && pct < -2
  const badgeColor = isUp ? 'text-danger-600 bg-danger-50' : isDown ? 'text-emerald-600 bg-emerald-50' : 'text-dark-400 bg-neutral-100'
  return (
    <div className="stat-card group">
      <div className={`absolute top-0 left-0 w-1 md:w-1.5 h-full bg-gradient-to-b ${colorBar} rounded-l-2xl`} />
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <span className="kpi-label text-[10px] md:text-xs">{titulo}</span>
          <div className="kpi-value text-xl md:text-2xl lg:text-3xl mt-1">{valor != null ? formatNumber(valor) : '-'}</div>
        </div>
        <div className="flex flex-col items-end gap-2 flex-shrink-0">
          <div className={`p-2 md:p-3 ${colorBg} rounded-lg md:rounded-xl transition-transform group-hover:scale-110`}>
            <Icon className={`w-5 h-5 md:w-6 md:h-6 ${colorIcon}`} />
          </div>
          {pct !== null && (
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] md:text-xs font-medium ${badgeColor}`}>
              {isUp ? <TrendingUp className="w-3 h-3" /> : isDown ? <TrendingDown className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
              {pct > 0 ? '+' : ''}{pct.toFixed(1)}%
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

/* ── MultiLineChart (Recharts) ───────────────────────────── */
function MultiLineChart({ data, titulo, subtitulo }) {
  if (!data || data.length === 0) return <div className="chart-container text-center text-dark-400 py-12">Sem dados</div>
  const keys = Object.keys(data[0]).filter(k => k !== 'ano')
  return (
    <div className="chart-container">
      <h3 className="chart-title">{titulo}</h3>
      {subtitulo && <p className="text-xs text-dark-400 mb-4">{subtitulo}</p>}
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e9" />
          <XAxis dataKey="ano" tick={{ fontSize: 11, fill: '#737378' }} />
          <YAxis tick={{ fontSize: 11, fill: '#737378' }} tickFormatter={v => formatNumber(v)} />
          <Tooltip formatter={v => formatNumber(v)} contentStyle={{ borderRadius: '0.5rem', border: '1px solid #e5e5e9', fontSize: '0.8rem' }} />
          <Legend wrapperStyle={{ fontSize: '0.7rem' }} />
          {keys.map((k, i) => (
            <Line key={k} type="monotone" dataKey={k} name={k} stroke={COLORS[i % COLORS.length]} strokeWidth={2} dot={{ r: 3 }} />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

/* ── HorizontalBarRanking ─────────────────────────────────── */
function HorizontalBarRanking({ data, titulo, subtitulo }) {
  if (!data || data.length === 0) return null
  return (
    <div className="chart-container">
      <h3 className="chart-title">{titulo}</h3>
      {subtitulo && <p className="text-xs text-dark-400 mb-4">{subtitulo}</p>}
      <ResponsiveContainer width="100%" height={Math.max(280, data.length * 32)}>
        <RBarChart data={data} layout="vertical" margin={{ left: 110 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e9" horizontal={false} />
          <XAxis type="number" tick={{ fontSize: 11, fill: '#737378' }} tickFormatter={formatNumber} />
          <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#737378' }} width={105} />
          <Tooltip formatter={v => formatNumber(v)} contentStyle={{ borderRadius: '0.5rem', border: '1px solid #e5e5e9', fontSize: '0.8rem' }} />
          <Bar dataKey="value" name="Vitimas" radius={[0, 4, 4, 0]}>
            {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
          </Bar>
        </RBarChart>
      </ResponsiveContainer>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════ */
/* ══ App ═══════════════════════════════════════════════════ */
/* ═══════════════════════════════════════════════════════════ */

function App() {
  const {
    loading, erro, serieHistorica, geoData, geoLookup, metadata,
    filtros, setFiltros, anos, mesorregioes, regionais, municipios, dadosFiltrados,
  } = useData()

  const [activeTab, setActiveTab] = useState('visao-geral')
  const [rankSearch, setRankSearch] = useState('')

  /* ── Loading ── */
  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-50">
        <div className="bg-gradient-to-br from-dark-900 via-dark-800 to-alert-900 h-48" />
        <div className="max-w-7xl mx-auto px-4 -mt-8 space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {[...Array(6)].map((_, i) => <div key={i} className="bg-white rounded-2xl shadow-soft p-6 h-28 animate-pulse" />)}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-2xl shadow-soft p-6 h-72 animate-pulse" />
            <div className="bg-white rounded-2xl shadow-soft p-6 h-72 animate-pulse" />
          </div>
        </div>
      </div>
    )
  }

  /* ── Error ── */
  if (erro) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center p-8">
        <div className="card max-w-md text-center p-8">
          <Shield className="w-12 h-12 text-danger-600 mx-auto mb-4" />
          <h2 className="font-display text-lg font-bold text-dark-900 mb-2">Erro ao carregar dados</h2>
          <p className="text-sm text-dark-400 mb-4">{erro}</p>
          <button onClick={() => window.location.reload()} className="px-6 py-2.5 bg-gradient-to-r from-alert-500 to-alert-600 text-white rounded-xl font-medium shadow-lg shadow-alert-500/25">Recarregar</button>
        </div>
      </div>
    )
  }

  const crim = dadosFiltrados?.criminalidade || {}
  const vl = dadosFiltrados?.violenciaLetal || {}
  const pat = dadosFiltrados?.patrimonio || {}
  const vitSexo = dadosFiltrados?.vitimasSexo || {}
  const anoAtual = filtros.anoFim || anos[anos.length - 1]

  const crimAtual = getByAno(crim.estado, anoAtual)
  const crimPrev = getByAno(crim.estado, anoAtual - 1)
  const vlAtual = getByAno(vl.estado, anoAtual)
  const vlPrev = getByAno(vl.estado, anoAtual - 1)
  const patAtual = getByAno(pat.estado, anoAtual)
  const patPrev = getByAno(pat.estado, anoAtual - 1)

  // Top municipios ranking (filtered by all filters)
  const topMunicipios = (crim.anual || [])
    .filter(r => r.ano === anoAtual)
    .filter(r => !rankSearch || (geoLookup[r.cod_ibge]?.municipio || r.municipio || '').toLowerCase().includes(rankSearch.toLowerCase()))
    .sort((a, b) => b.vitimas - a.vitimas)
    .slice(0, 15)
    .map(m => ({ name: geoLookup[m.cod_ibge]?.municipio || m.municipio, value: m.vitimas }))

  const tabs = [
    { id: 'visao-geral', label: 'Visao Geral', icon: BarChart3 },
    { id: 'violencia-letal', label: 'Violencia Letal', icon: Crosshair },
    { id: 'crimes-patrimoniais', label: 'Patrimoniais', icon: Car },
    { id: 'serie-historica', label: 'Serie Historica', icon: Activity },
    { id: 'perfil-municipal', label: 'Perfil Municipal', icon: Map },
  ]

  return (
    <div className="min-h-screen flex flex-col">
      {/* ═══ HEADER ═══ */}
      <header className="relative overflow-hidden bg-gradient-to-br from-dark-900 via-dark-800 to-alert-800 text-white">
        <div className="absolute inset-0 opacity-5">
          <svg width="100%" height="100%"><pattern id="g" width="60" height="60" patternUnits="userSpaceOnUse"><path d="M30 0L30 60M0 30L60 30" stroke="white" strokeWidth="0.5"/></pattern><rect fill="url(#g)" width="100%" height="100%"/></svg>
        </div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-center gap-3 md:gap-4">
              <div className="flex items-center justify-center w-12 h-12 md:w-14 md:h-14 bg-white/10 backdrop-blur-sm rounded-2xl border border-white/20">
                <Shield className="w-6 h-6 md:w-8 md:h-8 text-alert-300" />
              </div>
              <div>
                <h1 className="text-xl md:text-2xl lg:text-3xl font-display font-bold tracking-tight">Seguranca Parana</h1>
                <p className="text-alert-200 text-xs md:text-sm font-medium">Inteligencia Territorial de Seguranca Publica</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 md:gap-4">
              <QuickStat icon={MapPin} label="399" sublabel="Municipios" />
              <QuickStat icon={Calendar} label={`${anos[0]}-${anos[anos.length-1]}`} sublabel="Periodo" />
              <QuickStat icon={Eye} label="9" sublabel="Indicadores" />
            </div>
          </div>
          <div className="mt-4 p-3 bg-white/10 backdrop-blur-sm rounded-xl border border-white/20">
            <p className="text-neutral-50 text-xs md:text-sm leading-relaxed">
              Dados do SINESP/MJ (municipal) e SESP-PR (estadual). Fonte oficial. Sujeitos a defasagem e sub-registro.
            </p>
          </div>
        </div>
        <div className="absolute bottom-0 left-0 right-0">
          <svg viewBox="0 0 1440 48" fill="none" className="w-full h-4 md:h-6 lg:h-8"><path d="M0 48h1440V0C1440 0 1140 48 720 48S0 0 0 0v48z" fill="#FDFDFF"/></svg>
        </div>
      </header>

      {/* ═══ MAIN ═══ */}
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 md:py-6 w-full space-y-4 md:space-y-6">

        {/* ── Filters ── */}
        <div className="card p-4 md:p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-alert-100 rounded-lg"><Filter className="w-5 h-5 text-alert-600" /></div>
            <h2 className="text-lg font-display font-bold text-dark-900">Filtros</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            <div>
              <label className="filter-label">Ano inicial</label>
              <select value={filtros.anoInicio || ''} onChange={e => setFiltros({ anoInicio: Number(e.target.value) })} className="filter-select">
                {anos.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
            <div>
              <label className="filter-label">Ano final</label>
              <select value={filtros.anoFim || ''} onChange={e => setFiltros({ anoFim: Number(e.target.value) })} className="filter-select">
                {anos.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
            <div>
              <label className="filter-label">Mesorregiao IDR</label>
              <select value={filtros.mesorregiao} onChange={e => setFiltros({ mesorregiao: e.target.value })} className="filter-select">
                <option value="todas">Todas</option>
                {mesorregioes.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="filter-label">Regional IDR</label>
              <select value={filtros.regional} onChange={e => setFiltros({ regional: e.target.value })} className="filter-select">
                <option value="todas">Todas</option>
                {regionais.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <label className="filter-label">Municipio</label>
              <select value={filtros.municipio} onChange={e => setFiltros({ municipio: e.target.value })} className="filter-select">
                <option value="todos">Todos</option>
                {municipios.map(m => <option key={m.cod} value={m.cod}>{m.nome}</option>)}
              </select>
            </div>
          </div>
          {(filtros.mesorregiao !== 'todas' || filtros.regional !== 'todas' || filtros.municipio !== 'todos') && (
            <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-neutral-100">
              {filtros.mesorregiao !== 'todas' && <span className="active-filter-badge">Meso: {filtros.mesorregiao}<button onClick={() => setFiltros({ mesorregiao: 'todas' })}><X className="w-3 h-3 ml-1" /></button></span>}
              {filtros.regional !== 'todas' && <span className="active-filter-badge">Regional: {filtros.regional}<button onClick={() => setFiltros({ regional: 'todas' })}><X className="w-3 h-3 ml-1" /></button></span>}
              {filtros.municipio !== 'todos' && <span className="active-filter-badge">{geoLookup[filtros.municipio]?.municipio || filtros.municipio}<button onClick={() => setFiltros({ municipio: 'todos' })}><X className="w-3 h-3 ml-1" /></button></span>}
            </div>
          )}
        </div>

        {/* ── KPIs (filtered) ── */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 md:gap-4">
          <KpiCard titulo="Vitimas Totais" valor={crimAtual?.vitimas} anterior={crimPrev?.vitimas} icon={Users} colorBg="bg-alert-50" colorIcon="text-alert-600" colorBar="from-alert-500 to-alert-600" />
          <KpiCard titulo="Homicidios" valor={sumKeys(vlAtual, 'homic')} anterior={sumKeys(vlPrev, 'homic')} icon={Crosshair} colorBg="bg-danger-50" colorIcon="text-danger-600" colorBar="from-danger-500 to-danger-600" />
          <KpiCard titulo="Tentativas" valor={sumKeys(vlAtual, 'tentativa')} anterior={sumKeys(vlPrev, 'tentativa')} icon={Target} colorBg="bg-amber-50" colorIcon="text-amber-600" colorBar="from-amber-500 to-amber-600" />
          <KpiCard titulo="Roubos Veic." valor={sumKeys(patAtual, 'roubo de ve')} anterior={sumKeys(patPrev, 'roubo de ve')} icon={Car} colorBg="bg-secondary-50" colorIcon="text-secondary-600" colorBar="from-secondary-500 to-secondary-600" />
          <KpiCard titulo="Furtos Veic." valor={sumKeys(patAtual, 'furto')} anterior={sumKeys(patPrev, 'furto')} icon={Truck} colorBg="bg-water-50" colorIcon="text-water-600" colorBar="from-water-500 to-water-600" />
          <KpiCard titulo="Latrocinios" valor={sumKeys(vlAtual, 'latroc', 'morte')} anterior={sumKeys(vlPrev, 'latroc', 'morte')} icon={Skull} colorBg="bg-danger-50" colorIcon="text-danger-700" colorBar="from-danger-600 to-danger-700" />
        </div>

        {/* ── Tabs ── */}
        <div className="flex gap-1.5 md:gap-2 p-1.5 md:p-2 bg-neutral-100/50 rounded-xl md:rounded-2xl overflow-x-auto scrollbar-thin">
          {tabs.map(t => {
            const isActive = activeTab === t.id
            return (
              <button key={t.id} onClick={() => setActiveTab(t.id)}
                className={`flex items-center gap-1.5 md:gap-2 px-3 md:px-5 py-2 md:py-3 rounded-lg md:rounded-xl text-xs md:text-sm font-medium transition-all flex-shrink-0 ${
                  isActive ? 'bg-gradient-to-r from-alert-500 to-alert-600 text-white shadow-lg shadow-alert-500/25 scale-[1.02]' : 'text-neutral-600 hover:text-alert-700 hover:bg-white/80'
                }`}>
                <t.icon className={`w-3.5 h-3.5 md:w-4 md:h-4 ${isActive ? 'text-alert-100' : ''}`} />
                <span className="hidden sm:inline whitespace-nowrap">{t.label}</span>
              </button>
            )
          })}
        </div>

        {/* ═══ TAB CONTENT ═══ */}
        <div className="space-y-6">

          {/* ── VISAO GERAL ── */}
          {activeTab === 'visao-geral' && (<>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <MultiLineChart data={crim.estado} titulo="Vitimas por Ano" subtitulo="Total filtrado por geografia selecionada" />
              <HorizontalBarRanking data={topMunicipios} titulo={`Top Municipios (${anoAtual})`} subtitulo="Ranking de vitimas no periodo filtrado" />
            </div>

            {vl.estado?.length > 0 && (
              <MultiLineChart data={vl.estado} titulo="Violencia Letal por Tipo" subtitulo="Ocorrencias anuais — nivel estadual (SINESP)" />
            )}

            {pat.estado?.length > 0 && (
              <MultiLineChart data={pat.estado} titulo="Crimes Patrimoniais por Tipo" subtitulo="Ocorrencias anuais — nivel estadual (SINESP)" />
            )}
          </>)}

          {/* ── VIOLENCIA LETAL ── */}
          {activeTab === 'violencia-letal' && (<>
            <MultiLineChart data={vl.estado} titulo="Violencia Letal — Serie Anual por Tipo" subtitulo="Homicidio doloso, latrocinio, lesao corporal mortal, tentativa" />

            {vitSexo.estado?.length > 0 && (
              <MultiLineChart data={vitSexo.estado} titulo="Vitimas por Sexo — Serie Anual" subtitulo="Desagregacao por sexo (masculino, feminino, nao informado)" />
            )}

            <HorizontalBarRanking data={topMunicipios} titulo={`Municipios com mais Vitimas (${anoAtual})`} subtitulo="Filtrado pela geografia selecionada" />
          </>)}

          {/* ── CRIMES PATRIMONIAIS ── */}
          {activeTab === 'crimes-patrimoniais' && (<>
            <MultiLineChart data={pat.estado} titulo="Crimes Patrimoniais — Serie Anual" subtitulo="Roubo/furto de veiculos, roubo de carga, roubo a inst. financeira" />

            <HorizontalBarRanking data={topMunicipios} titulo={`Municipios com mais Vitimas (${anoAtual})`} subtitulo="Dados municipais de vitimas totais (SINESP)" />
          </>)}

          {/* ── SERIE HISTORICA ── */}
          {activeTab === 'serie-historica' && (<>
            <MultiLineChart data={crim.estado} titulo="Vitimas Totais por Ano" subtitulo="Agregacao municipal filtrada" />
            <MultiLineChart data={vl.estado} titulo="Violencia Letal por Tipo" subtitulo="Nivel estadual (SINESP UF)" />
            <MultiLineChart data={pat.estado} titulo="Crimes Patrimoniais por Tipo" subtitulo="Nivel estadual (SINESP UF)" />
            {vitSexo.estado?.length > 0 && (
              <MultiLineChart data={vitSexo.estado} titulo="Vitimas por Sexo e Tipo de Crime" subtitulo="Desagregacao masculino/feminino (SINESP UF)" />
            )}
          </>)}

          {/* ── PERFIL MUNICIPAL ── */}
          {activeTab === 'perfil-municipal' && (<>
            <div className="card p-6">
              <h3 className="chart-title">Selecione um Municipio</h3>
              <p className="text-xs text-dark-400 mb-4">Use os filtros acima ou escolha diretamente</p>
              <select value={filtros.municipio} onChange={e => setFiltros({ municipio: e.target.value })} className="filter-select max-w-md">
                <option value="todos">Escolha...</option>
                {municipios.map(m => <option key={m.cod} value={m.cod}>{m.nome}</option>)}
              </select>
            </div>

            {filtros.municipio !== 'todos' && (() => {
              const munInfo = geoLookup[filtros.municipio]
              // Build annual series for this municipality
              const munAnual = {}
              for (const r of (crim.rows || [])) {
                if (String(r.cod_ibge) !== String(filtros.municipio)) continue
                if (!munAnual[r.ano]) munAnual[r.ano] = { ano: r.ano, vitimas: 0 }
                munAnual[r.ano].vitimas += r.vitimas
              }
              const munSerie = Object.values(munAnual).sort((a, b) => a.ano - b.ano)

              return (<>
                <div className="card p-6">
                  <h3 className="font-display font-bold text-xl text-dark-900">{munInfo?.municipio}</h3>
                  <p className="text-sm text-dark-400">Regional {munInfo?.regional} — Mesorregiao {munInfo?.mesorregiao}</p>
                </div>
                <MultiLineChart data={munSerie} titulo={`Vitimas por Ano — ${munInfo?.municipio}`} subtitulo="Dados municipais mensais agregados anualmente" />
              </>)
            })()}

            {/* Ranking full */}
            <div className="chart-container">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="chart-title mb-0">Ranking Municipal ({anoAtual})</h3>
                  <p className="text-xs text-dark-400">Vitimas totais — filtrado por geografia</p>
                </div>
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-dark-300" />
                  <input type="text" placeholder="Buscar..." value={rankSearch} onChange={e => setRankSearch(e.target.value)}
                    className="pl-8 pr-3 py-1.5 bg-neutral-50 border border-neutral-200 rounded-lg text-xs w-36 focus:ring-2 focus:ring-alert-200 outline-none" />
                </div>
              </div>
              <div className="overflow-y-auto max-h-[400px]">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-white">
                    <tr className="border-b border-neutral-200">
                      <th className="text-left py-2 px-2 text-xs text-dark-500 w-8">#</th>
                      <th className="text-left py-2 px-2 text-xs text-dark-500">Municipio</th>
                      <th className="text-left py-2 px-2 text-xs text-dark-500 hidden md:table-cell">Regional</th>
                      <th className="text-right py-2 px-2 text-xs text-dark-500">Vitimas</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(crim.anual || [])
                      .filter(r => r.ano === anoAtual)
                      .filter(r => !rankSearch || (geoLookup[r.cod_ibge]?.municipio || '').toLowerCase().includes(rankSearch.toLowerCase()))
                      .sort((a, b) => b.vitimas - a.vitimas)
                      .slice(0, 50)
                      .map((m, i) => (
                        <tr key={i} className="border-b border-neutral-100 hover:bg-alert-50/20 transition-colors cursor-pointer" onClick={() => setFiltros({ municipio: String(m.cod_ibge) })}>
                          <td className="py-2 px-2 text-xs text-dark-400 font-mono">{i+1}</td>
                          <td className="py-2 px-2 font-medium text-dark-800">{geoLookup[m.cod_ibge]?.municipio || m.municipio}</td>
                          <td className="py-2 px-2 text-xs text-dark-500 hidden md:table-cell">{geoLookup[m.cod_ibge]?.regional}</td>
                          <td className="text-right py-2 px-2 font-mono font-semibold text-dark-900">{formatNumber(m.vitimas)}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>)}

        </div>
      </main>

      {/* ═══ FOOTER ═══ */}
      <footer className="mt-12 border-t border-alert-200 bg-gradient-to-b from-neutral-50 to-alert-50/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-3">
              <h4 className="font-semibold text-dark-900 text-sm flex items-center gap-2"><Database className="w-4 h-4 text-alert-600" />Fontes de Dados</h4>
              <ul className="space-y-1.5 text-xs text-dark-600">
                <li>SINESP — Ministerio da Justica</li>
                <li>SESP-PR / CAPE — Secretaria de Seguranca</li>
                <li>IBGE — Populacao Municipal</li>
              </ul>
            </div>
            <div className="space-y-3">
              <h4 className="font-semibold text-dark-900 text-sm">
                <a href="https://datageoparana.github.io" target="_blank" rel="noopener noreferrer" className="hover:text-alert-600 transition-colors inline-flex items-center gap-1">DataGeo Parana <ExternalLink className="w-3 h-3" /></a>
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {['VBP Parana','Precos Diarios','Saude Parana','Censo Parana','Comex Parana'].map(n => (
                  <span key={n} className="px-2.5 py-1 text-[10px] rounded-full border border-alert-200 bg-white/70 text-dark-600">{n}</span>
                ))}
              </div>
            </div>
            <div className="space-y-3 flex flex-col items-start md:items-end">
              <a href="https://github.com/avnergomes" target="_blank" rel="noopener noreferrer" className="text-xs text-dark-500 hover:text-alert-600">Desenvolvido por Avner Gomes</a>
            </div>
          </div>
          <div className="mt-6 pt-4 border-t border-alert-200 flex flex-col sm:flex-row items-center justify-between gap-2 text-[10px] text-dark-400">
            <p>Dados sensiveis. Numeros sujeitos a atualizacao pelas fontes originais.</p>
            <div className="flex gap-2">
              <span className="px-2 py-0.5 bg-alert-100 text-alert-700 rounded-full">{anos.length} anos</span>
              <span className="px-2 py-0.5 bg-primary-100 text-primary-700 rounded-full">399 municipios</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}

export default App
