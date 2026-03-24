import React from 'react'
import { Shield, ExternalLink } from 'lucide-react'
import { formatDate } from '../utils/format'

function Header({ metadata }) {
  const ultimaAtualizacao = metadata?.ultima_atualizacao

  return (
    <header className="bg-white border-b border-neutral-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 bg-alert-100 rounded-lg">
              <Shield className="w-6 h-6 text-alert-600" />
            </div>
            <div>
              <h1 className="font-display text-xl font-bold text-dark-900">
                Seguranca Parana
              </h1>
              <p className="text-sm text-dark-400">
                Painel de indicadores de seguranca publica
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4 text-sm">
            {ultimaAtualizacao && (
              <span className="text-dark-400">
                Atualizado em {formatDate(ultimaAtualizacao)}
              </span>
            )}
            <a
              href="https://www.datageo.pr.gov.br/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-alert-600 hover:text-alert-700 font-medium transition-colors"
            >
              DataGeo PR
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      </div>
    </header>
  )
}

export default Header
