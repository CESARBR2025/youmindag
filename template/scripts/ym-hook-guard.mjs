#!/usr/bin/env node
// YouMindAG — PreToolUse hook (Claude Code, matcher: Bash)
// Detecta exploración cruda del codebase (grep -r, rg, find -name, cat de
// código fuente) y redirige a los comandos de youmindag.
//
// Modos (campo "guard" en .youmindag.json): "warn" (default) | "block" | "off"
// Escape hatch: YM_NO_GUARD=1
//
// FAIL-OPEN: ante cualquier error interno sale con 0 — este hook jamás debe
// dejar al usuario sin Bash.

import { readFileSync } from 'fs'
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

function ok() {
  process.exit(0)
}

function main() {
  if (process.env.YM_NO_GUARD === '1') return ok()

  let raw = ''
  try { raw = readFileSync(0, 'utf-8') } catch { return ok() }

  let input
  try { input = JSON.parse(raw) } catch { return ok() }
  if (!input || input.tool_name !== 'Bash') return ok()

  const command = String((input.tool_input && input.tool_input.command) || '')
  if (!command) return ok()

  let mode = 'warn'
  try {
    const cfg = JSON.parse(readFileSync(join(process.cwd(), '.youmindag.json'), 'utf-8'))
    if (cfg.guard === 'block' || cfg.guard === 'off' || cfg.guard === 'warn') mode = cfg.guard
  } catch {}
  if (mode === 'off') return ok()

  if (ALLOWLIST.some(re => re.test(command))) return ok()
  if (!CRUDE_PATTERNS.some(re => re.test(command))) return ok()

  const msg = '[YouMindAG] Exploración cruda detectada. Usa `npx youmindag references <simbolo>` para buscar símbolos o `npx youmindag architect <modulo>` para cargar contexto (bóveda + grafo + historial). Bypass puntual: YM_NO_GUARD=1.'

  if (mode === 'block') {
    process.stderr.write(msg)
    process.exit(2)
  }

  process.stdout.write(JSON.stringify({
    hookSpecificOutput: { hookEventName: 'PreToolUse', additionalContext: msg },
  }))
  process.exit(0)
}

try { main() } catch { process.exit(0) }
