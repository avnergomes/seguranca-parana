import React, { useRef, useEffect, useMemo } from 'react'
import * as d3 from 'd3'

const COLORS = [
  '#ea580c', '#f97316', '#14b8a6', '#6366f1',
  '#0ea5e9', '#f59e0b', '#ef4444', '#8b5cf6',
  '#0d9488', '#fb923c',
]

function BumpChart({ dados, titulo, topN = 10, className = '' }) {
  const svgRef = useRef(null)
  const containerRef = useRef(null)

  const { series, years } = useMemo(() => {
    if (!dados || !Array.isArray(dados) || dados.length === 0) {
      return { series: [], years: [] }
    }

    // Group by year and rank municipalities by taxa_100k
    const byYear = {}
    dados.forEach((d) => {
      const ano = d.ano
      if (!ano) return
      if (!byYear[ano]) byYear[ano] = []
      byYear[ano].push({
        municipio: d.municipio,
        value: d.taxa_100k ?? d.taxa ?? d.ocorrencias ?? 0,
      })
    })

    const years = Object.keys(byYear).map(Number).sort((a, b) => a - b)

    // Rank within each year
    const rankings = {}
    years.forEach((year) => {
      const sorted = byYear[year].sort((a, b) => b.value - a.value)
      sorted.forEach((item, i) => {
        if (!rankings[item.municipio]) rankings[item.municipio] = {}
        rankings[item.municipio][year] = i + 1
      })
    })

    // Get top N municipalities (those that appear in top N most frequently)
    const freq = {}
    Object.entries(rankings).forEach(([mun, yearRanks]) => {
      freq[mun] = Object.values(yearRanks).filter((r) => r <= topN).length
    })

    const topMunicipios = Object.entries(freq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, topN)
      .map(([mun]) => mun)

    const series = topMunicipios.map((mun) => ({
      name: mun,
      ranks: years.map((y) => ({
        year: y,
        rank: rankings[mun]?.[y] ?? null,
      })),
    }))

    return { series, years }
  }, [dados, topN])

  useEffect(() => {
    if (series.length === 0 || !svgRef.current || !containerRef.current) return

    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()

    const margin = { top: 20, right: 120, bottom: 30, left: 40 }
    const { width: containerWidth } = containerRef.current.getBoundingClientRect()
    const width = containerWidth - margin.left - margin.right
    const height = 350

    svg
      .attr('width', containerWidth)
      .attr('height', height + margin.top + margin.bottom)

    const g = svg
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`)

    const x = d3.scalePoint().domain(years).range([0, width])
    const y = d3.scaleLinear().domain([1, topN]).range([0, height])

    g.append('g')
      .attr('transform', `translate(0,${height + 10})`)
      .call(d3.axisBottom(x).tickFormat(String))
      .selectAll('text')
      .attr('font-size', '10px')
      .attr('fill', '#737378')

    g.append('g')
      .call(d3.axisLeft(y).ticks(topN).tickFormat((d) => `#${d}`))
      .selectAll('text')
      .attr('font-size', '10px')
      .attr('fill', '#737378')

    g.selectAll('.domain, .tick line').attr('stroke', '#e5e5e9')

    const line = d3
      .line()
      .defined((d) => d.rank != null)
      .x((d) => x(d.year))
      .y((d) => y(d.rank))
      .curve(d3.curveBumpX)

    series.forEach((s, i) => {
      const color = COLORS[i % COLORS.length]

      g.append('path')
        .datum(s.ranks.filter((d) => d.rank != null))
        .attr('d', line)
        .attr('fill', 'none')
        .attr('stroke', color)
        .attr('stroke-width', 2.5)
        .attr('opacity', 0.8)

      s.ranks
        .filter((d) => d.rank != null)
        .forEach((d) => {
          g.append('circle')
            .attr('cx', x(d.year))
            .attr('cy', y(d.rank))
            .attr('r', 4)
            .attr('fill', color)
            .attr('stroke', 'white')
            .attr('stroke-width', 1.5)
        })

      // Label at the end
      const last = s.ranks.filter((d) => d.rank != null).at(-1)
      if (last) {
        g.append('text')
          .attr('x', x(last.year) + 8)
          .attr('y', y(last.rank))
          .attr('dy', '0.35em')
          .attr('font-size', '10px')
          .attr('fill', color)
          .attr('font-weight', '600')
          .text(s.name.length > 14 ? s.name.slice(0, 14) + '...' : s.name)
      }
    })

    // Tooltip title
    series.forEach((s) => {
      s.ranks.forEach((d) => {
        if (d.rank == null) return
        g.append('title').text(`${s.name} (${d.year}): #${d.rank}`)
      })
    })
  }, [series, years, topN])

  if (series.length === 0) {
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

export default BumpChart
