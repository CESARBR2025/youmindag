#!/usr/bin/env node
// YouMindAG — sincronización en background (grafo + bóveda estructural).
// Lo lanza ym-hook-posttool.mjs como proceso detached y corre de forma
// completamente independiente del ciclo de vida del hook que lo invocó
// (el hook ya salió con exit 0 mucho antes de que esto termine).
//
// Actualiza:
//   - .graphify/graph.json  (npx graphify update)
//   - secciones auto-generables de la bóveda (node scripts/populate-vault.mjs)
//
// NO commitea nada — eso sigue siendo decisión del usuario. La "bóveda N
// commits atrasada" que reporta `doctor` mide distancia en git log, no
// contenido; este script mantiene el contenido fresco, no el historial.

import { existsSync, writeFileSync, unlinkSync, mkdirSync } from 'fs'
import { join } from 'path'
import { execFileSync } from 'child_process'

const cwd = process.argv[2] || process.cwd()
const stateDir = join(cwd, '.youmindag')
const lockPath = join(stateDir, 'sync.lock')
const logPath = join(stateDir, 'sync.log')

function log(line) {
  try {
    mkdirSync(stateDir, { recursive: true })
    writeFileSync(logPath, `[${new Date().toISOString()}] ${line}\n`, { flag: 'a' })
  } catch {}
}

function run(cmd, args) {
  try {
    execFileSync(cmd, args, { cwd, stdio: 'ignore', timeout: 180000 })
    return true
  } catch (e) {
    log(`falló: ${cmd} ${args.join(' ')} — ${e.message}`)
    return false
  }
}

function cleanup() {
  try { unlinkSync(lockPath) } catch {}
}

try {
  const npxBin = process.platform === 'win32' ? 'npx.cmd' : 'npx'

  if (existsSync(join(cwd, 'node_modules', '@sentropic', 'graphify'))) {
    if (run(npxBin, ['graphify', 'update'])) log('grafo actualizado')
  }

  const populateScript = join(cwd, 'scripts', 'populate-vault.mjs')
  if (existsSync(populateScript)) {
    if (run(process.execPath, [populateScript])) log('bóveda estructural repoblada')
  }

  log('auto-sync completado')
} catch (e) {
  log(`error inesperado: ${e.message}`)
} finally {
  cleanup()
}
