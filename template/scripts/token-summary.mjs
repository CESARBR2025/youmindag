#!/usr/bin/env node
// scripts/token-summary.mjs — YouMindAG Token Usage Report
// Lee .youmindag/token-usage.jsonl y muestra desglose de tokens por sesión.
//
// Uso:
//   node scripts/token-summary.mjs
//   node scripts/token-summary.mjs --session SID   (filtrar por sesión)
//   node scripts/token-summary.mjs --json

import { existsSync, readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const TOKEN_LOG = join(ROOT, '.youmindag', 'token-usage.jsonl')

const RESET = '\x1b[0m'
const CYAN = '\x1b[36m'
const GREEN = '\x1b[32m'
const YELLOW = '\x1b[33m'
const BOLD = '\x1b[1m'
const MAGENTA = '\x1b[35m'

const showJson = process.argv.includes('--json')
const filterSid = process.argv.includes('--session')
  ? process.argv[process.argv.indexOf('--session') + 1]
  : null

function formatNumber(n) {
  return n.toLocaleString('en-US')
}

function readEntries() {
  if (!existsSync(TOKEN_LOG)) return []
  try {
    return readFileSync(TOKEN_LOG, 'utf-8')
      .split('\n')
      .filter(Boolean)
      .map(l => JSON.parse(l))
  } catch { return [] }
}

function groupBySession(entries) {
  const sessions = {}
  for (const e of entries) {
    const sid = e.sessionID || 'unknown'
    if (filterSid && sid !== filterSid) continue
    if (!sessions[sid]) sessions[sid] = { user: 0, tools_in: 0, tools_out: 0, tools: {}, entries: [] }
    sessions[sid].entries.push(e)
    if (e.event === 'user_message') sessions[sid].user += e.tokens
    if (e.event === 'tool_before') {
      sessions[sid].tools_in += e.tokens
      const t = e.tool || 'unknown'
      sessions[sid].tools[t] = (sessions[sid].tools[t] || 0) + 1
    }
    if (e.event === 'tool_after') sessions[sid].tools_out += e.tokens
  }
  return sessions
}

const entries = readEntries()
const sessions = groupBySession(entries)

if (showJson) {
  const report = Object.entries(sessions).map(([sid, data]) => ({
    sessionID: sid.slice(0, 16) + '...',
    userTokens: data.user,
    toolInputTokens: data.tools_in,
    toolOutputTokens: data.tools_out,
    totalTokens: data.user + data.tools_in + data.tools_out,
    toolCalls: data.entries.filter(e => e.event === 'tool_before').length,
    tools: data.tools,
  }))
  process.stdout.write(JSON.stringify(report, null, 2) + '\n')
  process.exit(0)
}

if (!entries.length) {
  console.log(`\n  ${YELLOW}⚠️  No hay datos de token usage.${RESET}`)
  console.log(`  ${YELLOW}   Asegúrate de tener YouMindAG v2.6.1+ instalado y${RESET}`)
  console.log(`  ${YELLOW}   haber ejecutado al menos una tarea con el agente.${RESET}\n`)
  process.exit(0)
}

const sessionIds = Object.keys(sessions)
const totalUser = Object.values(sessions).reduce((s, d) => s + d.user, 0)
const totalIn = Object.values(sessions).reduce((s, d) => s + d.tools_in, 0)
const totalOut = Object.values(sessions).reduce((s, d) => s + d.tools_out, 0)
const totalAll = totalUser + totalIn + totalOut
const totalToolCalls = Object.values(sessions).reduce((s, d) => s + d.entries.filter(e => e.event === 'tool_before').length, 0)

console.log(`\n${BOLD}${MAGENTA}  ╔══════════════════════════════════════╗${RESET}`)
console.log(`${BOLD}${MAGENTA}  ║${RESET}   ${BOLD}YouMindAG Token Usage Report${RESET}${MAGENTA}     ║${RESET}`)
console.log(`${BOLD}${MAGENTA}  ╚══════════════════════════════════════╝${RESET}\n`)

if (filterSid) {
  console.log(`  ${BOLD}🔍 Filtrando sesión:${RESET} ${filterSid.slice(0, 20)}...\n`)
}

console.log(`  ${BOLD}📊 Totales (${sessionIds.length} sesión${sessionIds.length !== 1 ? 'es' : ''})${RESET}`)
console.log(`  ┌──────────────────────────┬───────────┐`)
console.log(`  │ Mensajes de usuario      │ ${String(formatNumber(totalUser)).padStart(9)} │`)
console.log(`  │ Input de tools           │ ${String(formatNumber(totalIn)).padStart(9)} │`)
console.log(`  │ Output de tools           │ ${String(formatNumber(totalOut)).padStart(9)} │`)
console.log(`  ├──────────────────────────┼───────────┤`)
console.log(`  │ ${BOLD}Total tokens${RESET}              │ ${String(formatNumber(totalAll)).padStart(9)} │`)
console.log(`  │ ${BOLD}Total tool calls${RESET}          │ ${String(totalToolCalls).padStart(9)} │`)
console.log(`  └──────────────────────────┴───────────┘\n`)

// Per-session breakdown
console.log(`  ${BOLD}📋 Por sesión${RESET}`)
console.log(`  ┌──────────────────────┬──────────┬──────────┬──────────┐`)
console.log(`  │ Sesión               │ User     │ Tools in │ Tools out│`)
console.log(`  ├──────────────────────┼──────────┼──────────┼──────────┤`)
for (const [sid, data] of Object.entries(sessions)) {
  const shortSid = sid.slice(0, 18) + '...'
  console.log(`  │ ${shortSid} │ ${String(formatNumber(data.user)).padStart(8)} │ ${String(formatNumber(data.tools_in)).padStart(8)} │ ${String(formatNumber(data.tools_out)).padStart(8)} │`)
}
console.log(`  └──────────────────────┴──────────┴──────────┴──────────┘\n`)

// Tool breakdown
const allTools = {}
for (const [, data] of Object.entries(sessions)) {
  for (const [tool, count] of Object.entries(data.tools)) {
    allTools[tool] = (allTools[tool] || 0) + count
  }
}
const sortedTools = Object.entries(allTools).sort((a, b) => b[1] - a[1])

if (sortedTools.length > 0) {
  console.log(`  ${BOLD}🔧 Tools usadas${RESET}`)
  console.log(`  ┌──────────────────────┬──────────┐`)
  console.log(`  │ Tool                 │ Llamadas │`)
  console.log(`  ├──────────────────────┼──────────┤`)
  for (const [tool, count] of sortedTools) {
    console.log(`  │ ${tool.padEnd(20)} │ ${String(count).padStart(8)} │`)
  }
  console.log(`  └──────────────────────┴──────────┘\n`)
}

console.log(`  ${CYAN}📁 Datos crudos: ${TOKEN_LOG}${RESET}`)
console.log(`  ${CYAN}   Cada línea es un evento JSON con ts, event, tool, tokens.${RESET}\n`)
