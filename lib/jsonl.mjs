import { existsSync, readFileSync, mkdirSync, appendFileSync } from 'fs'
import { join, dirname } from 'path'

export function parseJsonlFile(path) {
  if (!existsSync(path)) return []
  try {
    return readFileSync(path, 'utf-8').trim().split('\n').filter(Boolean).map(line => {
      try { return JSON.parse(line) } catch { return null }
    }).filter(Boolean)
  } catch { return [] }
}

export function normalizeSessionEvent(raw) {
  if (!raw || typeof raw !== 'object') return null
  return {
    ts: raw.ts || raw.timestamp || null,
    key: raw.key || '',
    text: raw.text || '',
  }
}

export function normalizeDecision(raw) {
  if (!raw || typeof raw !== 'object') return null
  return {
    ts: raw.ts || raw.timestamp || null,
    text: raw.text || raw.decision || '',
    sessionId: raw.sessionId || '',
    rationale: raw.rationale || '',
  }
}

export function readSessionEvents(cwd) {
  return parseJsonlFile(join(cwd, '.youmindag', 'session.jsonl'))
    .map(normalizeSessionEvent)
    .filter(Boolean)
}

export function readDecisionEntries(cwd) {
  return parseJsonlFile(join(cwd, '.youmindag', 'decisions.jsonl'))
    .map(normalizeDecision)
    .filter(Boolean)
}

export function appendSessionEvent(cwd, key, text) {
  const p = join(cwd, '.youmindag', 'session.jsonl')
  mkdirSync(dirname(p), { recursive: true })
  const entry = JSON.stringify({ ts: new Date().toISOString(), key, text: text || '' }) + '\n'
  appendFileSync(p, entry)
}

export function appendDecision(cwd, text, rationale) {
  const p = join(cwd, '.youmindag', 'decisions.jsonl')
  mkdirSync(dirname(p), { recursive: true })
  const entry = JSON.stringify({ ts: new Date().toISOString(), text, rationale: rationale || '', sessionId: '' }) + '\n'
  appendFileSync(p, entry)
}
