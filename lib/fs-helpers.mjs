// YouMindAG — DRY_RUN-aware filesystem helpers

import { existsSync, writeFileSync, mkdirSync, copyFileSync, readdirSync, statSync, rmSync } from 'fs'
import { join, dirname } from 'path'
import { execSync } from 'child_process'
import { YELLOW, RESET } from '../lib/utils.mjs'

let _dryRun = false

export function getDryRun() { return _dryRun }
export function setDryRun(val) { _dryRun = val }

export function log(msg) { console.log(msg) }

export function parseEnvFile(cwd) {
  let envContent = null
  for (const name of ['.env', '.env.example']) {
    const p = join(cwd, name)
    if (existsSync(p)) {
      envContent = readFileSync(p, 'utf-8')
      break
    }
  }
  if (!envContent) return {}
  const vars = {}
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim()
    if (trimmed.startsWith('#') || !trimmed) continue
    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)/)
    if (match) {
      vars[match[1]] = match[2].replace(/^["']|["']$/g, '')
    }
  }
  return vars
}

export function copyDir(src, dst, overwrite = false) {
  if (!existsSync(src)) return
  mkdirSync(dst, { recursive: true })
  for (const entry of readdirSync(src)) {
    const srcPath = join(src, entry)
    const dstPath = join(dst, entry)
    const st = statSync(srcPath)
    if (st.isDirectory()) {
      copyDir(srcPath, dstPath, overwrite)
    } else {
      if (existsSync(dstPath) && !overwrite) continue
      copyFileSync(srcPath, dstPath)
    }
  }
}

export function maybeWriteFile(filePath, content) {
  if (_dryRun) {
    console.log(`  ${YELLOW}[DRY-RUN] Escribiría: ${filePath}${RESET}`)
    return
  }
  mkdirSync(dirname(filePath), { recursive: true })
  writeFileSync(filePath, content)
}

export function maybeCopyFile(src, dst) {
  if (_dryRun) {
    console.log(`  ${YELLOW}[DRY-RUN] Copiaría: ${src} → ${dst}${RESET}`)
    return
  }
  copyFileSync(src, dst)
}

export function maybeCopyDir(src, dst, overwrite = false) {
  if (_dryRun) {
    console.log(`  ${YELLOW}[DRY-RUN] Copiaría directorio: ${src} → ${dst}${RESET}`)
    return
  }
  copyDir(src, dst, overwrite)
}

export function maybeExecSync(cmd, opts) {
  if (_dryRun) {
    console.log(`  ${YELLOW}[DRY-RUN] Ejecutaría: ${cmd}${RESET}`)
    return ''
  }
  return execSync(cmd, opts)
}

export function maybeRmSync(p) {
  if (_dryRun) {
    console.log(`  ${YELLOW}[DRY-RUN] Eliminaría: ${p}${RESET}`)
    return
  }
  try { rmSync(p) } catch {}
}
