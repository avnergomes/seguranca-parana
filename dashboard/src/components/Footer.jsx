import React from 'react'
import { Database, ExternalLink } from 'lucide-react'

function Footer() {
  return (
    <footer className="bg-white border-t border-neutral-200 mt-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <h3 className="font-display font-bold text-dark-800 text-sm mb-2 flex items-center gap-2">
              <Database className="w-4 h-4 text-alert-500" />
              Fontes de Dados
            </h3>
            <ul className="space-y-1.5 text-sm text-dark-500">
              <li>
                <a
                  href="https://www.datageo.pr.gov.br/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-alert-600 inline-flex items-center gap-1 transition-colors"
                >
                  DataGeo Parana <ExternalLink className="w-3 h-3" />
                </a>
              </li>
              <li>
                <a
                  href="https://www.seguranca.pr.gov.br/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-alert-600 inline-flex items-center gap-1 transition-colors"
                >
                  SESP-PR <ExternalLink className="w-3 h-3" />
                </a>
              </li>
              <li>
                <a
                  href="https://www.ibge.gov.br/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-alert-600 inline-flex items-center gap-1 transition-colors"
                >
                  IBGE <ExternalLink className="w-3 h-3" />
                </a>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="font-display font-bold text-dark-800 text-sm mb-2">
              Sobre o Projeto
            </h3>
            <p className="text-sm text-dark-400 leading-relaxed">
              Dashboard de dados abertos de seguranca publica do estado do
              Parana. Todos os dados sao publicos e obtidos de fontes oficiais.
            </p>
          </div>

          <div>
            <h3 className="font-display font-bold text-dark-800 text-sm mb-2">
              Aviso Legal
            </h3>
            <p className="text-sm text-dark-400 leading-relaxed">
              Este painel tem carater informativo e utiliza exclusivamente dados
              agregados. Nao substitui relatorios oficiais. Os dados podem
              conter defasagem em relacao as fontes primarias.
            </p>
          </div>
        </div>

        <div className="border-t border-neutral-200 mt-6 pt-4 text-center">
          <p className="text-xs text-dark-300">
            Seguranca Parana &mdash; Dados abertos para uma sociedade mais informada
          </p>
        </div>
      </div>
    </footer>
  )
}

export default Footer
