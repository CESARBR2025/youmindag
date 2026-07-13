// scripts/trace-client.mjs
// Inyecta shadowing de hooks (useEffect, useState) en componentes React cliente
// Uso: node scripts/trace-client.mjs LoginContent
//       node scripts/trace-client.mjs --undo

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

const BAK_EXT = '.client-trace.bak'
const SEARCH_DIRS = ['app', 'lib', 'src', 'components']
const EXTENSIONS = ['.tsx', '.jsx', '.ts', '.js']

const YM_BLOCK_START = '// ── YouMindAG Client Trace block'
const YM_BLOCK_END = '// ── End YouMindAG Client Trace block'

const TRACE_HELPERS = `// ── YouMindAG Client Trace — injected helpers
/*__YM_TRACE_HELPERS__*/
// ── End YouMindAG Client Trace — injected helpers`

function buildHelperCode(componentName) {
  return `
let __ym_eff_id = 0
function __ymTraceEffect(rawEffect, comp) {
  return (fn, deps) => {
    const tid = ++__ym_eff_id
    console.log(\`%c[CLIENT] \${comp} useEffect#\${tid} setup\`, 'color:#06b6d4', deps)
    return rawEffect(() => {
      const cfn = fn()
      return () => {
        console.log(\`%c[CLIENT] \${comp} useEffect#\${tid} cleanup\`, 'color:#ef4444')
        if (typeof cfn === 'function') cfn()
      }
    }, deps)
  }
}

let __ym_st_id = 0
function __ymTraceState(rawState, comp) {
  return (init) => {
    const sid = ++__ym_st_id
    const [val, set] = rawState(init)
    const tracedSet = (next) => {
      const nextVal = typeof next === 'function' ? next(val) : next
      console.log(\`%c[CLIENT] \${comp} useState#\${sid}:\`, 'color:#f59e0b', val, '\u2192', nextVal)
      return set(next)
    }
    return [val, tracedSet]
  }
}

const useEffect = __ymTraceEffect(_ym_raw_useEffect, '${componentName}')
const useState = __ymTraceState(_ym_raw_useState, '${componentName}')
`
}

function injectClientTrace(source, componentName) {
  if (source.includes(YM_BLOCK_START)) {
    return { injected: false, content: source }
  }

  // Step 1: find the 'react' import
  let hasUseEffect = false
  let hasUseState = false
  let importLine = null
  let importIdx = -1

  // Try TypeScript AST first
  const tsResult = findReactImportWithTS(source)
  if (tsResult) {
    importLine = tsResult.importLine
    importIdx = tsResult.importIdx
    hasUseEffect = tsResult.hasUseEffect
    hasUseState = tsResult.hasUseState
  } else {
    // Regex fallback
    const regex = /import\s+(?:(?:\w+|\*\s+as\s+\w+)\s*,\s*)?\{([^}]*)\}\s*from\s+['"]react['"]/
    const match = source.match(regex)
    if (match) {
      const specifiers = match[1].split(',').map(s => s.trim().replace(/\s+as\s+\w+$/, ''))
      hasUseEffect = specifiers.includes('useEffect')
      hasUseState = specifiers.includes('useState')
      if (hasUseEffect || hasUseState) {
        importLine = match[0]
        importIdx = match.index
      }
    }
  }

  if (!importLine || importIdx === -1 || (!hasUseEffect && !hasUseState)) {
    return { injected: false, content: source, reason: 'No useEffect/useState imports found' }
  }

  // Step 2: build aliased import
  let aliased = importLine
  if (hasUseEffect) aliased = aliased.replace(/\buseEffect\b/g, '_ym_raw_useEffect')
  if (hasUseState) aliased = aliased.replace(/\buseState\b/g, '_ym_raw_useState')

  // Step 3: build helpers with component name
  const helpers = buildHelperCode(componentName)

  // Step 4: build final content
  const before = source.slice(0, importIdx)
  const after = source.slice(importIdx + importLine.length)

  // Find insertion point for helpers (after the last import line after our transformed one)
  const lines = before.split('\n').concat(aliased.split('\n'))
  const linesAfter = after.split('\n')
  let insertAt = lines.length

  for (let i = 0; i < linesAfter.length; i++) {
    const t = linesAfter[i].trim()
    if (t.startsWith('import ') || t.startsWith('"use server"') || t.startsWith("'use server'") || t.startsWith('"use client"') || t.startsWith("'use client'")) {
      insertAt = lines.length + i + 1
    } else {
      break
    }
  }

  const beforeLines = before.split('\n')
  beforeLines.pop() // remove empty string from split
  const afterLines = linesAfter.slice(0)
  const insertLine = afterLines.splice(insertAt - lines.length, 0, helpers).length  // no-op, just splice

  let result = beforeLines.join('\n')
  if (beforeLines.length > 0) result += '\n'
  result += aliased + '\n' + afterLines.slice(0, insertAt - lines.length).join('\n') + '\n'
  result += helpers + '\n' + afterLines.slice(insertAt - lines.length).join('\n')

  return { injected: true, content: result }
}

