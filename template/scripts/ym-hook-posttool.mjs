#!/usr/bin/env node
// YouMindAG — PostToolUse hook (Claude Code, matcher: Edit|Write|MultiEdit)
//
// Cada SYNC_EVERY ediciones lanza una sincronización EN BACKGROUND del
// grafo y la bóveda estructural (ym-sync-background.mjs), en vez de solo
// recordar que hace falta correrla. El hook lanza el proceso desacoplado
// (detached + unref) y sale de inmediato — nunca espera a que termine, así
// no compite con su propio timeout ni bloquea al agente.
//
// Config en .youmindag.json: "autoSync": false desactiva el auto-sync (el
// contador se sigue llevando, pero no se lanza nada). Cooldown de 2 min
// entre corridas y recuperación de lock huérfano a los 5 min.
//
// FAIL-OPEN: nunca bloquea, nunca lanza, siempre exit 0.

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'
import { spawn } from 'child_process'

const SYNC_EVERY = 10
const MIN_INTERVAL_MS = 2 * 60 * 1000
const LOCK_MAX_AGE_MS = 5 * 60 * 1000

function readJson(p) {
  try {
    const v = JSON.parse(readFileSync(p, 'utf-8'))
    return (v && typeof v === 'object' && !Array.isArray(v)) ? v : {}
  } catch { return {} }
}

function writeJson(dir, p, v) {
  try { mkdirSync(dir, { recursive: true }); writeFileSync(p, JSON.stringify(v, null, 2) + '\n') } catch {}
}

function main() {
  const cwd = process.cwd()
  if (!existsSync(join(cwd, '.youmindag.json'))) return

  const cfg = readJson(join(cwd, '.youmindag.json'))
  const autoSync = cfg.autoSync !== false

  let raw = ''
  try { raw = readFileSync(0, 'utf-8') } catch { return }
  let input
  try { input = JSON.parse(raw) } catch { return }
  if (!['Edit', 'Write', 'MultiEdit', 'NotebookEdit'].includes(input && input.tool_name)) return

  const stateDir = join(cwd, '.youmindag')
  const statePath = join(stateDir, 'plugin-state.json')
  const state = readJson(statePath)

  const count = (Number(state.ymEditCount) || 0) + 1
  state.ymEditCount = count >= SYNC_EVERY ? 0 : count
  writeJson(stateDir, statePath, state)

  if (count < SYNC_EVERY || !autoSync) return

  const now = Date.now()
  if (now - (Number(state.ymLastSyncAt) || 0) < MIN_INTERVAL_MS) return

  const lockPath = join(stateDir, 'sync.lock')
  const lock = readJson(lockPath)
  if (lock.startedAt && now - Number(lock.startedAt) < LOCK_MAX_AGE_MS) return // ya hay uno corriendo

  state.ymLastSyncAt = now
  writeJson(stateDir, statePath, state)
  writeJson(stateDir, lockPath, { startedAt: now, pid: process.pid })

  const runnerPath = join(cwd, 'scripts', 'ym-sync-background.mjs')
  if (!existsSync(runnerPath)) return

  try {
    const child = spawn(process.execPath, [runnerPath, cwd], {
      cwd, detached: true, stdio: 'ignore',
    })
    child.unref()
  } catch {}
}

try { main() } catch {}
process.exit(0)
