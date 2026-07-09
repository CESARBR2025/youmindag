// scripts/extract-domain.mjs
// Extrae el dominio de una tarea del usuario basado en .opencode/context-map.yaml
import { readFileSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import yaml from 'js-yaml'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const CONTEXT_MAP = join(ROOT, '.opencode', 'context-map.yaml')

let _keywords = null

function loadKeywords() {
  if (_keywords) return _keywords
  if (!existsSync(CONTEXT_MAP)) {
    _keywords = {}
    return _keywords
  }
  const raw = readFileSync(CONTEXT_MAP, 'utf-8')
  const map = yaml.load(raw)
  _keywords = {}
  for (const [domain, entry] of Object.entries(map)) {
    const kws = [domain]
    if (entry.label) {
      const words = entry.label
        .toLowerCase()
        .replace(/[—\-–,]/g, ' ')
        .split(/\s+/)
        .filter(w => w.length > 2)
      kws.push(...words)
    }
    _keywords[domain] = [...new Set(kws)]
  }
  return _keywords
}

export function extractDomain(task) {
  if (!task) return null
  const t = task.toLowerCase()
  const keywords = loadKeywords()

  for (const [domain, kws] of Object.entries(keywords)) {
    for (const kw of kws) {
      if (t.includes(kw)) return domain
    }
  }

  const libMatch = task.match(/lib\/([\w-]+)/)
  if (libMatch) return libMatch[1]

  return null
}

// CLI mode
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const task = process.argv.slice(2).join(' ')
  const domain = extractDomain(task)
  console.log(domain || 'unknown')
}
