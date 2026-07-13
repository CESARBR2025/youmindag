// scripts/ym-dev.mjs
// Wrapper transparente del dev server de Next.js
// Reemplaza el script "dev" en package.json para capturar logs
// Uso interno: llamado por npm run dev

import { spawn } from 'child_process'
import { readFileSync, writeFileSync, appendFileSync, openSync, closeSync } from 'fs'
import { join } from 'path'

const ROOT = process.cwd()
const LOG = join(ROOT, '.youmindag', 'dev.log')
const ORIG = join(ROOT, '.youmindag', 'dev-original.txt')
const PID_FILE = join(ROOT, '.youmindag', 'dev.json')

// Initialize log file
closeSync(openSync(LOG, 'w'))

// Read original dev command
let rawCmd = ''
try {
  rawCmd = readFileSync(ORIG, 'utf-8').trim()
} catch {
  console.error('[youmindag] No se encontró .youmindag/dev-original.txt')
  console.error('[youmindag] Ejecuta: youmindag dev --wrap')
  process.exit(1)
}

// Determine if shell is needed (compound commands)
const needsShell = /&&|\||;/.test(rawCmd)

const opts = {
  stdio: ['inherit', 'pipe', 'pipe'],
  env: { ...process.env },
  shell: needsShell,
}

let bin, args
if (needsShell) {
  bin = rawCmd
  args = []
} else {
  const tokens = rawCmd.match(/"([^"]+)"|'([^']+)'|(\S+)/g).map(s => s.replace(/^["']|["']$/g, ''))
  bin = tokens[0]
  args = tokens.slice(1)
}

const child = spawn(bin, args, opts)

// Write PID for youmindag dev --status
try {
  writeFileSync(PID_FILE, JSON.stringify({ pid: child.pid, startedAt: new Date().toISOString() }))
} catch {}

const ts = () => `[${new Date().toISOString().slice(11, 19)}]`

const pipe = (source, marker) => {
  let buf = ''
  source.on('data', (d) => {
    buf += d.toString()
    const lines = buf.split('\n')
    buf = lines.pop()
    for (const line of lines) {
      try { appendFileSync(LOG, `${ts()} ${line}\n`) } catch {}
    }
    process[marker].write(d)
  })
}

pipe(child.stdout, 'stdout')
pipe(child.stderr, 'stderr')

child.on('exit', (code) => {
  try { writeFileSync(PID_FILE, JSON.stringify({ pid: null, exitCode: code })) } catch {}
  process.exit(code)
})

process.on('SIGTERM', () => child.kill())
process.on('SIGINT', () => { child.kill(); process.exit(0) })
