#!/usr/bin/env node
// scripts/ab-test.mjs — YouMindAG A/B Test
// Simula consumo de tokens SIN y CON YouMindAG usando datos reales del proyecto.
//
// Uso: node scripts/ab-test.mjs

import { existsSync, readFileSync, readdirSync, statSync } from 'fs'
import { join, dirname, extname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const GRAPH_PATH = join(ROOT, '.graphify', 'graph.json')
const BOVEDA_DIR = join(ROOT, 'boveda')
const AGENTS_PATH = join(ROOT, 'AGENTS.md')

const RESET = '\x1b[0m'
const CYAN = '\x1b[36m'
const GREEN = '\x1b[32m'
const YELLOW = '\x1b[33m'
const RED = '\x1b[31m'
const BOLD = '\x1b[1m'
const MAGENTA = '\x1b[35m'

function formatNumber(n) { return n.toLocaleString('en-US') }
function charsToTokens(c) { return Math.round(c / 4) }

// ─── Collect real project data ───

function collectSourceFiles() {
  const ignored = new Set(['node_modules', '.git', 'boveda', '.graphify', 'graphify-visual', '.next', 'dist', 'build', '.cache', '.youmindag', 'scripts'])
  const exts = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.py', '.go', '.rs', '.rb', '.php'])
  const files = []
  
  function walk(dir) {
    if (!existsSync(dir)) return
    try {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        if (entry.name.startsWith('.') || ignored.has(entry.name)) continue
        const full = join(dir, entry.name)
        if (entry.isDirectory()) { walk(full); continue }
        if (exts.has(extname(entry.name).toLowerCase())) {
          try {
            const content = readFileSync(full, 'utf-8')
            files.push({ path: full.replace(ROOT + '/', ''), size: content.length, lines: content.split('\n').length })
          } catch {}
        }
      }
    } catch {}
  }
  walk(ROOT)
  files.sort((a, b) => b.size - a.size)
  return files
}

function collectBovedaDocs() {
  const docs = []
  if (!existsSync(BOVEDA_DIR)) return docs
  function walk(dir) {
    try {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name)
        if (entry.isDirectory()) { walk(full); continue }
        if (entry.name.endsWith('.md')) {
          try { docs.push({ path: entry.name, size: readFileSync(full, 'utf-8').length }) } catch {}
        }
      }
    } catch {}
  }
  walk(BOVEDA_DIR)
  return docs
}

function getGraphStats() {
  if (!existsSync(GRAPH_PATH)) return { nodes: 0, edges: 0 }
  try {
    const g = JSON.parse(readFileSync(GRAPH_PATH, 'utf-8'))
    return { nodes: g.nodes?.length || 0, edges: g.edges?.length || 0 }
  } catch { return { nodes: 0, edges: 0 } }
}

function getAgentsSize() {
  if (!existsSync(AGENTS_PATH)) return 0
  try { return readFileSync(AGENTS_PATH, 'utf-8').length } catch { return 0 }
}

// ─── Scenario A: SIN YouMindAG (Discovery Mode) ───

function simulateWithoutYoumindag(files) {
  // The agent has ZERO context. Must discover everything from scratch.
  // Typical research task pattern:
  //   1. ls/find to explore directories (2-3 calls)
  //   2. grep for keywords (3-5 rounds, many false positives)
  //   3. Read promising files (~25-35% of all files)
  //   4. Follow-up grep based on discoveries (1-2 more rounds)
  //   5. Re-read files after new discoveries

  const steps = []
  const totalFiles = files.length

  // Step 1: Directory exploration
  const lsCalls = totalFiles > 50 ? 3 : totalFiles > 15 ? 2 : 1
  for (let i = 0; i < lsCalls; i++) {
    const dirTokens = 30 + Math.floor(Math.random() * 20) // ~30-50 tokens per listing
    steps.push({ tool: 'ls/find', tokens: dirTokens, desc: `Exploración de directorios #${i + 1}` })
  }

  // Step 2: Initial greps (blind search)
  const grepRounds = Math.max(2, Math.min(4, Math.floor(totalFiles / 40)))
  for (let i = 0; i < grepRounds; i++) {
    const grepInput = 15 + Math.floor(Math.random() * 25)
    const grepOutput = Math.round(totalFiles * 10 + Math.random() * 150)
    steps.push({ tool: 'grep', tokens: grepInput + grepOutput, desc: `Búsqueda grep #${i + 1}` })
  }

  // Step 3: Read files found by grep (capped, only partial reads)
  const readPct = Math.max(0.10, Math.min(0.25, 15 / totalFiles))
  const filesToRead = Math.max(3, Math.min(15, Math.round(totalFiles * readPct)))
  const shuffled = [...files].sort(() => Math.random() - 0.5)
  const toRead = shuffled.slice(0, filesToRead)
  for (const f of toRead) {
    // Agent reads ~60% of file content on average (not the whole file)
    const effectiveSize = Math.round(f.size * 0.6)
    steps.push({ tool: 'read', tokens: charsToTokens(effectiveSize), desc: `Lectura: ${f.path}` })
  }

  // Step 4: Second round of grep (follow-up discoveries)
  const followUpGreps = Math.min(2, grepRounds)
  for (let i = 0; i < followUpGreps; i++) {
    const grepInput = 20 + Math.floor(Math.random() * 25)
    const grepOutput = Math.round(totalFiles * 8 + Math.random() * 80)
    steps.push({ tool: 'grep', tokens: grepInput + grepOutput, desc: `Grep follow-up #${i + 1}` })
  }

  // Step 5: Read follow-up files (fewer this time)
  const reReadCount = Math.max(1, Math.floor(filesToRead * 0.25))
  const remaining = [...files].filter(f => !toRead.includes(f)).sort(() => Math.random() - 0.5).slice(0, reReadCount)
  for (const f of remaining) {
    const effectiveSize = Math.round(f.size * 0.5)
    steps.push({ tool: 'read', tokens: charsToTokens(effectiveSize), desc: `Lectura follow-up: ${f.path}` })
  }

  // Overhead from the agent thinking/processing (LLM response tokens for each step)
  const llmOverhead = steps.length * 60 // ~60 tokens of reasoning per step
  
  return { steps, totals: { 
    tokens: steps.reduce((s, st) => s + st.tokens, 0) + llmOverhead,
    grepCalls: steps.filter(s => s.tool === 'grep').length,
    readCalls: steps.filter(s => s.tool === 'read').length,
    lsCalls: steps.filter(s => s.tool === 'ls/find').length,
    overhead: llmOverhead,
  }}
}

