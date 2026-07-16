// YouMindAG — vault path detection and auto-generated markers

import { existsSync, readFileSync, mkdirSync, writeFileSync, readdirSync, statSync, appendFileSync } from 'fs'
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
  const data = readYoumindagData(cwd)
  return data.version || null
}

export function readYoumindagData(cwd) {
  const p = join(cwd, YOUMINDAG_JSON)
  if (!existsSync(p)) return {}
  try { return JSON.parse(readFileSync(p, 'utf-8')) } catch { return {} }
}


export function writeYoumindagData(cwd, data) {
  const p = join(cwd, YOUMINDAG_JSON)
  mkdirSync(dirname(p), { recursive: true })
  writeFileSync(p, JSON.stringify(data, null, 2) + '\n')
}

export function readSessionHistory(cwd) {
  const p = join(cwd, '.youmindag', 'session.jsonl')
  if (!existsSync(p)) return []
  try {
    return readFileSync(p, 'utf-8').trim().split('\n').filter(Boolean).map(line => {
      try { return JSON.parse(line) } catch { return null }
    }).filter(Boolean)
  } catch { return [] }
}

export function readDecisions(cwd) {
  const p = join(cwd, '.youmindag', 'decisions.jsonl')
  if (!existsSync(p)) return []
  try {
    return readFileSync(p, 'utf-8').trim().split('\n').filter(Boolean).map(line => {
      try { return JSON.parse(line) } catch { return null }
    }).filter(Boolean)
  } catch { return [] }
}

export function appendSessionEvent(cwd, key, text) {
  const p = join(cwd, '.youmindag', 'session.jsonl')
  mkdirSync(dirname(p), { recursive: true })
  const entry = JSON.stringify({ timestamp: new Date().toISOString(), key, text }) + '\n'
  if (existsSync(p)) {
    appendFileSync(p, entry)
  } else {
    writeFileSync(p, entry)
  }
}

export function appendDecision(cwd, decision, rationale) {
  const p = join(cwd, '.youmindag', 'decisions.jsonl')
  mkdirSync(dirname(p), { recursive: true })
  const entry = JSON.stringify({ timestamp: new Date().toISOString(), decision, rationale }) + '\n'
  if (existsSync(p)) {
    appendFileSync(p, entry)
  } else {
    writeFileSync(p, entry)
  }
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
