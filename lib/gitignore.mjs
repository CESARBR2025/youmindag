// YouMindAG — gitignore management (idempotent, fixes Bug 1 duplicate entries)

import { existsSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'

const MARKER = '# YouMindAG — generated knowledge graph'
const ENTRIES = ['.graphify/', 'graphify-visual/', '.youmindag/']

function normalizeLines(content) {
  return content.split('\n').filter(l => {
    const t = l.trim()
    return t && !t.startsWith('# YouMindAG') && !ENTRIES.includes(t)
  })
}

export function ensureGitignoreEntries(cwd) {
  const gitignorePath = join(cwd, '.gitignore')
  const existing = existsSync(gitignorePath) ? readFileSync(gitignorePath, 'utf-8') : ''

  const cleaned = normalizeLines(existing)

  cleaned.push('')
  cleaned.push(MARKER)
  for (const entry of ENTRIES) {
    cleaned.push(entry)
  }

  const result = cleaned.join('\n') + '\n'
  writeFileSync(gitignorePath, result)
}

export function cleanGitignoreEntries(cwd) {
  const gitignorePath = join(cwd, '.gitignore')
  if (!existsSync(gitignorePath)) return
  const content = readFileSync(gitignorePath, 'utf-8')
  const cleaned = normalizeLines(content).join('\n').replace(/\n{3,}/g, '\n\n')
  writeFileSync(gitignorePath, cleaned)
}
