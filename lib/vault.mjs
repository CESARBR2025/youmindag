// YouMindAG — vault path detection and auto-generated markers

import { existsSync, readFileSync, mkdirSync, writeFileSync, readdirSync, statSync } from 'fs'
import { join, dirname } from 'path'

export const YOUMINDAG_JSON = '.youmindag.json'

export const AUTO_START = '<!-- AUTO-GENERATED START -->'
export const AUTO_END = '<!-- AUTO-GENERATED END -->'

export function getBovedaDir(cwd) {
  // Try .youmindag.json first
  const p = join(cwd, YOUMINDAG_JSON)
  if (existsSync(p)) {
    try {
      const data = JSON.parse(readFileSync(p, 'utf-8'))
      if (data.bovedaDir && existsSync(join(cwd, data.bovedaDir))) return data.bovedaDir
    } catch {}
  }
  // Look for boveda-* directories
  try {
    const entries = readdirSync(cwd)
    const match = entries.find(e => e.startsWith('boveda-') && statSync(join(cwd, e)).isDirectory())
    if (match) return match
  } catch {}
  // Legacy fallback
  if (existsSync(join(cwd, 'boveda'))) return 'boveda'
  return null
}

export function readYoumindagVersion(cwd) {
  const p = join(cwd, YOUMINDAG_JSON)
  if (!existsSync(p)) return null
  try {
    const data = JSON.parse(readFileSync(p, 'utf-8'))
    return data.version || null
  } catch { return null }
}

export function writeBovedaSection(filePath, newContent) {
  const wrapped = AUTO_START + '\n' + newContent.trim() + '\n' + AUTO_END + '\n'
  if (!existsSync(filePath)) {
    mkdirSync(dirname(filePath), { recursive: true })
    writeFileSync(filePath, wrapped)
    return
  }
  const existing = readFileSync(filePath, 'utf-8')
  const startIdx = existing.indexOf(AUTO_START)
  const endIdx = existing.indexOf(AUTO_END)
  if (startIdx !== -1 && endIdx !== -1) {
    const before = existing.slice(0, startIdx)
    const after = existing.slice(endIdx + AUTO_END.length)
    writeFileSync(filePath, before + wrapped + after)
  } else {
    writeFileSync(filePath, wrapped)
  }
}
