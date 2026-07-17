// YouMindAG — capa de enforcement para Claude Code.
// Instala hooks en .claude/settings.json (merge idempotente, jamás pisa la
// config del usuario), asegura CLAUDE.md → @AGENTS.md y copia la skill.

import { existsSync, readFileSync, writeFileSync, mkdirSync, rmSync } from 'fs'
import { join } from 'path'
import { copyDir } from './fs-helpers.mjs'

const YM_MARKER = 'ym-hook-'
const CLAUDE_MD_BEGIN = '<!-- BEGIN:youmindag -->'
const CLAUDE_MD_END = '<!-- END:youmindag -->'

// Cada evento puede tener varias entradas (una por matcher). El merge es
// idempotente por matcher: si ya existe una entrada youmindag con el mismo
// matcher, no se duplica; si falta una entrada nueva (p.ej. tras un upgrade
// que agrega un matcher adicional), se agrega sin tocar las demás.
const HOOK_ENTRIES = {
  SessionStart: [
    { hooks: [{ type: 'command', command: 'node scripts/ym-hook-session-start.mjs', timeout: 10 }] },
  ],
  PreToolUse: [
    { matcher: 'Bash', hooks: [{ type: 'command', command: 'node scripts/ym-hook-guard.mjs', timeout: 10 }] },
    { matcher: 'Grep|Glob', hooks: [{ type: 'command', command: 'node scripts/ym-hook-guard.mjs', timeout: 10 }] },
  ],
  PostToolUse: [
    { matcher: 'Edit|Write|MultiEdit', hooks: [{ type: 'command', command: 'node scripts/ym-hook-posttool.mjs', timeout: 10 }] },
  ],
}

export function detectClaudeCode(cwd) {
  return existsSync(join(cwd, '.claude')) || existsSync(join(cwd, 'CLAUDE.md'))
}

function entryHasYmHook(entry) {
  return JSON.stringify(entry || {}).includes(YM_MARKER)
}

// Merge idempotente: agrega las entradas youmindag solo si no existen ya
// (comparando por evento + matcher, no por evento completo). Si el
// settings.json del usuario está corrupto, NO lo toca.
export function mergeClaudeSettings(cwd) {
  const dir = join(cwd, '.claude')
  const p = join(dir, 'settings.json')

  let settings = {}
  if (existsSync(p)) {
    try {
      settings = JSON.parse(readFileSync(p, 'utf-8'))
    } catch {
      return { ok: false, message: '.claude/settings.json corrupto — no se modificó' }
    }
    if (typeof settings !== 'object' || settings === null || Array.isArray(settings)) {
      return { ok: false, message: '.claude/settings.json con formato inesperado — no se modificó' }
    }
  }

  if (typeof settings.hooks !== 'object' || settings.hooks === null || Array.isArray(settings.hooks)) {
    settings.hooks = {}
  }

  let added = 0
  for (const [event, wantedEntries] of Object.entries(HOOK_ENTRIES)) {
    const existing = Array.isArray(settings.hooks[event]) ? settings.hooks[event] : []
    for (const wanted of wantedEntries) {
      const alreadyHasThisMatcher = existing.some(e => (e?.matcher || null) === (wanted.matcher || null) && entryHasYmHook(e))
      if (!alreadyHasThisMatcher) {
        existing.push(wanted)
        added++
      }
    }
    settings.hooks[event] = existing
  }

  if (added === 0) return { ok: true, message: 'hooks ya instalados (sin cambios)' }

  mkdirSync(dir, { recursive: true })
  writeFileSync(p, JSON.stringify(settings, null, 2) + '\n')
  return { ok: true, message: `${added} hook${added === 1 ? '' : 's'} agregado${added === 1 ? '' : 's'}` }
}

export function upgradeClaudeMd(cwd) {
  const p = join(cwd, 'CLAUDE.md')
  if (!existsSync(p)) {
    writeFileSync(p, '@AGENTS.md\n')
    return 'CLAUDE.md creado (@AGENTS.md)'
  }
  const content = readFileSync(p, 'utf-8')
  if (content.includes('AGENTS.md')) return 'CLAUDE.md ya referencia AGENTS.md (sin cambios)'
  writeFileSync(p, content.trimEnd() + `\n\n${CLAUDE_MD_BEGIN}\n@AGENTS.md\n${CLAUDE_MD_END}\n`)
  return 'CLAUDE.md — bloque @AGENTS.md agregado'
}

export function installClaudeLayer(cwd, templateDir) {
  const results = []

  const settingsResult = mergeClaudeSettings(cwd)
  results.push(`⚙️  .claude/settings.json — ${settingsResult.message}`)

  results.push(`📄 ${upgradeClaudeMd(cwd)}`)

  const skillSrc = join(templateDir, '.claude', 'skills', 'youmindag')
  const skillDst = join(cwd, '.claude', 'skills', 'youmindag')
  if (existsSync(skillSrc)) {
    copyDir(skillSrc, skillDst, true)
    results.push('🧠 .claude/skills/youmindag — instalada')
  }

  return { ok: settingsResult.ok, results }
}

