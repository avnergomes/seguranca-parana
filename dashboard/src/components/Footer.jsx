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
              <a
                href="https://datageoparana.github.io"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-alert-600 inline-flex items-center gap-1 transition-colors"
              >
                Datageo Parana
                <ExternalLink className="w-3 h-3" />
              </a>
            </h3>
            <div className="flex flex-wrap gap-1.5">
              <a
                href="https://avnergomes.github.io/vbp-parana/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center px-2.5 py-1 text-[10px] rounded-full border border-slate-200 bg-white/70 text-slate-600 hover:text-alert-600 hover:border-alert-300 transition-colors"
              >
                VBP Parana
              </a>
              <a
                href="https://avnergomes.github.io/precos-diarios/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center px-2.5 py-1 text-[10px] rounded-full border border-slate-200 bg-white/70 text-slate-600 hover:text-alert-600 hover:border-alert-300 transition-colors"
              >
                Precos Diarios
              </a>
              <a
                href="https://avnergomes.github.io/precos-florestais/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center px-2.5 py-1 text-[10px] rounded-full border border-slate-200 bg-white/70 text-slate-600 hover:text-alert-600 hover:border-alert-300 transition-colors"
              >
                Precos Florestais
              </a>
              <a
                href="https://avnergomes.github.io/precos-de-terras/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center px-2.5 py-1 text-[10px] rounded-full border border-slate-200 bg-white/70 text-slate-600 hover:text-alert-600 hover:border-alert-300 transition-colors"
              >
                Precos de Terras
              </a>
              <a
                href="https://avnergomes.github.io/comexstat-parana/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center px-2.5 py-1 text-[10px] rounded-full border border-slate-200 bg-white/70 text-slate-600 hover:text-alert-600 hover:border-alert-300 transition-colors"
              >
                ComexStat Parana
              </a>
              <a
                href="https://avnergomes.github.io/emprego-agro-parana/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center px-2.5 py-1 text-[10px] rounded-full border border-slate-200 bg-white/70 text-slate-600 hover:text-alert-600 hover:border-alert-300 transition-colors"
              >
                Emprego Agro
              </a>
              <a
                href="https://avnergomes.github.io/censo-parana/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center px-2.5 py-1 text-[10px] rounded-full border border-slate-200 bg-white/70 text-slate-600 hover:text-alert-600 hover:border-alert-300 transition-colors"
              >
                Censo Parana
              </a>
              <a
                href="https://avnergomes.github.io/credito-rural-parana/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center px-2.5 py-1 text-[10px] rounded-full border border-slate-200 bg-white/70 text-slate-600 hover:text-alert-600 hover:border-alert-300 transition-colors"
              >
                Credito Rural
              </a>
              <a
                href="https://avnergomes.github.io/saude-parana/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center px-2.5 py-1 text-[10px] rounded-full border border-slate-200 bg-white/70 text-slate-600 hover:text-alert-600 hover:border-alert-300 transition-colors"
              >
                Saude Parana
              </a>
            </div>
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