// ─── Scenario B: CON YouMindAG (Context Mode) ───

function simulateWithYoumindag(files, bovedaDocs, graphNodes, agentsSize) {
  // Agent has context pre-loaded. Pattern:
  //   1. Read AGENTS.md rules (amortized across tasks)
  //   2. Read 1-2 relevant boveda docs (guided by graphify)
  //   3. 1 graphify query to find exact files
  //   4. Read 3-8 targeted files (not 30% of all files)
  //   5. Optional 1 follow-up read

  const steps = []

  // Step 1: AGENTS.md (amortized — 20% per task)
  const agentsTokens = Math.round(charsToTokens(agentsSize) * 0.20)
  steps.push({ tool: 'AGENTS.md', tokens: agentsTokens, desc: 'Reglas de oro (amortizado)' })

  // Step 2: Boveda docs (1-2 targeted docs)
  const bovedaToRead = Math.min(2, bovedaDocs.length)
  const shuffledBoveda = [...bovedaDocs].sort(() => Math.random() - 0.5)
  for (let i = 0; i < bovedaToRead; i++) {
    const doc = shuffledBoveda[i]
    steps.push({ tool: 'boveda', tokens: charsToTokens(doc.size), desc: `Doc: ${doc.path}` })
  }

  // Step 3: Graphify query
  if (graphNodes > 0) {
    steps.push({ tool: 'graphify q', tokens: 300, desc: 'Query al grafo de dependencias' })
  }

  // Step 4: Targeted reads (3-8 files, reading only relevant parts ~25%)
  const targetCount = Math.max(3, Math.min(8, Math.round(files.length * 0.05)))
  const targetPool = [...files].sort(() => Math.random() - 0.5)
  const toRead = targetPool.slice(0, targetCount)
  for (const f of toRead) {
    const effectiveSize = Math.round(f.size * 0.25)
    steps.push({ tool: 'read', tokens: charsToTokens(effectiveSize), desc: `Lectura dirigida: ${f.path}` })
  }

  // Step 5: Maybe 1 quick follow-up read
  if (targetCount > 3) {
    const remaining = targetPool.slice(targetCount, targetCount + 1)
    for (const f of remaining) {
      steps.push({ tool: 'read', tokens: Math.round(charsToTokens(f.size) * 0.10), desc: `Re-lectura rápida: ${f.path}` })
    }
  }

  const llmOverhead = steps.length * 40 // Less thinking because context is pre-digested

  return { steps, totals: {
    tokens: steps.reduce((s, st) => s + st.tokens, 0) + llmOverhead,
    grepCalls: 0,
    readCalls: steps.filter(s => s.tool === 'read').length,
    graphifyCalls: steps.filter(s => s.tool === 'graphify q').length,
    bovedaDocs: steps.filter(s => s.tool === 'boveda').length,
    overhead: llmOverhead,
  }}
}

// ─── Main ───

const files = collectSourceFiles()
const bovedaDocs = collectBovedaDocs()
const graphStats = getGraphStats()
const agentsSize = getAgentsSize()

const a = simulateWithoutYoumindag(files)
const b = simulateWithYoumindag(files, bovedaDocs, graphStats.nodes, agentsSize)

const savings = a.totals.tokens - b.totals.tokens
const savingsPct = Math.round((savings / a.totals.tokens) * 100)

const youmindagInstalled = existsSync(join(ROOT, '.youmindag.json'))

console.log(`\n${BOLD}${MAGENTA}  ╔════════════════════════════════════════╗${RESET}`)
console.log(`${BOLD}${MAGENTA}  ║${RESET}     ${BOLD}YouMindAG A/B Test — Real Data${RESET}${MAGENTA}      ║${RESET}`)
console.log(`${BOLD}${MAGENTA}  ╚════════════════════════════════════════╝${RESET}\n`)