export function uninstallClaudeLayer(cwd) {
  const results = []

  const p = join(cwd, '.claude', 'settings.json')
  if (existsSync(p)) {
    try {
      const settings = JSON.parse(readFileSync(p, 'utf-8'))
      if (settings && typeof settings.hooks === 'object' && settings.hooks !== null) {
        let removed = 0
        for (const event of Object.keys(settings.hooks)) {
          if (!Array.isArray(settings.hooks[event])) continue
          const before = settings.hooks[event].length
          settings.hooks[event] = settings.hooks[event].filter(e => !entryHasYmHook(e))
          removed += before - settings.hooks[event].length
          if (settings.hooks[event].length === 0) delete settings.hooks[event]
        }
        if (removed > 0) {
          writeFileSync(p, JSON.stringify(settings, null, 2) + '\n')
          results.push(`⚙️  .claude/settings.json — ${removed} hook${removed === 1 ? '' : 's'} youmindag retirados`)
        }
      }
    } catch {
      results.push('⚠️  .claude/settings.json corrupto — no se modificó')
    }
  }

  const claudeMd = join(cwd, 'CLAUDE.md')
  if (existsSync(claudeMd)) {
    try {
      const content = readFileSync(claudeMd, 'utf-8')
      if (content.trim() === '@AGENTS.md') {
        rmSync(claudeMd)
        results.push('📄 CLAUDE.md eliminado (solo contenía @AGENTS.md)')
      } else if (content.includes(CLAUDE_MD_BEGIN)) {
        const begin = content.indexOf(CLAUDE_MD_BEGIN)
        const end = content.indexOf(CLAUDE_MD_END)
        if (begin !== -1 && end !== -1) {
          writeFileSync(claudeMd, (content.slice(0, begin) + content.slice(end + CLAUDE_MD_END.length)).trimEnd() + '\n')
          results.push('📄 CLAUDE.md — bloque youmindag retirado')
        }
      }
    } catch {}
  }

  const skillDir = join(cwd, '.claude', 'skills', 'youmindag')
  if (existsSync(skillDir)) {
    try {
      rmSync(skillDir, { recursive: true, force: true })
      results.push('🧠 .claude/skills/youmindag — eliminada')
    } catch {}
  }

  return results
}

export function claudeLayerStatus(cwd) {
  let hooksOk = false
  let guardMode = 'warn'
  try {
    const settings = JSON.parse(readFileSync(join(cwd, '.claude', 'settings.json'), 'utf-8'))
    hooksOk = JSON.stringify(settings.hooks || {}).includes(YM_MARKER)
  } catch {}
  try {
    const cfg = JSON.parse(readFileSync(join(cwd, '.youmindag.json'), 'utf-8'))
    if (cfg.guard) guardMode = cfg.guard
  } catch {}

  let claudeMdOk = false
  try {
    claudeMdOk = readFileSync(join(cwd, 'CLAUDE.md'), 'utf-8').includes('AGENTS.md')
  } catch {}

  const scriptsOk = ['ym-hook-guard.mjs', 'ym-hook-session-start.mjs', 'ym-hook-posttool.mjs', 'ym-sync-background.mjs']
    .every(s => existsSync(join(cwd, 'scripts', s)))

  return {
    detected: detectClaudeCode(cwd),
    hooksOk,
    claudeMdOk,
    skillOk: existsSync(join(cwd, '.claude', 'skills', 'youmindag', 'SKILL.md')),
    scriptsOk,
    guardMode,
  }
}

// Cursor: regla persistente si el proyecto usa .cursor/
export function installCursorRule(cwd) {
  if (!existsSync(join(cwd, '.cursor'))) return null
  const rulesDir = join(cwd, '.cursor', 'rules')
  const rulePath = join(rulesDir, 'youmindag.mdc')
  if (existsSync(rulePath)) return '.cursor/rules/youmindag.mdc ya existe (sin cambios)'
  mkdirSync(rulesDir, { recursive: true })
  writeFileSync(rulePath, `---
description: Protocolo de contexto YouMindAG
alwaysApply: true
---

Lee AGENTS.md antes de cualquier tarea. Para explorar el codebase usa \`npx youmindag architect <modulo>\` (contexto de módulo) y \`npx youmindag references <simbolo>\` (búsqueda de símbolos) en lugar de grep/find. Tras editar código ejecuta \`npx graphify update\`.
`)
  return '.cursor/rules/youmindag.mdc creada'
}
