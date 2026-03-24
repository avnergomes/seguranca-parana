import React from 'react'
import { useData } from './hooks/useData'

function App() {
  const { loading, erro } = useData()

  if (loading) {
    return <div style={{padding: '40px', fontSize: '24px', color: 'blue'}}>Carregando dados...</div>
  }

  if (erro) {
    return <div style={{padding: '40px', fontSize: '24px', color: 'red'}}>Erro: {erro}</div>
  }

  return <div style={{padding: '40px', fontSize: '24px', color: 'green'}}>Dashboard OK!</div>
}

export default App
