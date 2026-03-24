import React, { useRef, useEffect, useMemo } from 'react'
import * as d3 from 'd3'
import { formatNumber } from '../utils/format'

const COLORS = [
  '#ea580c', '#f97316', '#fb923c',
  '#14b8a6', '#0d9488', '#6366f1',
  '#0ea5e9', '#f59e0b', '#ef4444',
  '#8b5cf6', '#4f46e5', '#fdba74',
]

function SankeyChart({ dados, titulo, className = '' }) {
  const svgRef = useRef(null)
  const containerRef = useRef(null)

  const { nodes, links } = useMemo(() => {
    if (!dados || !Array.isArray(dados) || dados.length === 0) {
      return { nodes: [], links: [] }
    }

    const flows = {}
    dados.forEach((d) => {
      const crime = d.tipo_crime || d.natureza || 'Outros'
      const meso = d.mesorregiao || 'Desconhecida'
      const key = `${crime}|||${meso}`
      flows[key] = (flows[key] || 0) + (d.total || d.ocorrencias || d.vitimas || 0)
    })

    const crimeSet = new Set()
    const mesoSet = new Set()
    Object.keys(flows).forEach((key) => {
      const [crime, meso] = key.split('|||')
      crimeSet.add(crime)
      mesoSet.add(meso)
    })

    const crimes = [...crimeSet].sort()
    const mesos = [...mesoSet].sort()
    const nodeNames = [...crimes, ...mesos]
    const nodeMap = {}
    nodeNames.forEach((name, i) => {
      nodeMap[name] = i
    })

    const nodes = nodeNames.map((name) => ({ name }))
    const links = Object.entries(flows)
      .filter(([, value]) => value > 0)
      .map(([key, value]) => {
        const [crime, meso] = key.split('|||')
        return {
          source: nodeMap[crime],
          target: nodeMap[meso],
          value,
        }
      })

    return { nodes, links }
  }, [dados])

  useEffect(() => {
    if (nodes.length === 0 || !svgRef.current || !containerRef.current) return

    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()

    const margin = { top: 10, right: 120, bottom: 10, left: 120 }
    const { width: containerWidth } = containerRef.current.getBoundingClientRect()
    const width = containerWidth - margin.left - margin.right
    const height = 350

    svg
      .attr('width', containerWidth)
      .attr('height', height + margin.top + margin.bottom)

    const g = svg
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`)

    // Simple sankey-like layout
    const sourceNodes = [...new Set(links.map((l) => l.source))]
    const targetNodes = [...new Set(links.map((l) => l.target))]

    const sourceTotal = {}
    const targetTotal = {}
    links.forEach((l) => {
      sourceTotal[l.source] = (sourceTotal[l.source] || 0) + l.value
      targetTotal[l.target] = (targetTotal[l.target] || 0) + l.value
    })

    const totalValue = d3.sum(Object.values(sourceTotal))
    const nodeHeight = height - (sourceNodes.length - 1) * 4

    // Position source nodes
    let sy = 0
    const sourcePos = {}
    sourceNodes.forEach((s) => {
      const h = (sourceTotal[s] / totalValue) * nodeHeight
      sourcePos[s] = { y: sy, h }
      sy += h + 4
    })

    // Position target nodes
    let ty = 0
    const targetHeight = height - (targetNodes.length - 1) * 4
    const targetPos = {}
    targetNodes.forEach((t) => {
      const h = (targetTotal[t] / totalValue) * targetHeight
      targetPos[t] = { y: ty, h }
      ty += h + 4
    })

    const nodeWidth = 14

    // Draw links
    const sourceOffsets = {}
    const targetOffsets = {}
    sourceNodes.forEach((s) => { sourceOffsets[s] = 0 })
    targetNodes.forEach((t) => { targetOffsets[t] = 0 })

    links
      .sort((a, b) => b.value - a.value)
      .forEach((l) => {
        const sNode = sourcePos[l.source]
        const tNode = targetPos[l.target]
        const sH = (l.value / sourceTotal[l.source]) * sNode.h
        const tH = (l.value / targetTotal[l.target]) * tNode.h

        const sy0 = sNode.y + sourceOffsets[l.source]
        const ty0 = tNode.y + targetOffsets[l.target]

        sourceOffsets[l.source] += sH
        targetOffsets[l.target] += tH

        const path = d3.path()
        path.moveTo(nodeWidth, sy0)
        path.bezierCurveTo(
          width * 0.4, sy0,
          width * 0.6, ty0,
          width - nodeWidth, ty0,
        )
        path.lineTo(width - nodeWidth, ty0 + tH)
        path.bezierCurveTo(
          width * 0.6, ty0 + tH,
          width * 0.4, sy0 + sH,
          nodeWidth, sy0 + sH,
        )
        path.closePath()

        g.append('path')
          .attr('d', path.toString())
          .attr('fill', COLORS[l.source % COLORS.length])
          .attr('opacity', 0.35)
          .on('mouseover', function () {
            d3.select(this).attr('opacity', 0.6)
          })
          .on('mouseout', function () {
            d3.select(this).attr('opacity', 0.35)
          })
          .append('title')
          .text(`${nodes[l.source].name} → ${nodes[l.target].name}: ${formatNumber(l.value)}`)
      })

    // Draw source nodes
    sourceNodes.forEach((s) => {
      const pos = sourcePos[s]
      g.append('rect')
        .attr('x', 0)
        .attr('y', pos.y)
        .attr('width', nodeWidth)
        .attr('height', Math.max(pos.h, 2))
        .attr('fill', COLORS[s % COLORS.length])
        .attr('rx', 2)

      g.append('text')
        .attr('x', -6)
        .attr('y', pos.y + pos.h / 2)
        .attr('dy', '0.35em')
        .attr('text-anchor', 'end')
        .attr('font-size', '10px')
        .attr('fill', '#525258')
        .text(nodes[s].name.length > 18 ? nodes[s].name.slice(0, 18) + '...' : nodes[s].name)
    })

    // Draw target nodes
    targetNodes.forEach((t) => {
      const pos = targetPos[t]
      g.append('rect')
        .attr('x', width - nodeWidth)
        .attr('y', pos.y)
        .attr('width', nodeWidth)
        .attr('height', Math.max(pos.h, 2))
        .attr('fill', '#0d9488')
        .attr('rx', 2)

      g.append('text')
        .attr('x', width - nodeWidth + 20)
        .attr('y', pos.y + pos.h / 2)
        .attr('dy', '0.35em')
        .attr('font-size', '10px')
        .attr('fill', '#525258')
        .text(nodes[t].name.length > 18 ? nodes[t].name.slice(0, 18) + '...' : nodes[t].name)
    })
  }, [nodes, links])

  if (nodes.length === 0) {
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

export default SankeyChart
