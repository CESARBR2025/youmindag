// YouMindAG — graphify installation and management

import { existsSync, readFileSync, statSync } from 'fs'
import { join } from 'path'
import { BOLD, GREEN, YELLOW, CYAN, RESET } from '../lib/utils.mjs'
import { maybeExecSync, getDryRun } from '../lib/fs-helpers.mjs'
import { readYoumindagData } from '../lib/vault.mjs'

export function getGraphifyVersion(cwd) {
  const data = readYoumindagData(cwd)
  if (data.graphifyVersion) return data.graphifyVersion
  const p = join(cwd, 'node_modules', '@sentropic', 'graphify', 'package.json')
  if (existsSync(p)) {
    try { return JSON.parse(readFileSync(p, 'utf-8')).version } catch {}
  }
  return null
}

export async function installGraphify(cwd, pkg) {
  let graphifyVersion = getGraphifyVersion(cwd)
  if (pkg) {
    console.log(`${BOLD}🔗 Instalando Graphify...${RESET}`)
    const tryInstall = (pkgSpec) => {
      try {
        maybeExecSync(`npm install ${pkgSpec}`, { cwd, stdio: 'pipe', timeout: 60000 })
        return true
      } catch { return false }
    }
    let installed = false
    const graphifyPkg = graphifyVersion
      ? `@sentropic/graphify@^${graphifyVersion}`
      : '@sentropic/graphify'
    installed = tryInstall(graphifyPkg)
    if (!installed && graphifyVersion) {
      console.log(`  ${YELLOW}⚠️  Falló pin v${graphifyVersion} — reintentando con latest...${RESET}`)
      installed = tryInstall('@sentropic/graphify')
      if (installed) graphifyVersion = null
    }
    if (installed) {
      const p = join(cwd, 'node_modules', '@sentropic', 'graphify', 'package.json')
      if (!getDryRun() && existsSync(p)) {
        graphifyVersion = JSON.parse(readFileSync(p, 'utf-8')).version
      }
      console.log(`  ${GREEN}✅ graphify ${graphifyVersion || ''} instalado${RESET}\n`)
    } else {
      console.log(`  ${YELLOW}⚠️  No se pudo instalar graphify${RESET}\n`)
    }
  }

  // Build graph
  const graphPath = join(cwd, '.graphify', 'graph.json')
  if (getDryRun() || existsSync(join(cwd, 'node_modules', '@sentropic', 'graphify'))) {
    console.log(`${BOLD}🌐 Construyendo grafo de conocimiento...${RESET}`)
    try {
      maybeExecSync('npx graphify detect . 2>/dev/null', { cwd, stdio: 'pipe', timeout: 30000 })
      maybeExecSync('npx graphify update . 2>&1 | tail -3', { cwd, stdio: 'pipe', timeout: 120000 })
      if (!getDryRun() && existsSync(graphPath)) {
        const graph = JSON.parse(readFileSync(graphPath, 'utf-8'))
        const nodes = graph.nodes?.length || 0
        const edges = graph.edges?.length || 0
        console.log(`  ${GREEN}✅ Grafo construido: ${nodes} nodos, ${edges} aristas${RESET}\n`)
      }
    } catch {
      console.log(`  ${YELLOW}⚠️  No se pudo construir el grafo automáticamente${RESET}\n`)
    }
  }

  // Studio visual
  const studioPath = join(cwd, 'graphify-visual', 'studio.html')
  if (!getDryRun() && existsSync(graphPath)) {
    if (!existsSync(studioPath)) {
      console.log(`${BOLD}🎨 Generando visualización interactiva...${RESET}`)
      try {
        maybeExecSync('npx graphify studio export ./graphify-visual 2>&1 | tail -3', { cwd, stdio: 'pipe', timeout: 60000 })
      } catch { /* ignore */ }
    }
    if (existsSync(studioPath)) {
      const size = Math.round(statSync(studioPath).size / 1024)
      console.log(`  ${GREEN}✅ Studio visual (${size} KB)${RESET}`)
      console.log(`  ${CYAN}   📊 Ruta: ${studioPath}${RESET}`)
      console.log(`  ${CYAN}   📊 Abrir: open "${studioPath}"${RESET}\n`)
    }
  }

  return graphifyVersion
}

export function graphifyQueryCompact(cwd, query, options = {}) {
  const graphPath = join(cwd, '.graphify', 'graph.json')
  const hasGraph = existsSync(graphPath)
  const hasGraphify = existsSync(join(cwd, 'node_modules', '@sentropic', 'graphify'))

  if (!hasGraph && !hasGraphify) {
    return { modules: [], dependencies: [], warnings: ['Graphify no instalado. Ejecuta youmindag sync'] }
  }

  try {
    const result = String(maybeExecSync(`npx graphify query "${query}" 2>/dev/null || echo ""`, {
      cwd, stdio: 'pipe', timeout: 15000, encoding: 'utf-8'
    })).trim()

    if (!result && hasGraph) {
      const graph = JSON.parse(readFileSync(graphPath, 'utf-8'))
      const nodes = (graph.nodes || []).filter(n =>
        (n.id || n.name || '').toLowerCase().includes(query.toLowerCase())
      )
      const limit = options.summary ? 10 : nodes.length
      const modules = nodes.slice(0, limit).map(n => n.id || n.name || String(n))

      let dependencies = []
      if (graph.edges) {
        const moduleIds = new Set(modules.map(m => m.toLowerCase()))
        dependencies = graph.edges
          .filter(e => {
            const src = (e.source || e.from || '').toLowerCase()
            const dst = (e.target || e.to || '').toLowerCase()
            return moduleIds.has(src) || moduleIds.has(dst)
          })
          .slice(0, limit * 2)
          .map(e => ({
            from: e.source || e.from || '',
            to: e.target || e.to || '',
            type: e.type || e.label || 'imports',
          }))
      }

      return { modules, dependencies, warnings: [] }
    }

    if (result) {
      const lines = result.split('\n').filter(Boolean)
      const limit = options.summary ? 10 : lines.length
      return {
        modules: lines.slice(0, limit),
        dependencies: [],
        warnings: [],
        rawOutput: options.json ? undefined : lines,
      }
    }

    return { modules: [], dependencies: [], warnings: ['Sin resultados para la consulta'] }
  } catch {
    if (hasGraph) {
      try {
        const graph = JSON.parse(readFileSync(graphPath, 'utf-8'))
        const nodes = (graph.nodes || []).filter(n =>
          (n.id || n.name || '').toLowerCase().includes(query.toLowerCase())
        )
        return {
          modules: nodes.slice(0, 10).map(n => n.id || n.name || String(n)),
          dependencies: [],
          warnings: ['graphify query falló — usando datos del grafo local'],
        }
      } catch {}
    }
    return { modules: [], dependencies: [], warnings: ['Error al consultar graphify'] }
  }
}

export function getGraphMeta(cwd) {
  const graphPath = join(cwd, '.graphify', 'graph.json')
  if (!existsSync(graphPath)) return null
  try {
    const graph = JSON.parse(readFileSync(graphPath, 'utf-8'))
    const stat = statSync(graphPath)
    return {
      nodes: graph.nodes?.length || 0,
      edges: graph.edges?.length || 0,
      updatedAt: stat.mtime.toISOString(),
      path: graphPath,
    }
  } catch {
    return null
  }
}
