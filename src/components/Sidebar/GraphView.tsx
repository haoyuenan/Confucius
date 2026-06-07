import { useEffect, useRef, useState } from 'react'
import * as d3 from 'd3'
import { useKnowledgeStore } from '../../stores/knowledge-store'
import { useTabStore } from '../../stores/tab-store'
import * as bridge from '../../services/electron-bridge'

interface GraphNode extends d3.SimulationNodeDatum {
  id: string
  isCurrent?: boolean
}

interface GraphLink extends d3.SimulationLinkDatum<GraphNode> {
  resolved?: boolean
}

export function GraphView() {
  const svgRef = useRef<SVGSVGElement>(null)
  const { graphData, loadGraph } = useKnowledgeStore()
  const activeTab = useTabStore(s => s.activeTab())
  const openFile = useTabStore(s => s.openFile)
  const [mode, setMode] = useState<'global' | 'local'>('global')

  useEffect(() => {
    loadGraph(mode === 'local' && activeTab?.filePath ? activeTab.filePath : undefined)
  }, [mode, activeTab?.filePath, loadGraph])

  useEffect(() => {
    if (!svgRef.current || graphData.nodes.length === 0) return

    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()

    const width = svgRef.current.clientWidth || 400
    const height = 500

    const currentPath = activeTab?.filePath?.replace(/\\/g, '/') || ''
    const currentRel = currentPath.replace(/^.*[/\\]/, '')

    const nodes: GraphNode[] = graphData.nodes.map(id => ({
      id,
      isCurrent: id === currentRel || id === currentPath,
    }))
    const links: GraphLink[] = graphData.links.map(l => ({
      source: l.source,
      target: l.targetPath || l.target,
      resolved: l.resolved,
    }))

    const simulation = d3.forceSimulation<GraphNode>(nodes)
      .force('link', d3.forceLink<GraphNode, GraphLink>(links).id(d => d.id).distance(80))
      .force('charge', d3.forceManyBody().strength(-150))
      .force('center', d3.forceCenter(width / 2, height / 2))

    const g = svg.append('g')

    const linkElements = g.append('g')
      .selectAll<SVGLineElement, GraphLink>('line')
      .data(links)
      .join('line')
      .attr('stroke', d => d.resolved !== false ? '#94a3b8' : '#d1d5db')
      .attr('stroke-opacity', 0.6)
      .attr('stroke-width', 1.5)
      .attr('stroke-dasharray', d => d.resolved !== false ? 'none' : '4,2')

    const nodeElements = g.append('g')
      .selectAll<SVGCircleElement, GraphNode>('circle')
      .data(nodes)
      .join('circle')
      .attr('r', d => d.isCurrent ? 10 : 7)
      .attr('fill', d => d.isCurrent ? '#3b82f6' : '#94a3b8')
      .attr('stroke', '#fff')
      .attr('stroke-width', 2)
      .style('cursor', 'pointer')

    const labelElements = g.append('g')
      .selectAll<SVGTextElement, GraphNode>('text')
      .data(nodes)
      .join('text')
      .text(d => d.id.split('/').pop() || d.id)
      .attr('font-size', 11)
      .attr('dx', 12)
      .attr('dy', 4)
      .style('pointer-events', 'none')
      .style('fill', 'var(--text-color, #333)')

    nodeElements.on('click', async (_event: any, d: GraphNode) => {
      try {
        const file = await bridge.readFile(d.id)
        openFile(file.filePath, file.content)
      } catch {
        // file deleted or unresolvable
      }
    })

    nodeElements.append('title')
      .text(d => d.id)

    // Zoom
    svg.call(d3.zoom<SVGSVGElement, unknown>()
      .extent([[0, 0], [width, height]])
      .scaleExtent([0.3, 4])
      .on('zoom', (event) => {
        g.attr('transform', event.transform)
      }))

    simulation.on('tick', () => {
      linkElements
        .attr('x1', d => (d.source as GraphNode).x ?? 0)
        .attr('y1', d => (d.source as GraphNode).y ?? 0)
        .attr('x2', d => (d.target as GraphNode).x ?? 0)
        .attr('y2', d => (d.target as GraphNode).y ?? 0)

      nodeElements
        .attr('cx', d => d.x ?? 0)
        .attr('cy', d => d.y ?? 0)

      labelElements
        .attr('x', d => d.x ?? 0)
        .attr('y', d => d.y ?? 0)
    })

    return () => { simulation.stop() }
  }, [graphData, activeTab, openFile])

  return (
    <div className="sidebar-panel graph-panel">
      <div className="sidebar-section" style={{ display: 'flex', gap: 4, padding: '4px 0' }}>
        <button
          className={`sidebar-graph-toggle ${mode === 'global' ? 'active' : ''}`}
          onClick={() => setMode('global')}
        >
          全局
        </button>
        <button
          className={`sidebar-graph-toggle ${mode === 'local' ? 'active' : ''}`}
          onClick={() => setMode('local')}
        >
          局部
        </button>
      </div>
      <svg ref={svgRef} width="100%" height={500} style={{ overflow: 'visible' }} />
    </div>
  )
}
