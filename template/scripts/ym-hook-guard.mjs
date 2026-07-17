#!/usr/bin/env node
// YouMindAG — PreToolUse hook (Claude Code, matchers: Bash, Grep|Glob)
//
// Para Bash: detecta exploración cruda (grep -r, rg, find -name, cat de
// código fuente) y redirige a los comandos de youmindag. Modos ("guard" en
// .youmindag.json): "warn" (default) | "block" | "off". Escape hatch: YM_NO_GUARD=1.
//
// Para Grep/Glob (tools nativas de Claude Code): esas tools NO son "crudas"
// — son el diseño correcto por defecto. Aquí no hay nada que bloquear; solo
// se recuerda periódicamente (cada N usos) que `youmindag references` /
// `youmindag architect` traen contexto curado (bóveda + grafo + historial)
// además del match crudo. Nunca bloquea.
//
// FAIL-OPEN: ante cualquier error interno sale con 0 — este hook jamás debe
// dejar al usuario sin sus herramientas.

import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'

const ALLOWLIST = [
  /youmindag/,
  /graphify/,
  /session-checkpoint/,
  /node_modules/,
  /\.git\//,
  /package(-lock)?\.json/,
]

const CRUDE_PATTERNS = [
  /\bgrep\b[^|&;]*\s-[a-zA-Z]*r/,
  /\brg\b\s/,
  /\bfind\b[^|&;]*\s-name\b/,
  /\bcat\b\s+[^|&;]*\b(src|lib|app|components|features)\//,
]

const REMIND_EVERY_SEARCHES = 5

function ok() {
  process.exit(0)
}

function additionalContext(msg) {
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: { hookEventName: 'PreToolUse', additionalContext: msg },
  }))
}

function readGuardMode(cwd) {
  try {
    const cfg = JSON.parse(readFileSync(join(cwd, '.youmindag.json'), 'utf-8'))
    if (cfg.guard === 'block' || cfg.guard === 'off' || cfg.guard === 'warn') return cfg.guard
  } catch {}
  return 'warn'
}

function handleBash(cwd, input, mode) {
  const command = String((input.tool_input && input.tool_input.command) || '')
  if (!command) return ok()

  if (ALLOWLIST.some(re => re.test(command))) return ok()
  if (!CRUDE_PATTERNS.some(re => re.test(command))) return ok()

  const msg = '[YouMindAG] Exploración cruda detectada. Usa `npx youmindag references <simbolo>` para buscar símbolos o `npx youmindag architect <modulo>` para cargar contexto (bóveda + grafo + historial). Bypass puntual: YM_NO_GUARD=1.'

  if (mode === 'block') {
    process.stderr.write(msg)
    process.exit(2)
  }

  additionalContext(msg)
  process.exit(0)
}

// Grep/Glob: nunca bloquea (no son "crudas", son las tools nativas
// correctas). Solo cuenta usos y recuerda cada REMIND_EVERY_SEARCHES.
function handleSearch(cwd) {
  const stateDir = join(cwd, '.youmindag')
  const statePath = join(stateDir, 'plugin-state.json')
  let state = {}
  try { state = JSON.parse(readFileSync(statePath, 'utf-8')) } catch {}
  if (typeof state !== 'object' || state === null || Array.isArray(state)) state = {}

  const count = (Number(state.ymSearchCount) || 0) + 1

  if (count < REMIND_EVERY_SEARCHES) {
    state.ymSearchCount = count
    try { mkdirSync(stateDir, { recursive: true }); writeFileSync(statePath, JSON.stringify(state, null, 2) + '\n') } catch {}
    return ok()
  }

  state.ymSearchCount = 0
  try { mkdirSync(stateDir, { recursive: true }); writeFileSync(statePath, JSON.stringify(state, null, 2) + '\n') } catch {}

  additionalContext('[YouMindAG] Varias búsquedas seguidas con Grep/Glob. Para exploración a nivel de arquitectura, `npx youmindag references <simbolo>` o `npx youmindag architect <modulo>` traen además bóveda + grafo + historial, no solo el match crudo.')
  process.exit(0)
}

function main() {
  if (process.env.YM_NO_GUARD === '1') return ok()

  let raw = ''
  try { raw = readFileSync(0, 'utf-8') } catch { return ok() }

  let input
  try { input = JSON.parse(raw) } catch { return ok() }
  if (!input || !input.tool_name) return ok()

  const cwd = process.cwd()
  const mode = readGuardMode(cwd)
  if (mode === 'off') return ok()

  if (input.tool_name === 'Bash') return handleBash(cwd, input, mode)
  if (input.tool_name === 'Grep' || input.tool_name === 'Glob') return handleSearch(cwd)
  return ok()
}

try { main() } catch { process.exit(0) }
