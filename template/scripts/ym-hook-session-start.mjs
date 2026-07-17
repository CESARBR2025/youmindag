#!/usr/bin/env node
// YouMindAG — SessionStart hook (Claude Code)
// Emite a stdout un resumen compacto del contexto del proyecto para que el
// agente arranque cada sesión conociendo el protocolo y los módulos.
// Solo lectura de archivos locales (sin npx, sin red). FAIL-OPEN: exit 0 siempre.

import { existsSync, readFileSync, readdirSync, statSync } from 'fs'
import { join } from 'path'
import { execFileSync } from 'child_process'

const CODE_EXT_RE = /\.(ts|tsx|js|jsx|mjs|cjs|py|go|rb|java|php|vue|svelte)$/
const MAX_FEATURES_TO_CHECK = 30

function parseComponentPaths(mdContent) {
  const paths = new Set()
  const re = /`([a-zA-Z0-9_./-]+)`/g
  let m
  while ((m = re.exec(mdContent))) {
    if (CODE_EXT_RE.test(m[1])) paths.add(m[1])
  }
  return [...paths]
}

function gitLog1(cwd, pathspecs) {
  try {
    return String(execFileSync('git', ['log', '--oneline', '-1', '--', ...pathspecs], {
      cwd, encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'],
    })).trim()
  } catch { return '' }
}

// Compara, por feature, el último commit del doc contra el último commit de
// los archivos exactos que su tabla `## Componentes` declara. No opina sobre
// docs sin tabla parseable (mejor no decir nada que decir algo impreciso).
function listStaleFeatures(cwd, featuresDir, mdFiles) {
  if (!existsSync(join(cwd, '.git'))) return []
  const stale = []
  for (const file of mdFiles.slice(0, MAX_FEATURES_TO_CHECK)) {
    try {
      const docPath = join(featuresDir, file)
      const content = readFileSync(docPath, 'utf-8')
      const componentPaths = parseComponentPaths(content).filter(p => existsSync(join(cwd, p)))
      if (componentPaths.length === 0) continue

      const docLog = gitLog1(cwd, [docPath])
      if (!docLog) continue
      const sourceLog = gitLog1(cwd, componentPaths)
      if (!sourceLog) continue

      if (docLog.split(' ')[0] !== sourceLog.split(' ')[0]) {
        stale.push(file.replace('.md', ''))
      }
    } catch { /* seguir con el siguiente doc */ }
  }
  return stale
}

function getBovedaDir(cwd) {
  try {
    const data = JSON.parse(readFileSync(join(cwd, '.youmindag.json'), 'utf-8'))
    if (data.bovedaDir && existsSync(join(cwd, data.bovedaDir))) return data.bovedaDir
  } catch {}
  try {
    const match = readdirSync(cwd).find(e => e.startsWith('boveda-') && statSync(join(cwd, e)).isDirectory())
    if (match) return match
  } catch {}
  if (existsSync(join(cwd, 'boveda'))) return 'boveda'
  return null
}

function resolveEntry(parentDir, name) {
  const direct = join(parentDir, name)
  if (existsSync(direct)) return direct
  try {
    const target = name.normalize('NFC')
    const match = readdirSync(parentDir).find(e => e.normalize('NFC') === target)
    if (match) return join(parentDir, match)
  } catch {}
  return direct
}

function main() {
  const cwd = process.cwd()
  if (!existsSync(join(cwd, '.youmindag.json'))) return

  const lines = []
  lines.push('[YouMindAG] Este proyecto tiene bóveda de contexto instalada.')
  lines.push('Protocolo: 1) `npx youmindag architect <modulo>` para contexto, 2) `npx youmindag references <simbolo>` en vez de grep, 3) `npx graphify update` tras editar código.')

  const bovedaDir = getBovedaDir(cwd)
  if (bovedaDir) {
    const featuresDir = resolveEntry(join(cwd, bovedaDir), '🧩 Features')
    if (existsSync(featuresDir)) {
      try {
        const mdFiles = readdirSync(featuresDir).filter(f => f.endsWith('.md') && f !== 'Index.md')
        const mods = mdFiles.map(f => f.replace('.md', ''))
        if (mods.length > 0) lines.push(`Módulos documentados: ${mods.slice(0, 20).join(', ')}`)

        try {
          const stale = listStaleFeatures(cwd, featuresDir, mdFiles)
          if (stale.length > 0) {
            lines.push(`Features posiblemente desactualizados (código cambió, doc no): ${stale.slice(0, 15).join(', ')}`)
          }
        } catch { /* no bloquear el resumen si esto falla */ }
      } catch {}
    }
  }

  const graphPath = join(cwd, '.graphify', 'graph.json')
  if (existsSync(graphPath)) {
    try {
      const ageMin = Math.round((Date.now() - statSync(graphPath).mtimeMs) / 60000)
      const age = ageMin < 60 ? `${ageMin}min` : `${Math.round(ageMin / 60)}h`
      lines.push(ageMin > 120
        ? `Grafo de código: actualizado hace ${age} (stale — ejecuta \`npx youmindag sync\`)`
        : `Grafo de código: actualizado hace ${age}`)
    } catch {}
  } else {
    lines.push('Grafo de código: no generado (ejecuta `npx youmindag sync`)')
  }

  const decisionsPath = join(cwd, '.youmindag', 'decisions.jsonl')
  if (existsSync(decisionsPath)) {
    try {
      const decisions = readFileSync(decisionsPath, 'utf-8').trim().split('\n').filter(Boolean)
        .map(l => { try { return JSON.parse(l) } catch { return null } })
        .filter(Boolean)
        .slice(-3)
      if (decisions.length > 0) {
        lines.push('Últimas decisiones registradas:')
        for (const d of decisions) {
          const text = d.text || d.decision || ''
          if (text) lines.push(`  - ${String(text).slice(0, 120)}`)
        }
      }
    } catch {}
  }

  process.stdout.write(lines.slice(0, 30).join('\n') + '\n')
}

try { main() } catch {}
process.exit(0)
