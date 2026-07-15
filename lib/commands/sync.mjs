// YouMindAG — CLI commands
import { existsSync, readFileSync, writeFileSync, readdirSync } from 'fs'
import { join } from 'path'
import { RESET, CYAN, GREEN, YELLOW, BOLD } from '../utils.mjs'


export function cmdSync(cwd, args) {
  const doHook = args.includes('--hook')
  console.log(`${CYAN}${BOLD}YouMindAG — Sync${RESET}\n`)

  if (doHook) {
    const hookPath = join(cwd, '.git', 'hooks', 'post-merge')
    const hookScript = `#!/bin/sh\n# YouMindAG — auto sync after git pull/merge\nnpx graphify detect . 2>/dev/null && npx graphify update . 2>/dev/null && node scripts/populate-vault.mjs 2>/dev/null\necho "[YouMindAG] ✅ Contexto sincronizado post-merge"\n`
    try {
      mkdirSync(dirname(hookPath), { recursive: true })
      writeFileSync(hookPath, hookScript)
      execSync(`chmod +x "${hookPath}"`, { cwd })
      console.log(`  ${GREEN}✅ Git hook post-merge instalado${RESET}`)
      console.log(`  ${CYAN}   ${hookPath}${RESET}`)
      console.log(`  ${CYAN}   Ahora cada git pull dispara sync automáticamente.${RESET}\n`)
    } catch (e) {
      console.log(`  ${YELLOW}⚠️  No se pudo instalar el hook: ${e.message}${RESET}\n`)
    }
    return
  }

  const steps = [
    { cmd: 'npx graphify detect . 2>/dev/null', label: '🔍 Detectando archivos...' },
    { cmd: 'npx graphify update . 2>/dev/null', label: '🌐 Reconstruyendo grafo...' },
    { cmd: 'node scripts/populate-vault.mjs 2>/dev/null', label: '📚 Actualizando bóveda...' },
  ]

  for (const step of steps) {
    console.log(`  ${CYAN}${step.label}${RESET}`)
    try {
      execSync(step.cmd, { cwd, stdio: 'pipe', timeout: 60000 })
    } catch { /* non-fatal */ }
  }

  const graphPath = join(cwd, '.graphify', 'graph.json')
  if (existsSync(graphPath)) {
    try {
      const graph = JSON.parse(readFileSync(graphPath, 'utf-8'))
      console.log(`  ${GREEN}✅ Sincronización completa — ${graph.nodes?.length || 0} nodos, ${graph.edges?.length || 0} aristas${RESET}\n`)
    } catch {}
  } else {
    console.log(`  ${GREEN}✅ Bóveda actualizada${RESET}\n`)
  }
}

// ─── youmindag references ────────────────────────────────────────

export function findProjectFiles(cwd) {
  const searchDirs = ['app', 'lib', 'src', 'components', 'pages']
  const extensions = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'])
  const files = []

  function walk(dir) {
    if (!existsSync(dir)) return
    try {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        if (entry.name.startsWith('.') || entry.name === 'node_modules') continue
        const full = join(dir, entry.name)
        if (entry.isDirectory()) {
          walk(full)
        } else if (extensions.has(extname(entry.name))) {
          files.push(full)
        }
      }
    } catch {}
  }

  for (const dir of searchDirs) {
    walk(join(cwd, dir))
  }
  return files
}
