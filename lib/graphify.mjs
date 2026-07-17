// YouMindAG — graphify installation and management

import { existsSync, readFileSync, statSync } from 'fs'
import { join } from 'path'
import { BOLD, GREEN, YELLOW, CYAN, RESET } from '../lib/utils.mjs'
import { maybeExecSync, getDryRun } from '../lib/fs-helpers.mjs'
import { readYoumindagData } from '../lib/vault.mjs'
import { runGraphify } from '../lib/exec.mjs'

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

// Filtra y prioriza nodos del grafo: excluye nodos de git (commits, ramas,
// merges), prefiere los que matchean la consulta y ordena por comunidad.
export function curateGraphNodes(nodes, query, { limit = 10 } = {}) {
  const q = (query || '').toLowerCase().normalize('NFC')
  const label = n => String(n.id || n.name || n.label || '')
  const isGit = n => {
    const src = String(n.src || n.source || '').toLowerCase()
    const type = String(n.type || '').toLowerCase()
    return src === 'git' || type.includes('commit') || type.includes('git')
  }

  let list = (nodes || []).filter(n => n && typeof n === 'object' && !isGit(n))
  if (q) {
    const matching = list.filter(n => {
      const t = `${label(n)} ${n.src || ''}`.toLowerCase().normalize('NFC')
      return t.includes(q)
    })
    if (matching.length > 0) list = matching
  }
  list.sort((a, b) => {
    const ca = Number.isFinite(Number(a.community)) ? Number(a.community) : Infinity
    const cb = Number.isFinite(Number(b.community)) ? Number(b.community) : Infinity
    if (ca !== cb) return ca - cb
    return label(a).localeCompare(label(b))
  })
  return list.slice(0, limit)
}

// Parsea el output de `graphify query` ("NODE x [src=y loc=z community=n]")
// a objetos nodo comparables con los de graph.json.
function parseCliNodes(raw) {
  const out = []
  for (const line of String(raw).split('\n')) {
    const m = line.match(/^NODE\s+(.+?)\s+\[src=([^\s\]]*)\s+loc=([^\s\]]*)\s+community=([^\s\]]*)\]/)
    if (m) out.push({ id: m[1], src: m[2], loc: m[3], community: Number(m[4]) })
  }
  return out
}

function formatNodeLabel(n) {
  const name = n.id || n.name || ''
  return n.src && n.src !== 'git' && n.src !== name ? `${name} — ${n.src}` : name
}

export function graphifyQueryCompact(cwd, query, options = {}) {
  const limit = options.summary ? 10 : (options.limit || 25)
  const graphPath = join(cwd, '.graphify', 'graph.json')
  const hasGraph = existsSync(graphPath)
  const hasGraphify = existsSync(join(cwd, 'node_modules', '@sentropic', 'graphify'))

  if (!hasGraph && !hasGraphify) {
    return { modules: [], dependencies: [], warnings: ['Graphify no instalado. Ejecuta youmindag sync'] }
  }

  // 1) Consulta vía CLI de graphify (sin shell, args como array)
  if (hasGraphify) {
    try {
      const raw = runGraphify(cwd, ['query', query])
      const cliNodes = parseCliNodes(raw)
      if (cliNodes.length > 0) {
        const curated = curateGraphNodes(cliNodes, query, { limit })
        if (curated.length > 0) {
          return { modules: curated.map(formatNodeLabel), dependencies: [], warnings: [] }
        }
      }
    } catch { /* cae al fallback local */ }
  }

  // 2) Fallback: grafo local
  if (hasGraph) {
    try {
      const graph = JSON.parse(readFileSync(graphPath, 'utf-8'))
      const curated = curateGraphNodes(graph.nodes || [], query, { limit })
      const modules = curated.map(formatNodeLabel)

      let dependencies = []
      if (graph.edges && curated.length > 0) {
        const ids = new Set(curated.map(n => String(n.id || n.name || '').toLowerCase()))
        dependencies = graph.edges
          .filter(e => {
            const src = (e.source || e.from || '').toLowerCase()
            const dst = (e.target || e.to || '').toLowerCase()
            return ids.has(src) || ids.has(dst)
          })
          .slice(0, limit * 2)
          .map(e => ({
            from: e.source || e.from || '',
            to: e.target || e.to || '',
            type: e.type || e.label || 'imports',
          }))
      }

      if (modules.length > 0) return { modules, dependencies, warnings: [] }
    } catch { /* sigue */ }
  }

  return { modules: [], dependencies: [], warnings: ['Sin resultados para la consulta'] }
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