console.log(`  ${BOLD}📦 Proyecto:${RESET} ${files.length} archivos source, ${formatNumber(files.reduce((s, f) => s + f.lines, 0))} líneas`)
console.log(`  ${BOLD}📚 Bóveda:${RESET} ${bovedaDocs.length} docs, ${graphStats.nodes > 0 ? `grafo ${formatNumber(graphStats.nodes)} nodos` : 'sin grafo'}`)
console.log(`  ${BOLD}🧠 YouMindAG:${RESET} ${youmindagInstalled ? `${GREEN}instalado${RESET}` : `${RED}no instalado${RESET}`}\n`)

// ─── Side-by-side ───
console.log(`  ${BOLD}🔬 Simulación de tarea típica${RESET}: "Investiga el flujo de autenticación"\n`)

// Tool call summary
console.log(`  ${RED}${BOLD}  ── SIN YouMindAG (Discovery Mode) ──${RESET}`)
console.log(`  ${RED}  │ Greps: ${a.totals.grepCalls}  │ Reads: ${a.totals.readCalls}  │ ls/find: ${a.totals.lsCalls} │${RESET}`)
console.log(`  ${RED}  │ Overhead LLM: ${formatNumber(a.totals.overhead)} tokens${RESET}`)
console.log(`  ${RED}  │ Total: ${formatNumber(a.totals.tokens)} tokens${RESET}\n`)

console.log(`  ${GREEN}${BOLD}  ── CON YouMindAG (Context Mode) ──${RESET}`)
console.log(`  ${GREEN}  │ Greps: ${b.totals.grepCalls}  │ Reads: ${b.totals.readCalls}  │ graphify: ${b.totals.graphifyCalls}  │ boveda: ${b.totals.bovedaDocs} │${RESET}`)
console.log(`  ${GREEN}  │ Overhead LLM: ${formatNumber(b.totals.overhead)} tokens${RESET}`)
console.log(`  ${GREEN}  │ Total: ${formatNumber(b.totals.tokens)} tokens${RESET}\n`)

// ─── Comparison ───
console.log(`  ${CYAN}${BOLD}  ═══ COMPARACIÓN ═══${RESET}\n`)
console.log(`  ┌──────────────────────────────┬───────────┬───────────┐`)
console.log(`  │                              │ ${RED}SIN${RESET}       │ ${GREEN}CON${RESET}       │`)
console.log(`  ├──────────────────────────────┼───────────┼───────────┤`)
console.log(`  │ Búsquedas ciegas (grep)      │ ${String(a.totals.grepCalls).padStart(9)} │ ${String(b.totals.grepCalls).padStart(9)} │`)
console.log(`  │ Lecturas de archivos         │ ${String(a.totals.readCalls).padStart(9)} │ ${String(b.totals.readCalls).padStart(9)} │`)
console.log(`  │ Queries graphify             │ ${String(0).padStart(9)} │ ${String(b.totals.graphifyCalls).padStart(9)} │`)
console.log(`  │ Docs bóveda consultados      │ ${String(0).padStart(9)} │ ${String(b.totals.bovedaDocs).padStart(9)} │`)
console.log(`  ├──────────────────────────────┼───────────┼───────────┤`)
console.log(`  │ ${BOLD}Tokens totales${RESET}               │ ${RED}${String(formatNumber(a.totals.tokens)).padStart(9)}${RESET} │ ${GREEN}${String(formatNumber(b.totals.tokens)).padStart(9)}${RESET} │`)
console.log(`  └──────────────────────────────┴───────────┴───────────┘\n`)

// ─── Savings ───
if (savings > 0) {
  console.log(`  ${GREEN}${BOLD}  🎉 Ahorro: ${formatNumber(savings)} tokens (${savingsPct}%)${RESET}`)
  console.log(`  ${GREEN}     En ~${Math.max(1, Math.round(100 / Math.max(1, savingsPct)))} tarea${Math.round(100/savingsPct) !== 1 ? 's' : ''} ahorras el equivalente a 1 tarea completa.${RESET}\n`)
} else {
  console.log(`  ${YELLOW}  ⚠️  Proyecto muy pequeño — el overhead de YouMindAG supera el ahorro.${RESET}\n`)
}

// ─── Step-by-step (optional detail) ───
const showDetail = process.argv.includes('--detail')
if (showDetail) {
  console.log(`  ${BOLD}📋 Pasos — SIN YouMindAG${RESET}`)
  for (const s of a.steps) {
    console.log(`     ${s.tool.padEnd(10)} ${String(s.tokens).padStart(6)} tokens  ${s.desc}`)
  }
  console.log()
  console.log(`  ${BOLD}📋 Pasos — CON YouMindAG${RESET}`)
  for (const s of b.steps) {
    console.log(`     ${s.tool.padEnd(10)} ${String(s.tokens).padStart(6)} tokens  ${s.desc}`)
  }
  console.log()
}
