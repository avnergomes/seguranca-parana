import React, { useState } from 'react'
import { useData } from './hooks/useData'
import ErrorBoundary from './components/ErrorBoundary'
import Header from './components/Header'
import Filters from './components/Filters'
import Tabs from './components/Tabs'
import KpiCards from './components/KpiCards'
import Loading from './components/Loading'
import Footer from './components/Footer'
import MapChart from './components/MapChart'
import TimeSeriesChart from './components/TimeSeriesChart'
import RankingTable from './components/RankingTable'
import TreemapChart from './components/TreemapChart'
import HeatmapChart from './components/HeatmapChart'
import BumpChart from './components/BumpChart'
import BarChart from './components/BarChart'
import RadarChart from './components/RadarChart'
import SankeyChart from './components/SankeyChart'

function App() {
  const {
    loading,
    erro,
    serieHistorica,
    atlasViolencia,
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

  if (loading) return <Loading />

  if (erro) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center p-8">
        <div className="card max-w-md text-center">
          <h2 className="font-display text-lg font-bold text-danger-600 mb-2">
            Erro ao carregar dados
          </h2>
          <p className="text-sm text-dark-400">{erro}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-alert-500 text-white text-sm font-medium rounded-lg hover:bg-alert-600 transition-colors"
          >
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

  return (
    <div className="min-h-screen bg-neutral-50">
      <Header metadata={metadata} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        <Tabs activeTab={activeTab} onTabChange={setActiveTab} />

        <Filters
          filtros={filtros}
          setFiltros={setFiltros}
          anos={anos}
          mesorregioes={mesorregioes}
          municipios={municipios}
          activeTab={activeTab}
        />

        {/* Visao Geral */}
        {activeTab === 'visao-geral' && (
          <div className="space-y-6">
            <ErrorBoundary>
              <KpiCards
                estadoCrim={crim.estado}
                estadoVl={vl.estado}
                estadoPat={pat.estado}
                anoAtual={anoAtual}
              />
            </ErrorBoundary>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <ErrorBoundary>
                <MapChart
                  geojson={geoData}
                  dados={crim.anual}
                  geoLookup={geoLookup}
                  anoAtual={anoAtual}
                  titulo="Vitimas por Municipio"
                />
              </ErrorBoundary>

              <ErrorBoundary>
                <TimeSeriesChart
                  dados={crim.estado}
                  titulo="Evolucao Temporal — Vitimas"
                />
              </ErrorBoundary>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <ErrorBoundary>
                <TreemapChart
                  dados={vl.estado}
                  anoAtual={anoAtual}
                  titulo="Composicao — Violencia Letal"
                />
              </ErrorBoundary>

              <ErrorBoundary>
                <BarChart
                  dados={crim.anual}
                  geoLookup={geoLookup}
                  anoAtual={anoAtual}
                  titulo="Top 10 Municipios — Vitimas"
                  topN={10}
                />
              </ErrorBoundary>
            </div>
          </div>
        )}

        {/* Violencia Letal */}
        {activeTab === 'violencia-letal' && (
          <div className="space-y-6">
            <ErrorBoundary>
              <TimeSeriesChart
                dados={vl.estado}
                titulo="Serie Temporal — Violencia Letal por Tipo"
              />
            </ErrorBoundary>

            <ErrorBoundary>
              <RankingTable
                dados={crim.anual}
                geoLookup={geoLookup}
                anoAtual={anoAtual}
                titulo="Ranking — Vitimas por Municipio"
              />
            </ErrorBoundary>
          </div>
        )}

        {/* Crimes Patrimoniais */}
        {activeTab === 'crimes-patrimoniais' && (
          <div className="space-y-6">
            <ErrorBoundary>
              <TimeSeriesChart
                dados={pat.estado}
                titulo="Serie Temporal — Crimes Patrimoniais"
              />
            </ErrorBoundary>

            <ErrorBoundary>
              <HeatmapChart
                dados={serieHistorica?.mensal_uf_tipo}
                titulo="Sazonalidade — Mes x Tipo de Crime"
              />
            </ErrorBoundary>
          </div>
        )}

        {/* Drogas e Armas */}
        {activeTab === 'drogas-armas' && (
          <div className="card text-center py-12">
            <p className="text-dark-500">
              Dados de drogas e armas nao estao disponiveis no SINESP municipal.
              Consultar os relatorios trimestrais da SESP-PR/CAPE para informacoes detalhadas.
            </p>
          </div>
        )}

        {/* Serie Historica */}
        {activeTab === 'serie-historica' && (
          <div className="space-y-6">
            <ErrorBoundary>
              <TimeSeriesChart
                dados={serieHistorica?.anual_uf_tipo}
                titulo="Evolucao Anual por Tipo de Crime (2015-2022)"
              />
            </ErrorBoundary>

            <ErrorBoundary>
              <TimeSeriesChart
                dados={serieHistorica?.anual_municipal}
                titulo="Vitimas Totais por Ano"
              />
            </ErrorBoundary>
          </div>
        )}

        {/* Perfil Municipal */}
        {activeTab === 'perfil-municipal' && (
          <div className="space-y-6">
            <div className="card">
              <h3 className="section-title mb-3">Selecione um Municipio</h3>
              <select
                value={filtros.municipio}
                onChange={(e) => setFiltros({ municipio: e.target.value })}
                className="w-full max-w-md text-sm border border-neutral-200 rounded-lg px-3 py-2.5 bg-white focus:ring-2 focus:ring-alert-300 focus:border-alert-400 outline-none"
              >
                <option value="todos">Escolha um municipio...</option>
                {municipios.map((m) => (
                  <option key={m.cod} value={m.cod}>{m.nome}</option>
                ))}
              </select>
            </div>

            {filtros.municipio !== 'todos' && (
              <ErrorBoundary>
                <RankingTable
                  dados={crim.anual}
                  geoLookup={geoLookup}
                  anoAtual={anoAtual}
                  titulo={`Detalhamento — ${geoLookup[filtros.municipio]?.municipio || filtros.municipio}`}
                />
              </ErrorBoundary>
            )}
          </div>
        )}
      </main>

      <Footer />
    </div>
  )
}

export default App
