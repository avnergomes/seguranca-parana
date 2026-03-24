import React, { useRef, useEffect, useMemo } from 'react'
import * as d3 from 'd3'
import { nomeMes, getHeatColor, formatNumber } from '../utils/format'

function HeatmapChart({ dados, titulo, className = '' }) {
  const svgRef = useRef(null)
  const containerRef = useRef(null)

  const { matrix, crimes, meses, min, max } = useMemo(() => {
    if (!dados || !Array.isArray(dados) || dados.length === 0) {
      return { matrix: [], crimes: [], meses: [], min: 0, max: 0 }
    }

    const grid = {}
    const crimeSet = new Set()
    const mesSet = new Set()

    dados.forEach((d) => {
      const crime = d.tipo_crime || d.natureza || 'Outros'
      const mes = d.mes || 1
      crimeSet.add(crime)
      mesSet.add(mes)
      const key = `${crime}-${mes}`
      grid[key] = (grid[key] || 0) + (d.total || d.ocorrencias || d.vitimas || 0)
    })

    const crimes = [...crimeSet].sort()
    const meses = [...mesSet].sort((a, b) => a - b)
    const values = Object.values(grid)
    const min = Math.min(...values, 0)
    const max = Math.max(...values, 1)

    const matrix = []
    crimes.forEach((crime) => {
      meses.forEach((mes) => {
        matrix.push({
          crime,
          mes,
          value: grid[`${crime}-${mes}`] || 0,
        })
      })
    })

    return { matrix, crimes, meses, min, max }
  }, [dados])

  useEffect(() => {
    if (matrix.length === 0 || !svgRef.current || !containerRef.current) return

    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()

    const margin = { top: 10, right: 20, bottom: 40, left: 140 }
    const { width: containerWidth } = containerRef.current.getBoundingClientRect()
    const width = containerWidth - margin.left - margin.right
    const cellHeight = 28
    const height = crimes.length * cellHeight

    svg
      .attr('width', containerWidth)
      .attr('height', height + margin.top + margin.bottom)

    const g = svg
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`)

    const x = d3
      .scaleBand()
      .domain(meses)
      .range([0, width])
      .padding(0.05)

    const y = d3
      .scaleBand()
      .domain(crimes)
      .range([0, height])
      .padding(0.05)

    g.append('g')
      .attr('transform', `translate(0,${height})`)
      .call(d3.axisBottom(x).tickFormat((m) => nomeMes(m)))
      .selectAll('text')
      .attr('font-size', '10px')
      .attr('fill', '#737378')

    g.append('g')
      .call(d3.axisLeft(y))
      .selectAll('text')
      .attr('font-size', '10px')
      .attr('fill', '#737378')

    g.selectAll('.domain, .tick line').attr('stroke', '#e5e5e9')

    g.selectAll('rect.cell')
      .data(matrix)
      .join('rect')
      .attr('class', 'cell')
      .attr('x', (d) => x(d.mes))
      .attr('y', (d) => y(d.crime))
      .attr('width', x.bandwidth())
      .attr('height', y.bandwidth())
      .attr('fill', (d) => getHeatColor(d.value, min, max))
      .attr('rx', 3)
      .on('mouseover', function (event, d) {
        d3.select(this).attr('stroke', '#ea580c').attr('stroke-width', 2)
      })
      .on('mouseout', function () {
        d3.select(this).attr('stroke', 'none')
      })

    g.selectAll('rect.cell')
      .append('title')
      .text((d) => `${d.crime} - ${nomeMes(d.mes)}: ${formatNumber(d.value)}`)
  }, [matrix, crimes, meses, min, max])

  if (matrix.length === 0) {
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

export default HeatmapChart
