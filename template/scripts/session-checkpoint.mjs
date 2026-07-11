#!/usr/bin/env node
// scripts/session-checkpoint.mjs
// Session log: registra eventos clave y provee resumen para continuidad.
//
// Uso:
//   node scripts/session-checkpoint.mjs --append "key" "text"
//   node scripts/session-checkpoint.mjs --last 5
//   node scripts/session-checkpoint.mjs --summary
//   node scripts/session-checkpoint.mjs --clear

import { existsSync, readFileSync, writeFileSync, mkdirSync, appendFileSync, statSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const SESSION_DIR = join(ROOT, '.youmindag')
const SESSION_FILE = join(SESSION_DIR, 'session.jsonl')
const DECISIONS_FILE = join(SESSION_DIR, 'decisions.jsonl')
const MAX_LINES = 500

function ensureDir() {
  mkdirSync(SESSION_DIR, { recursive: true })
}

function formatEvent(ts, key, text) {
  const time = ts.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
  return `[${time}] ${key} — ${text}`
}

function parseEvent(line) {
  try {
    return JSON.parse(line.trim())
  } catch {
    return null
  }
}

function append(key, text) {
  ensureDir()
  const entry = JSON.stringify({
    ts: new Date().toISOString(),
    key,
    text: text || '',
  })
  appendFileSync(SESSION_FILE, entry + '\n')
  // Rotate if too large
  try {
    const lines = readFileSync(SESSION_FILE, 'utf-8').split('\n').filter(Boolean)
    if (lines.length > MAX_LINES) {
      writeFileSync(SESSION_FILE, lines.slice(-MAX_LINES / 2).join('\n') + '\n')
    }
  } catch {}
}

function last(n = 5) {
  if (!existsSync(SESSION_FILE)) return '  (sin sesión registrada)'

  const lines = readFileSync(SESSION_FILE, 'utf-8').split('\n').filter(Boolean)
  const recent = lines.slice(-n)

  if (!recent.length) return '  (sesión vacía)'

  let output = ''
  for (const line of recent) {
    const evt = parseEvent(line)
    if (!evt) continue
    const ts = new Date(evt.ts)
    output += `  ${formatEvent(ts, evt.key, evt.text)}\n`
  }
  return output || '  (sin eventos parseables)'
}

function summary() {
  if (!existsSync(SESSION_FILE)) return '  🔵 Sesión nueva - sin eventos registrados aún.\n  El archivo .youmindag/session.jsonl se creará automáticamente al registrar eventos.\n'

  const lines = readFileSync(SESSION_FILE, 'utf-8').split('\n').filter(Boolean)
  const events = lines.map(parseEvent).filter(Boolean)

  if (!events.length) return '  (sesión vacía)\n'

  const tasks = events.filter(e => e.key === 'task').slice(-3)
  const builds = events.filter(e => e.key === 'build').slice(-2)
  const typechecks = events.filter(e => e.key === 'typecheck').slice(-2)
  const filesTouched = [...new Set(
    events
      .filter(e => e.key === 'file')
      .map(e => e.text)
  )].slice(-10)

  let output = ''

  if (tasks.length) {
    output += '  📋 Últimas tareas:\n'
    for (const t of tasks) {
      const ts = new Date(t.ts)
      const shortText = t.text.length > 80 ? t.text.slice(0, 77) + '...' : t.text
      output += `     ${formatEvent(ts, t.key, shortText)}\n`
    }
  }

  if (builds.length || typechecks.length) {
    output += '  🔨 Estado build:\n'
    for (const b of builds) {
      const ts = new Date(b.ts)
      output += `     ${formatEvent(ts, b.key, b.text)}\n`
    }
    for (const t of typechecks) {
      const ts = new Date(t.ts)
      output += `     ${formatEvent(ts, t.key, t.text)}\n`
    }
  }

  if (filesTouched.length) {
    output += '  📄 Archivos recientes:\n'
    for (const f of filesTouched.slice(-7)) {
      output += `     • ${f}\n`
    }
  }

  output += `\n  📊 Total eventos: ${events.length} | Último: ${formatEvent(new Date(events[events.length - 1].ts), events[events.length - 1].key, events[events.length - 1].text)}\n`

  return output
}

function clear() {
  if (existsSync(SESSION_FILE)) writeFileSync(SESSION_FILE, '')
}

function budget(maxTokens = 200000) {
  if (!existsSync(SESSION_FILE)) return { used: 0, max: maxTokens, pct: 0, status: 'cold', fileReads: 0, builds: 0, tasks: 0 }

  const lines = readFileSync(SESSION_FILE, 'utf-8').split('\n').filter(Boolean)
  const events = lines.map(parseEvent).filter(Boolean)

  // Token estimation model
  const SYSTEM = 7000
  const CLAUDE_MD = 2000
  const FILE_READ_COST = 1500
  const BUILD_COST = 800
  const MESSAGE_COST = 200
  const SESSION_COST = 500

  const fileReads = events.filter(e => e.key === 'file_read').length
  const builds = events.filter(e => e.key === 'build' || e.key === 'typecheck').length
  const tasks = events.filter(e => e.key === 'task').length

  const used = SYSTEM + CLAUDE_MD + SESSION_COST +
    (fileReads * FILE_READ_COST) + (builds * BUILD_COST) + (tasks * MESSAGE_COST)

  const pct = Math.round(used / maxTokens * 100)

  let status = 'ok'
  if (pct > 75) status = 'critical'
  else if (pct > 50) status = 'warning'

  return { used, max: maxTokens, pct, status, fileReads, builds, tasks }
}

function budgetReport(maxTokens, events) {
  const { used, max, pct, status, fileReads, builds, tasks } = budget(maxTokens)

  const icons = { ok: '🟢', warning: '🟡', critical: '🔴', cold: '🔵' }
  const labels = { ok: 'OK', warning: '⚠️  Warning', critical: 'Critical', cold: 'Cold start' }
  const bar = Math.max(1, Math.min(pct, 100))

  let output = ''
  output += `  ${icons[status]} ${labels[status]} ~${formatNum(used)} / ${formatNum(max)} tokens (${pct}%)\n`
  output += `  [${'█'.repeat(Math.floor(bar / 5))}${'░'.repeat(20 - Math.floor(bar / 5))}] ${pct}%\n`
  output += `  📖 File reads: ${fileReads} · 🔨 Builds: ${builds} · 💬 Tareas: ${tasks}\n`

  if (status === 'critical') {
    output += `  💡 Sugerencia: usa /compact o subagentes para liberar contexto.\n`
  } else if (status === 'warning') {
    output += `  💡 Considera delegar investigación a subagentes.\n`
  }

  // Exit code for scripting
  return { text: output, exitCode: status === 'critical' ? 2 : status === 'warning' ? 1 : 0 }
}

function formatNum(n) {
  return n >= 1000 ? (n / 1000).toFixed(0) + 'K' : String(n)
}

// ─── Decision logging ─────────────────────────────────────────────

function addDecision(text) {
  ensureDir()
  const sessionId = getSessionId()
  const entry = JSON.stringify({
    ts: new Date().toISOString(),
    sessionId,
    text: text || '',
  })
  appendFileSync(DECISIONS_FILE, entry + '\n')
}

function getSessionId() {
  if (!existsSync(SESSION_FILE)) return 'unknown'
  try {
    const lines = readFileSync(SESSION_FILE, 'utf-8').split('\n').filter(Boolean)
    if (!lines.length) return 'unknown'
    const first = parseEvent(lines[0])
    return first ? first.ts : 'unknown'
  } catch { return 'unknown' }
}

function pendingDecisions() {
  if (!existsSync(DECISIONS_FILE)) return '  (sin decisiones registradas)'

  const lines = readFileSync(DECISIONS_FILE, 'utf-8').split('\n').filter(Boolean)
  if (!lines.length) return '  (sin decisiones registradas)'

  const sessionId = getSessionId()
  const decisions = lines.map(parseEvent).filter(Boolean)

  // Show decisions from current session
  const sessionDecisions = decisions.filter(d => d.sessionId === sessionId)

  // Also show orphan decisions (no matching session)
  const recent = decisions.slice(-10).filter(d => d.sessionId !== sessionId)

  const toShow = [...sessionDecisions, ...recent].slice(-8)

  if (!toShow.length) return '  (sin decisiones pendientes)'

  let output = ''
  for (const d of toShow) {
    const ts = new Date(d.ts)
    const shortText = d.text.length > 100 ? d.text.slice(0, 97) + '...' : d.text
    const sameSession = d.sessionId === sessionId ? '📌 ' : '  '
    output += `  ${sameSession}${formatEvent(ts, 'decision', shortText)}\n`
  }
  return output
}

function clearDecisions() {
  if (existsSync(DECISIONS_FILE)) writeFileSync(DECISIONS_FILE, '')
}

// ─── CLI ──────────────────────────────────────────────────────────

const args = process.argv.slice(2)
const cmd = args[0]

switch (cmd) {
  case '--append':
    if (args.length < 3) {
      console.log('Uso: session-checkpoint --append "key" "text"')
      process.exit(1)
    }
    append(args[1], args.slice(2).join(' '))
    break

  case '--last': {
    const n = parseInt(args[1] || '5', 10)
    const result = last(n)
    process.stdout.write(result)
    break
  }

  case '--summary': {
    const result = summary()
    process.stdout.write(result)
    break
  }

  case '--clear':
    clear()
    console.log('✅ Sesión limpiada')
    break

  case '--file-read':
    if (!args[1]) process.exit(1)
    append('file_read', args.slice(1).join(' '))
    break

  case '--budget': {
    const max = parseInt(args[1] || '200000', 10)
    const result = budgetReport(max)
    process.stdout.write(result.text)
    process.exit(result.exitCode)
  }

  case '--decision':
    if (!args[1]) process.exit(1)
    addDecision(args.slice(1).join(' '))
    console.log('✅ Decisión registrada')
    break

  case '--pending-decisions': {
    const result = pendingDecisions()
    process.stdout.write(result + '\n')
    break
  }

  case '--clear-decisions':
    clearDecisions()
    console.log('✅ Decisiones limpiadas')
    break

  default:
    console.log('Uso: session-checkpoint --append "key" "text"')
    console.log('     session-checkpoint --file-read "path"')
    console.log('     session-checkpoint --last [N]')
    console.log('     session-checkpoint --summary')
    console.log('     session-checkpoint --budget [maxTokens]')
    console.log('     session-checkpoint --decision "texto"')
    console.log('     session-checkpoint --pending-decisions')
    console.log('     session-checkpoint --clear')
    console.log('     session-checkpoint --clear-decisions')
    console.log()
    console.log('Keys recomendadas: task, build, typecheck, file, file_read, decision, done')
    process.exit(1)
}
