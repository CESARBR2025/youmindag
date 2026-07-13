// scripts/trace-server.mjs
// Inyecta logger de entrada/error en funciones server-side para debug
// Uso: node scripts/trace-server.mjs createIncidenteCliente requireOperador
//       node scripts/trace-server.mjs --undo

import { existsSync, readFileSync, writeFileSync, copyFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { createRequire } from 'module'
import {
  GREEN, YELLOW, RED, CYAN, RESET,
  findSourceFile, checkDirtyFiles, restoreBackups,
} from './trace-utils.mjs'

const require = createRequire(import.meta.url)

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')

const BAK_EXT = '.server-trace.bak'
const SEARCH_DIRS = ['app', 'lib', 'src', 'actions']
const EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.mjs']

const YM_HELPER_START = '// ── YouMindAG Server Trace helper'
const YM_HELPER_END = '// ── End YouMindAG Server Trace helper'
const YM_BLOCK_START = '// ── YouMindAG Server Trace block'
const YM_BLOCK_END = '// ── End YouMindAG Server Trace block'

const YM_HELPER_CODE = `
${YM_HELPER_START}
function __ymFmtInputs(args) {
  if (!args) return '(arrow function — usa function declaration para ver inputs)'
  const result = []
  for (let i = 0; i < args.length; i++) {
    try {
      if (args[i] instanceof FormData) {
        result.push(Object.fromEntries(args[i].entries()))
      } else if (typeof args[i] === 'object' && args[i] !== null && typeof args[i] !== 'function') {
        result.push(structuredClone(args[i]))
      } else {
        result.push(args[i])
      }
    } catch {
      result.push(String(args[i]))
    }
  }
  return result.length === 1 ? result[0] : result
}
${YM_HELPER_END}
`

function injectServerTrace(source, fnName) {
  if (source.includes(`[SRV ▶] ${fnName}`)) {
    return { injected: false, content: source }
  }

  let content = source

  // Inject helper after last import / "use server" directive
  if (!content.includes('__ymFmtInputs')) {
    const lines = content.split('\n')
    let insertIdx = 0
    for (let i = 0; i < lines.length; i++) {
      const t = lines[i].trim()
      if (t.startsWith('import ') || t.startsWith('"use server"') || t.startsWith("'use server'")) {
        insertIdx = i + 1
      }
    }
    lines.splice(insertIdx, 0, YM_HELPER_CODE)
    content = lines.join('\n')
  }

  const fnStart = findFunctionBody(content, fnName)
  if (!fnStart) return { injected: false, content: source }

  const entryLog = `console.log(\`%c[SRV \u25b6] ${fnName}\`, 'color:#8b5cf6;font-weight:bold', __ymFmtInputs(arguments))`

  const wrapped = `${entryLog}
  try {
`

  const closeBlock = `
  } catch (__ym_err) {
    console.log(\`%c[SRV \u2717] ${fnName}\`, 'color:#ef4444;font-weight:bold', __ym_err instanceof Error ? __ym_err.message : __ym_err)
    throw __ym_err
  }`

  content =
    content.slice(0, fnStart + 1) +
    `\n${YM_BLOCK_START}\n${wrapped}` +
    content.slice(fnStart + 1) +
    `\n${YM_BLOCK_END}\n${closeBlock}\n`

  return { injected: true, content }
}

function findFunctionBody(source, fnName) {
  // Primary: TypeScript AST
  try {
    const ts = require('typescript')
    const sf = ts.createSourceFile('_temp.ts', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
    let bodyStart = null

    function visit(node) {
      if (bodyStart !== null) return
      if (ts.isFunctionDeclaration(node) && node.name?.text === fnName && node.body) {
        bodyStart = node.body.getStart(sf)
        return
      }
      if (ts.isVariableDeclaration(node) && node.name?.text === fnName &&
          node.initializer && ts.isFunctionLike(node.initializer) && node.initializer.body) {
        bodyStart = node.initializer.body.getStart(sf)
        return
      }
      ts.forEachChild(node, visit)
    }
    visit(sf)

    if (bodyStart !== null) return bodyStart
  } catch {
    // typescript not available — fall through to brace counting
  }

  // Fallback: brace counting
  return findFunctionBodyFallback(source, fnName)
}

function findFunctionBodyFallback(source, fnName) {
  const patterns = [
    new RegExp(`(?:export\\s+)?(?:async\\s+)?function\\s+${escapeRegex(fnName)}\\s*\\([^)]*\\)\\s*\\{`),
    new RegExp(`(?:export\\s+)?const\\s+${escapeRegex(fnName)}\\s*=?\\s*(?:async\\s+)?\\([^)]*\\)\\s*(?::\\s*[^{]+?)?\\s*=>\\s*\\{`),
    new RegExp(`(?:export\\s+)?const\\s+${escapeRegex(fnName)}\\s*:\\s*(?:async\\s+)?\\([^)]*\\)\\s*(?::\\s*[^{]+?)?\\s*=>\\s*\\{`),
  ]

  for (const pat of patterns) {
    const match = source.match(pat)
    if (match) {
      const braceStart = match.index + match[0].length - 1
      const closeBrace = findMatchingBrace(source, braceStart)
      if (closeBrace !== -1) return braceStart
    }
  }

  return null
}

function findMatchingBrace(source, openIdx) {
  let depth = 0
  for (let i = openIdx; i < source.length; i++) {
    const ch = source[i]
    if (ch === '{' && !isInsideLiteral(source, i)) depth++
    else if (ch === '}' && !isInsideLiteral(source, i)) {
      depth--
      if (depth === 0) return i
    }
  }
  return -1
}

function isInsideLiteral(source, pos) {
  let inString = false
  let inTemplate = false
  let inComment = false
  let stringChar = ''
  let i = 0

  while (i < pos) {
    const ch = source[i]
    const next = source[i + 1] || ''

    if (inComment) {
      if (ch === '\n') inComment = false
      i++
      continue
    }

    if (inTemplate) {
      if (ch === '`' && source[i - 1] !== '\\') inTemplate = false
      i++
      continue
    }

    if (inString) {
      if (ch === stringChar && source[i - 1] !== '\\') inString = false
      i++
      continue
    }

    if (ch === '/' && next === '/') { inComment = true; i += 2; continue }
    if (ch === '/' && next === '*') {
      const end = source.indexOf('*/', i + 2)
      if (end !== -1 && end < pos) { i = end + 2; continue }
      inComment = true; i += 2; continue
    }

    if (ch === '"' || ch === "'") { inString = true; stringChar = ch; i++; continue }
    if (ch === '`') { inTemplate = true; i++; continue }

    i++
  }

  return inString || inTemplate || (inComment && inComment !== 'block')
}

function escapeRegex(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') }

// ─── Main ──────────────────────────────────────────────────────

if (process.argv[2] === '--undo') {
  console.log(`${CYAN}\u267b\ufe0f  Restaurando funciones server originales...${RESET}\n`)
  const restored = restoreBackups(ROOT, BAK_EXT, SEARCH_DIRS)
  console.log(`\n${GREEN}\u2705 ${restored} archivo${restored === 1 ? '' : 's'} restaurado${restored === 1 ? '' : 's'}${RESET}\n`)
  process.exit(0)
}

const fnNames = process.argv.slice(2).filter(a => !a.startsWith('--'))
const forceFlag = process.argv.includes('--force')

if (fnNames.length === 0) {
  console.error(`${YELLOW}Uso: node scripts/trace-server.mjs funcion1 funcion2 ...${RESET}`)
  console.error(`${YELLOW}      node scripts/trace-server.mjs --undo${RESET}\n`)
  process.exit(1)
}

console.log(`${CYAN}\ud83d\udd0d Server trace para: ${fnNames.join(', ')}${RESET}\n`)

const fileMap = new Map()
for (const name of fnNames) {
  const filePath = findSourceFile(name, ROOT, SEARCH_DIRS, EXTENSIONS)
  if (!filePath) {
    console.log(`  ${YELLOW}\u26a0\ufe0f  ${name}: no encontrado${RESET}`)
    continue
  }
  fileMap.set(name, filePath)
}

const filesToModify = [...new Set(fileMap.values())]
const dirty = checkDirtyFiles(filesToModify, ROOT)
if (dirty.length > 0) {
  if (forceFlag) {
    console.log(`  ${YELLOW}\u26a0\ufe0f  --force: ignorando archivos con cambios sin commitear${RESET}\n`)
  } else {
    console.log(`\n${RED}\u26a0\ufe0f  Hay cambios sin commitear en archivos que ser\u00e1n modificados:${RESET}`)
    for (const d of dirty) {
      console.log(`  ${RED}   ${d.rel} (${d.status})${RESET}`)
    }
    console.log(`\n${YELLOW}Sugerencia: git stash o git commit antes de ejecutar trace.${RESET}`)
    console.log(`${YELLOW}Usa --force para ignorar esta advertencia y continuar.${RESET}\n`)
    process.exit(1)
  }
}

let traced = 0
for (const [name, filePath] of fileMap) {
  const source = readFileSync(filePath, 'utf-8')
  const result = injectServerTrace(source, name)

  if (result.injected) {
    const bakPath = filePath + BAK_EXT
    if (!existsSync(bakPath)) {
      copyFileSync(filePath, bakPath)
    }
    writeFileSync(filePath, result.content)
    console.log(`  ${GREEN}\u2705 ${name} \u2192 ${filePath.replace(ROOT + '/', '')}${RESET}`)
    traced++
  } else {
    console.log(`  ${YELLOW}\u26a0\ufe0f  ${name}: no se pudo inyectar (funci\u00f3n no encontrada o ya traceada)${RESET}`)
  }
}

if (traced > 0) {
  console.log(`\n${GREEN}\u2705 ${traced} funci\u00f3n${traced === 1 ? '' : 'es'} traceada${traced === 1 ? '' : 's'}${RESET}`)
  console.log(`${CYAN}   Ejecuta next dev y revisa los logs del servidor.${RESET}`)
  console.log(`${CYAN}   Para restaurar: node scripts/trace-server.mjs --undo${RESET}`)
  console.log(`${CYAN}   Logs: [SRV \u25b6] p\u00farpura | [SRV \u2717] rojo en la terminal del servidor${RESET}\n`)
}
