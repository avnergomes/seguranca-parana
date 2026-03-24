import React, { useRef, useEffect, useMemo } from 'react'
import * as d3 from 'd3'
import { formatNumber } from '../utils/format'

const COLORS = [
  '#ea580c', '#f97316', '#fb923c', '#fdba74',
  '#14b8a6', '#0d9488', '#6366f1', '#4f46e5',
  '#0ea5e9', '#f59e0b', '#ef4444', '#8b5cf6',
]

function TreemapChart({ dados, titulo, className = '' }) {
  const svgRef = useRef(null)
  const containerRef = useRef(null)

  const treeData = useMemo(() => {
    if (!dados || !Array.isArray(dados) || dados.length === 0) return null

    const grouped = {}
    dados.forEach((d) => {
      const tipo = d.tipo_crime || d.natureza || d.indicador || 'Outros'
      const valor = d.total || d.ocorrencias || d.vitimas || 0
      grouped[tipo] = (grouped[tipo] || 0) + valor
    })

    return {
      name: 'root',
      children: Object.entries(grouped)
        .map(([name, value]) => ({ name, value }))
        .filter((d) => d.value > 0)
        .sort((a, b) => b.value - a.value),
    }
  }, [dados])

  useEffect(() => {
    if (!treeData || !svgRef.current || !containerRef.current) return

    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()

    const { width } = containerRef.current.getBoundingClientRect()
    const height = 300

    svg.attr('width', width).attr('height', height)

    const root = d3
      .hierarchy(treeData)
      .sum((d) => d.value)
      .sort((a, b) => b.value - a.value)

    d3.treemap()
      .size([width, height])
      .padding(2)
      .round(true)(root)

    const nodes = svg
      .selectAll('g')
      .data(root.leaves())
      .join('g')
      .attr('transform', (d) => `translate(${d.x0},${d.y0})`)

    nodes
      .append('rect')
      .attr('width', (d) => Math.max(0, d.x1 - d.x0))
      .attr('height', (d) => Math.max(0, d.y1 - d.y0))
      .attr('fill', (_, i) => COLORS[i % COLORS.length])
      .attr('rx', 4)
      .attr('opacity', 0.85)
      .on('mouseover', function () {
        d3.select(this).attr('opacity', 1)
      })
      .on('mouseout', function () {
        d3.select(this).attr('opacity', 0.85)
      })

    nodes
      .append('clipPath')
      .attr('id', (_, i) => `clip-${i}`)
      .append('rect')
      .attr('width', (d) => Math.max(0, d.x1 - d.x0))
      .attr('height', (d) => Math.max(0, d.y1 - d.y0))

    nodes
      .filter((d) => d.x1 - d.x0 > 60 && d.y1 - d.y0 > 30)
      .append('text')
      .attr('clip-path', (_, i) => `url(#clip-${i})`)
      .attr('x', 6)
      .attr('y', 16)
      .attr('fill', 'white')
      .attr('font-size', '11px')
      .attr('font-weight', '600')
      .text((d) => d.data.name)

    nodes
      .filter((d) => d.x1 - d.x0 > 60 && d.y1 - d.y0 > 45)
      .append('text')
      .attr('clip-path', (_, i) => `url(#clip-${i})`)
      .attr('x', 6)
      .attr('y', 32)
      .attr('fill', 'rgba(255,255,255,0.8)')
      .attr('font-size', '10px')
      .text((d) => formatNumber(d.value))

    // Tooltip
    nodes.append('title').text((d) => `${d.data.name}: ${formatNumber(d.value)}`)
  }, [treeData])

  if (!treeData) {
    return (
      <div className={`card flex items-center justify-center h-64 text-dark-400 text-sm ${className}`}>
        Sem dados para exibir
      </div>
    )
  }

  return (
    <div className={`card ${className}`} ref={containerRef}>
      {titulo && <h3 className="section-title">{titulo}</h3>}
      <svg ref={svgRef} className="w-full" />
    </div>
  )
}

export default TreemapChart
