#!/usr/bin/env node
// YouMindAG — PostToolUse hook (Claude Code, matcher: Edit|Write|MultiEdit)
// Cuenta ediciones en .youmindag/plugin-state.json y cada 10 recuerda
// actualizar el grafo. FAIL-OPEN: exit 0 siempre, nunca bloquea.

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'

const REMIND_EVERY = 10

function main() {
  const cwd = process.cwd()
  if (!existsSync(join(cwd, '.youmindag.json'))) return

  let raw = ''
  try { raw = readFileSync(0, 'utf-8') } catch { return }
  let input
  try { input = JSON.parse(raw) } catch { return }
  const tool = input && input.tool_name
  if (!['Edit', 'Write', 'MultiEdit', 'NotebookEdit'].includes(tool)) return

  const stateDir = join(cwd, '.youmindag')
  const statePath = join(stateDir, 'plugin-state.json')
  let state = {}
  try { state = JSON.parse(readFileSync(statePath, 'utf-8')) } catch {}
  if (typeof state !== 'object' || state === null || Array.isArray(state)) state = {}

  const count = (Number(state.ymEditCount) || 0) + 1

  if (count >= REMIND_EVERY) {
    state.ymEditCount = 0
    try {
      mkdirSync(stateDir, { recursive: true })
      writeFileSync(statePath, JSON.stringify(state, null, 2) + '\n')
    } catch {}
    process.stdout.write(JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PostToolUse',
        additionalContext: `[YouMindAG] ${REMIND_EVERY}+ ediciones sin actualizar el grafo. Ejecuta: npx graphify update (y registra decisiones con node scripts/session-checkpoint.mjs --decision "...")`,
      },
    }))
    return
  }

  state.ymEditCount = count
  try {
    mkdirSync(stateDir, { recursive: true })
    writeFileSync(statePath, JSON.stringify(state, null, 2) + '\n')
  } catch {}
}

try { main() } catch {}
process.exit(0)
