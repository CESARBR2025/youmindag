#!/usr/bin/env node
// YouMindAG — PostToolUse hook (Claude Code, matcher: Edit|Write|MultiEdit)
//
// Dos mecanismos independientes en el mismo hook:
//
// 1) Cada SYNC_EVERY ediciones lanza una sincronización EN BACKGROUND del
//    grafo y la bóveda estructural (ym-sync-background.mjs), en vez de solo
//    recordar que hace falta correrla. El hook lanza el proceso desacoplado
//    (detached + unref) y sale de inmediato — nunca espera a que termine,
//    así no compite con su propio timeout ni bloquea al agente.
//
// 2) En CADA edición (no solo la 10ª), si el archivo tocado aparece en la
//    tabla `## Componentes` de algún Feature.md, avisa (con cooldown por
//    feature) para que la doc se actualice como parte del mismo cambio, en
//    vez de que alguien tenga que acordarse después. No reescribe nada —
//    solo avisa; la prosa narrativa la sigue escribiendo un humano/IA con
//    contexto real, nunca un script en background sin supervisión.
//
// Config en .youmindag.json: "autoSync": false desactiva el auto-sync (el
// contador se sigue llevando, pero no se lanza nada). Cooldown de 2 min
// entre corridas de sync y recuperación de lock huérfano a los 5 min.
// El nudge de doc tiene su propio cooldown de 30 min por feature.
//
// FAIL-OPEN: nunca bloquea, nunca lanza, siempre exit 0.

import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync, statSync } from 'fs'
import { join, resolve } from 'path'
import { spawn } from 'child_process'

const SYNC_EVERY = 10
const MIN_INTERVAL_MS = 2 * 60 * 1000
const LOCK_MAX_AGE_MS = 5 * 60 * 1000
const DOC_NUDGE_COOLDOWN_MS = 30 * 60 * 1000

const CODE_EXT_RE = /\.(ts|tsx|js|jsx|mjs|cjs|py|go|rb|java|php|vue|svelte)$/

function readJson(p) {
  try {
    const v = JSON.parse(readFileSync(p, 'utf-8'))
    return (v && typeof v === 'object' && !Array.isArray(v)) ? v : {}
  } catch { return {} }
}

function writeJson(dir, p, v) {
  try { mkdirSync(dir, { recursive: true }); writeFileSync(p, JSON.stringify(v, null, 2) + '\n') } catch {}
}

function getBovedaDir(cwd) {
  try {
    const data = JSON.parse(readFileSync(join(cwd, '.youmindag.json'), 'utf-8'))
    if (data.bovedaDir && existsSync(join(cwd, data.bovedaDir))) return data.bovedaDir
  } catch {}
  try {
    const match = readdirSync(cwd).find(e => e.startsWith('boveda-') && statSync(join(cwd, e)).isDirectory())
    if (match) return match
  } catch {}
  if (existsSync(join(cwd, 'boveda'))) return 'boveda'
  return null
}

function resolveEntry(parentDir, name) {
  const direct = join(parentDir, name)
  if (existsSync(direct)) return direct
  try {
    const target = name.normalize('NFC')
    const match = readdirSync(parentDir).find(e => e.normalize('NFC') === target)
    if (match) return join(parentDir, match)
  } catch {}
  return direct
}

function parseComponentPaths(mdContent) {
  const paths = new Set()
  const re = /`([a-zA-Z0-9_./-]+)`/g
  let m
  while ((m = re.exec(mdContent))) {
    if (CODE_EXT_RE.test(m[1])) paths.add(m[1])
  }
  return [...paths]
}

// Rutas relativas al cwd, comparación tolerante a "./" y separadores.
function toRelative(cwd, p) {
  try {
    const abs = resolve(cwd, p)
    const rel = abs.startsWith(cwd) ? abs.slice(cwd.length).replace(/^[/\\]/, '') : p
    return rel.split('\\').join('/')
  } catch { return p }
}

