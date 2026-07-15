// YouMindAG — AGENTS.md upgrade and context-map merge logic

import { existsSync, readFileSync, writeFileSync, mkdirSync, copyFileSync } from 'fs'
import { join, dirname } from 'path'

const BEGIN_MARKER = '<!-- BEGIN:youmindag -->'
const END_MARKER = '<!-- END:youmindag -->'

function ensureDir(p) { mkdirSync(dirname(p), { recursive: true }) }

export function upgradeAgentsMd(cwd, templateDir) {
  const agentsPath = join(cwd, 'AGENTS.md')
  const templatePath = join(templateDir, 'AGENTS.md')

  if (!existsSync(agentsPath)) {
    copyFileSync(templatePath, agentsPath)
    return 'creado (no existía)'
  }

  if (!existsSync(templatePath)) return 'omitido (template no encontrado)'

  const current = readFileSync(agentsPath, 'utf-8')
  const template = readFileSync(templatePath, 'utf-8')

  const tBegin = template.indexOf(BEGIN_MARKER)
  const tEnd = template.indexOf(END_MARKER)
  if (tBegin === -1 || tEnd === -1) return 'omitido (template sin markers)'

  const newContent = template.slice(tBegin + BEGIN_MARKER.length, tEnd)

  // Backup
  const backupPath = join(cwd, 'AGENTS.md.bak')
  ensureDir(backupPath)
  copyFileSync(agentsPath, backupPath)

  const cBegin = current.indexOf(BEGIN_MARKER)
  const cEnd = current.indexOf(END_MARKER)

  if (cBegin !== -1 && cEnd !== -1) {
    const updated = current.slice(0, cBegin + BEGIN_MARKER.length) + newContent + current.slice(cEnd)
    ensureDir(agentsPath)
    writeFileSync(agentsPath, updated)
    return 'actualizado (merge)'
  }

  const before = cBegin !== -1 ? current.slice(0, cBegin + BEGIN_MARKER.length) : ''
  const after = cEnd !== -1 ? current.slice(cEnd) : ''

  if (!before && !after) {
    ensureDir(agentsPath)
    writeFileSync(agentsPath, template)
    return 'actualizado (reemplazo total)'
  }

  ensureDir(agentsPath)
  writeFileSync(agentsPath, before + BEGIN_MARKER + newContent + END_MARKER + after)
  return 'actualizado (merge + markers nuevos)'
}

export function mergeContextMap(cwd, templateDir) {
  const currentPath = join(cwd, '.opencode', 'context-map.yaml')
  const templatePath = join(templateDir, '.opencode', 'context-map.yaml')

  if (!existsSync(currentPath)) {
    ensureDir(currentPath)
    copyFileSync(templatePath, currentPath)
    return 'creado (no existía)'
  }
  if (!existsSync(templatePath)) return 'omitido (template no encontrado)'

  const current = readFileSync(currentPath, 'utf-8')
  const template = readFileSync(templatePath, 'utf-8')

  const currentHasContent = current.split('\n').filter(l => l.trim() && !l.trim().startsWith('#')).length > 2

  if (!currentHasContent) {
    ensureDir(currentPath)
    writeFileSync(currentPath, template)
    return 'actualizado (vacío → template)'
  }

  return 'sin cambios (preservado)'
}
