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
