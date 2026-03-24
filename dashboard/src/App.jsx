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
    dados,
    filtros,
    setFiltros,
    anos,
    mesorregioes,
    municipios,
    dadosFiltrados,
  } = useData()

  const [activeTab, setActiveTab] = useState('visao-geral')
  const [municipioSelecionado, setMunicipioSelecionado] = useState('')

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

  const metadata = dadosFiltrados?.metadata || {}
  const crim = dadosFiltrados?.criminalidade || {}
  const vl = dadosFiltrados?.violenciaLetal || {}
  const pat = dadosFiltrados?.patrimonio || {}
  const drogas = dadosFiltrados?.drogas || {}
  const atlas = dadosFiltrados?.atlas || {}
  const geojson = dadosFiltrados?.geojson || null

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
                dados={crim}
                violenciaLetal={vl}
                patrimonio={pat}
              />
            </ErrorBoundary>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <ErrorBoundary>
                <MapChart
                  geojson={geojson}
                  dados={crim}
                  indicador="vitimas"
                />
              </ErrorBoundary>

              <ErrorBoundary>
                <TimeSeriesChart
                  dados={crim.municipios}
                  titulo="Evolucao Temporal"
                />
              </ErrorBoundary>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <ErrorBoundary>
                <TreemapChart
                  dados={crim.municipios}
                  titulo="Composicao por Tipo de Crime"
                />
              </ErrorBoundary>

              <ErrorBoundary>
                <SankeyChart
                  dados={crim.municipios}
                  titulo="Fluxo: Tipo de Crime por Mesorregiao"
                />
              </ErrorBoundary>
            </div>

            <ErrorBoundary>
              <BarChart
                dados={crim.municipios}
                titulo="Top 10 Municipios"
                topN={10}
                horizontal
              />
            </ErrorBoundary>
          </div>
        )}

        {/* Violencia Letal */}
        {activeTab === 'violencia-letal' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <ErrorBoundary>
                <MapChart
                  geojson={geojson}
                  dados={vl}
                  indicador="homicidios"
                />
              </ErrorBoundary>

              <ErrorBoundary>
                <TimeSeriesChart
                  dados={vl.municipios}
                  titulo="Serie Temporal - Violencia Letal"
                />
              </ErrorBoundary>
            </div>

            <ErrorBoundary>
              <BarChart
                dados={vl.municipios}
                titulo="Homicidios por Municipio"
                topN={15}
                horizontal
              />
            </ErrorBoundary>

            <ErrorBoundary>
              <RankingTable
                dados={vl.municipios}
                titulo="Ranking - Violencia Letal"
              />
            </ErrorBoundary>
          </div>
        )}

        {/* Crimes Patrimoniais */}
        {activeTab === 'crimes-patrimoniais' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <ErrorBoundary>
                <MapChart
                  geojson={geojson}
                  dados={pat}
                  indicador="patrimonio"
                />
              </ErrorBoundary>

              <ErrorBoundary>
                <TimeSeriesChart
                  dados={pat.municipios}
                  titulo="Serie Temporal - Crimes Patrimoniais"
                />
              </ErrorBoundary>
            </div>

            <ErrorBoundary>
              <HeatmapChart
                dados={pat.municipios}
                titulo="Mapa de Calor: Mes x Tipo de Crime"
              />
            </ErrorBoundary>

            <ErrorBoundary>
              <RankingTable
                dados={pat.municipios}
                titulo="Ranking - Crimes Patrimoniais"
              />
            </ErrorBoundary>
          </div>
        )}

        {/* Drogas e Armas */}
        {activeTab === 'drogas-armas' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <ErrorBoundary>
                <TreemapChart
                  dados={drogas.municipios}
                  titulo="Composicao - Drogas e Armas"
                />
              </ErrorBoundary>

              <ErrorBoundary>
                <TimeSeriesChart
                  dados={drogas.municipios}
                  titulo="Serie Temporal - Drogas e Armas"
                />
              </ErrorBoundary>
            </div>

            <ErrorBoundary>
              <MapChart
                geojson={geojson}
                dados={drogas}
                indicador="drogas"
              />
            </ErrorBoundary>

            <ErrorBoundary>
              <RankingTable
                dados={drogas.municipios}
                titulo="Ranking - Drogas e Armas"
              />
            </ErrorBoundary>
          </div>
        )}

        {/* Serie Historica */}
        {activeTab === 'serie-historica' && (
          <div className="space-y-6">
            <ErrorBoundary>
              <TimeSeriesChart
                dados={atlas.series || atlas.municipios || []}
                titulo="Atlas Temporal da Criminalidade"
              />
            </ErrorBoundary>

            <ErrorBoundary>
              <BumpChart
                dados={crim.municipios}
                titulo="Ranking de Municipios ao Longo do Tempo"
                topN={10}
              />
            </ErrorBoundary>

            <div className="card">
              <h3 className="section-title">Marcos Historicos</h3>
              <div className="space-y-3">
                {(atlas.marcos || []).length > 0 ? (
                  atlas.marcos.map((marco, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-3 p-3 bg-neutral-50 rounded-lg"
                    >
                      <span className="text-sm font-display font-bold text-alert-600 whitespace-nowrap">
                        {marco.ano || marco.data || '-'}
                      </span>
                      <p className="text-sm text-dark-600">{marco.descricao || marco.evento || '-'}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-dark-400">
                    Marcos historicos serao exibidos quando disponiveis nos dados.
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Perfil Municipal */}
        {activeTab === 'perfil-municipal' && (
          <div className="space-y-6">
            <div className="card">
              <h3 className="section-title">Selecione um Municipio</h3>
              <select
                value={municipioSelecionado}
                onChange={(e) => setMunicipioSelecionado(e.target.value)}
                className="w-full max-w-md text-sm border border-neutral-200 rounded-lg px-3 py-2.5 bg-white focus:ring-2 focus:ring-alert-300 focus:border-alert-400 outline-none"
              >
                <option value="">Escolha um municipio...</option>
                {municipios.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>

            {municipioSelecionado && (
              <>
                <ErrorBoundary>
                  <RadarChart
                    dados={crim.municipios}
                    dadosEstado={crim.municipios}
                    municipioSelecionado={municipioSelecionado}
                    titulo={`Perfil Criminal - ${municipioSelecionado}`}
                  />
                </ErrorBoundary>

                <ErrorBoundary>
                  <RankingTable
                    dados={(crim.municipios || []).filter(
                      (d) => d.municipio === municipioSelecionado
                    )}
                    titulo={`Detalhamento - ${municipioSelecionado}`}
                  />
                </ErrorBoundary>
              </>
            )}
          </div>
        )}
      </main>

      <Footer />
    </div>
  )
}

export default App