// Devuelve el nombre del primer feature cuya tabla de Componentes incluya
// el archivo editado. Puro fs + regex — sin git, barato en cada edición.
function findDocForPath(cwd, editedPath) {
  const bovedaDir = getBovedaDir(cwd)
  if (!bovedaDir) return null
  const featuresDir = resolveEntry(join(cwd, bovedaDir), '🧩 Features')
  if (!existsSync(featuresDir)) return null

  const relEdited = toRelative(cwd, editedPath)
  let files = []
  try { files = readdirSync(featuresDir).filter(f => f.endsWith('.md') && f !== 'Index.md') } catch { return null }

  for (const file of files) {
    try {
      const content = readFileSync(join(featuresDir, file), 'utf-8')
      const paths = parseComponentPaths(content)
      if (paths.some(p => toRelative(cwd, p) === relEdited)) {
        return file.replace('.md', '')
      }
    } catch { /* seguir con el siguiente doc */ }
  }
  return null
}

// Avisa (con cooldown por feature) si el archivo editado está documentado
// en algún Feature.md. No reescribe nada, solo notifica en el momento.
function handleDocNudge(cwd, input, toolName, state) {
  if (!['Edit', 'Write', 'MultiEdit'].includes(toolName)) return // NotebookEdit fuera: campo de ruta no verificado
  try {
    const editedPath = input.tool_input && input.tool_input.file_path
    if (!editedPath) return

    const feature = findDocForPath(cwd, editedPath)
    if (!feature) return

    state.ymDocNudge = state.ymDocNudge || {}
    const now = Date.now()
    const last = Number(state.ymDocNudge[feature]) || 0
    if (now - last < DOC_NUDGE_COOLDOWN_MS) return
    state.ymDocNudge[feature] = now

    // Claude Code pasa file_path absoluto; mostrar la ruta relativa es más legible.
    const displayPath = toRelative(cwd, editedPath)

    process.stdout.write(JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PostToolUse',
        additionalContext: `[YouMindAG] Editaste ${displayPath}, documentado en ${feature}.md — considera actualizar esa sección en este mismo cambio.`,
      },
    }))
  } catch { /* fail-open */ }
}

// Cada SYNC_EVERY ediciones lanza el sync en background (detached, no espera).
function handleAutoSync(cwd, stateDir, state) {
  try {
    const cfg = readJson(join(cwd, '.youmindag.json'))
    const autoSync = cfg.autoSync !== false

    const count = (Number(state.ymEditCount) || 0) + 1
    state.ymEditCount = count >= SYNC_EVERY ? 0 : count

    if (count < SYNC_EVERY || !autoSync) return

    const now = Date.now()
    if (now - (Number(state.ymLastSyncAt) || 0) < MIN_INTERVAL_MS) return

    const lockPath = join(stateDir, 'sync.lock')
    const lock = readJson(lockPath)
    if (lock.startedAt && now - Number(lock.startedAt) < LOCK_MAX_AGE_MS) return // ya hay uno corriendo

    state.ymLastSyncAt = now
    writeJson(stateDir, lockPath, { startedAt: now, pid: process.pid })

    const runnerPath = join(cwd, 'scripts', 'ym-sync-background.mjs')
    if (!existsSync(runnerPath)) return

    const child = spawn(process.execPath, [runnerPath, cwd], { cwd, detached: true, stdio: 'ignore' })
    child.unref()
  } catch { /* fail-open */ }
}

function main() {
  const cwd = process.cwd()
  if (!existsSync(join(cwd, '.youmindag.json'))) return

  let raw = ''
  try { raw = readFileSync(0, 'utf-8') } catch { return }
  let input
  try { input = JSON.parse(raw) } catch { return }
  const toolName = input && input.tool_name
  if (!['Edit', 'Write', 'MultiEdit', 'NotebookEdit'].includes(toolName)) return

  const stateDir = join(cwd, '.youmindag')
  const statePath = join(stateDir, 'plugin-state.json')
  const state = readJson(statePath)

  // Dos mecanismos independientes: uno no bloquea al otro.
  handleDocNudge(cwd, input, toolName, state)
  handleAutoSync(cwd, stateDir, state)

  writeJson(stateDir, statePath, state)
}

try { main() } catch {}
process.exit(0)