function findReactImportWithTS(source) {
  try {
    const ts = require('typescript')
    const sf = ts.createSourceFile('_temp.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
    let result = null

    ts.forEachChild(sf, (node) => {
      if (result) return
      if (!ts.isImportDeclaration(node)) return
      if (node.moduleSpecifier.text !== 'react') return

      const clause = node.importClause
      if (!clause || !clause.namedBindings || !ts.isNamedImports(clause.namedBindings)) return

      const names = clause.namedBindings.elements.map(e => e.name.text)
      const hasUseEffect = names.includes('useEffect')
      const hasUseState = names.includes('useState')

      if (!hasUseEffect && !hasUseState) return

      const lineStart = node.getStart(sf)
      const lineEnd = node.getEnd()

      // Find the actual source text line for this node
      const lineIdx = source.slice(0, lineStart).lastIndexOf('\n') + 1
      const lineSource = source.slice(lineIdx, lineEnd)

      result = {
        importLine: lineSource,
        importIdx: lineIdx,
        hasUseEffect,
        hasUseState,
      }
    })

    return result
  } catch {
    return null
  }
}

// ─── Main ──────────────────────────────────────────────────────

if (process.argv[2] === '--undo') {
  console.log(`${CYAN}\u267b\ufe0f  Restaurando componentes cliente originales...${RESET}\n`)
  const restored = restoreBackups(ROOT, BAK_EXT, SEARCH_DIRS)
  console.log(`\n${GREEN}\u2705 ${restored} archivo${restored === 1 ? '' : 's'} restaurado${restored === 1 ? '' : 's'}${RESET}\n`)
  process.exit(0)
}

const components = process.argv.slice(2).filter(a => !a.startsWith('--'))
const forceFlag = process.argv.includes('--force')

if (components.length === 0) {
  console.error(`${YELLOW}Uso: node scripts/trace-client.mjs Componente1 Componente2 ...${RESET}`)
  console.error(`${YELLOW}      node scripts/trace-client.mjs --undo${RESET}\n`)
  process.exit(1)
}

console.log(`${CYAN}\ud83d\udd0d Client trace para: ${components.join(', ')}${RESET}\n`)

const fileMap = new Map()
for (const name of components) {
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
  const result = injectClientTrace(source, name)

  if (result.injected) {
    const bakPath = filePath + BAK_EXT
    if (!existsSync(bakPath)) {
      copyFileSync(filePath, bakPath)
    }
    writeFileSync(filePath, result.content)
    console.log(`  ${GREEN}\u2705 ${name} \u2192 ${filePath.replace(ROOT + '/', '')}${RESET}`)
    traced++
  } else {
    console.log(`  ${YELLOW}\u26a0\ufe0f  ${name}: no se pudo inyectar (${result.reason || 'formato no reconocido'})${RESET}`)
  }
}

if (traced > 0) {
  console.log(`\n${GREEN}\u2705 ${traced} componente${traced === 1 ? '' : 's'} traceado${traced === 1 ? '' : 's'}${RESET}`)
  console.log(`${CYAN}   Ejecuta next dev y abre la consola del navegador para ver los logs.${RESET}`)
  console.log(`${CYAN}   Para restaurar: node scripts/trace-client.mjs --undo${RESET}`)
  console.log(`${CYAN}   Logs: [CLIENT useEffect#N] setup (cian) | cleanup (rojo) | useState (ámbar)${RESET}\n`)
}
