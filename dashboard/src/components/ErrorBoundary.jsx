import React from 'react'
import { AlertTriangle } from 'lucide-react'

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    console.error('[ErrorBoundary]', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="card flex flex-col items-center justify-center py-10 text-center">
          <AlertTriangle className="w-10 h-10 text-alert-500 mb-3" />
          <h3 className="font-display font-bold text-dark-800 mb-1">
            Erro ao carregar componente
          </h3>
          <p className="text-sm text-dark-400 max-w-md">
            Ocorreu um erro inesperado ao renderizar esta secao.
            Tente recarregar a pagina.
          </p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="mt-4 px-4 py-2 bg-alert-500 text-white text-sm font-medium rounded-lg hover:bg-alert-600 transition-colors"
          >
            Tentar novamente
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

export default ErrorBoundary
