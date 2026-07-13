// scripts/trace-components.mjs
// Inyecta logger de ciclo de vida en componentes React para debug
// Uso: node scripts/trace-components.mjs Toaster LoadingProvider
//       node scripts/trace-components.mjs --undo

import { existsSync, readFileSync, writeFileSync, copyFileSync, unlinkSync, readdirSync } from 'fs'
import { join, dirname, extname } from 'path'
import { fileURLToPath } from 'url'
import { execSync } from 'child_process'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')

const GREEN = '\x1b[32m'
const YELLOW = '\x1b[33m'
const RED = '\x1b[31m'
const CYAN = '\x1b[36m'
const RESET = '\x1b[0m'

const BAK_EXT = '.trace.bak'
const SEARCH_DIRS = ['app', 'lib', 'src', 'components']

function findComponentFile(name, root) {
  const extensions = ['.tsx', '.jsx', '.ts', '.js']
  for (const dir of SEARCH_DIRS) {
    const base = join(root, dir)
    if (!existsSync(base)) continue
    const found = searchRecursive(base, name, extensions)
    if (found) return found
  }
  return null
}

function searchRecursive(dir, name, extensions) {
  try {
    const entries = readdirSync(dir, { withFileTypes: true })
    for (const e of entries) {
      const full = join(dir, e.name)
      if (e.isDirectory() && !e.name.startsWith('.') && e.name !== 'node_modules') {
        const result = searchRecursive(full, name, extensions)
        if (result) return result
      } else if (e.isFile()) {
        const base = e.name.replace(/\.[^.]+$/, '')
        if (base === name && extensions.includes(extname(e.name))) {
          return full
        }
      }
    }
  } catch {}
  return null
}

function injectTrace(source, componentName) {
  if (source.includes('__ymTrace')) {
    return { injected: false, content: source }
  }

  let content = source

  const hasReactImport = /import\s+(?:React\s*,|{[\s\S]*?})?\s*from\s+['"]react['"]/.test(content)
  if (!hasReactImport) {
    if (content.match(/import\s/)) {
      content = content.replace(/(import\s[^;]+;\n)/, `$1import { useEffect } from 'react'\n`)
    } else {
      content = `import { useEffect } from 'react'\n${content}`
    }
  } else if (/import\s+React\s*,?\s*\{[^}]*\}\s*from\s+['"]react['"]/.test(content)) {
    content = content.replace(
      /(import\s+React\s*,?\s*\{)([^}]*)(\}\s*from\s+['"]react['"])/,
      (_m, p1, p2, p3) => {
        const members = p2.split(',').map(s => s.trim()).filter(Boolean)
        if (!members.includes('useEffect')) members.push('useEffect')
        return `${p1} ${members.join(', ')} ${p3}`
      }
    )
  } else if (/import\s+\{[^}]*\}\s+from\s+['"]react['"]/.test(content)) {
    content = content.replace(
      /(import\s+\{)([^}]*)(\}\s+from\s+['"]react['"])/,
      (_m, p1, p2, p3) => {
        const members = p2.split(',').map(s => s.trim()).filter(Boolean)
        if (!members.includes('useEffect')) members.push('useEffect')
        return `${p1} ${members.join(', ')} ${p3}`
      }
    )
  } else if (/import\s+\w+\s+from\s+['"]react['"]/.test(content)) {
    content = content.replace(
      /import\s+(\w+)\s+from\s+['"]react['"]/,
      `import $1, { useEffect } from 'react'`
    )
  }

  const hof = `
// ── YouMindAG Trace — auto-injected lifecycle logger
function __ymTrace(Component, name) {
  return function __ymTraced(props) {
    useEffect(() => {
      console.log(\`%c[MOUNT] \${name}\`, 'color: #22c55e; font-weight: bold')
      return () => console.log(\`%c[UNMOUNT] \${name}\`, 'color: #ef4444; font-weight: bold')
    }, [])
    console.log(\`%c[RENDER] \${name}\`, 'color: #3b82f6')
    return /*#__PURE__*/ React.createElement(Component, props)
  }
  __ymTrace._isYMTraced = true
}
// ── End YouMindAG Trace
`

  content = hof + '\n' + content

  const exportPatterns = [
    new RegExp(`export\\s+default\\s+function\\s+(${componentName})\\b`),
    new RegExp(`export\\s+default\\s+(${componentName})\\b`),
    new RegExp(`export\\s+default\\s+function\\s+(\\w+)\\b`),
  ]

  for (const pat of exportPatterns) {
    const match = content.match(pat)
    if (match) {
      const exportedName = match[1]
      if (match[0].startsWith('export default function')) {
        content = content.replace(
          new RegExp(`export\\s+default\\s+function\\s+${exportedName}\\b`),
          `function ${exportedName}`
        )
      } else if (match[0].startsWith('export default')) {
        content = content.replace(
          new RegExp(`export\\s+default\\s+${exportedName}\\b`),
          ``
        )
      }
      if (!content.includes(`export default __ymTrace(${exportedName}`)) {
        content += `\nexport default __ymTrace(${exportedName}, '${componentName}')\n`
      }
      return { injected: true, content }
    }
  }

  const namedExportPat = new RegExp(`export\\s+(async\\s+)?function\\s+(${componentName})\\b`)
  const namedMatch = content.match(namedExportPat)
  if (namedMatch) {
    content = content.replace(
      new RegExp(`export\\s+function\\s+(${componentName})\\b`),
      `function $1`
    )
    content += `\nexport { __ymTrace(${componentName}, '${componentName}') as ${componentName} }\n`
    return { injected: true, content }
  }

  return { injected: false, content }
}

function removeTrace(source) {
  const startMarker = '// ── YouMindAG Trace'
  const endMarker = '// ── End YouMindAG Trace'
  const startIdx = source.indexOf(startMarker)
  const endIdx = source.indexOf(endMarker)
  if (startIdx === -1) return source

  let content = source.slice(0, startIdx) + source.slice(endIdx + endMarker.length)
  content = content.replace(/\n{3,}/g, '\n\n')
  content = content.replace(
    /\nexport default __ymTrace\((\w+),\s*'(\w+)'\)\s*\n/,
    '\nexport default function $1 '
  )

  return content
}

function checkDirtyFiles(filePaths, root) {
  if (!existsSync(join(root, '.git'))) return []

  let dirty = []
  try {
    const porcelain = String(execSync('git status --porcelain', { cwd: root, encoding: 'utf-8' })).trim()
    if (!porcelain) return []

    const dirtyPaths = porcelain.split('\n').map(line => {
      const parts = line.trim().split(/\s+/)
      return join(root, parts[parts.length - 1])
    })

    for (const fp of filePaths) {
      if (dirtyPaths.some(d => d === fp || fp.startsWith(d) || d.startsWith(fp))) {
        const rel = fp.replace(root + '/', '')
        const statusLine = porcelain.split('\n').find(l => l.includes(rel.replace(/^.*?\//, '')) || l.includes(rel))
        dirty.push({ path: fp, rel, status: statusLine ? statusLine.trim().slice(0, 2) : '?' })
      }
    }
  } catch { return [] }
  return dirty
}

if (process.argv[2] === '--undo') {
  console.log(`${CYAN}♻️  Restaurando componentes originales...${RESET}\n`)
  let restored = 0
  for (const dir of SEARCH_DIRS) {
    const base = join(ROOT, dir)
    if (!existsSync(base)) continue
    function restoreRecursive(d) {
      try {
        const entries = readdirSync(d, { withFileTypes: true })
        for (const e of entries) {
          const full = join(d, e.name)
          if (e.isDirectory() && !e.name.startsWith('.') && e.name !== 'node_modules') {
            restoreRecursive(full)
          } else if (e.name.endsWith(BAK_EXT)) {
            const original = full.replace(BAK_EXT, '')
            copyFileSync(full, original)
            unlinkSync(full)
            restored++
            console.log(`  ${GREEN}✅ ${original.replace(ROOT + '/', '')}${RESET}`)
          }
        }
      } catch {}
    }
    restoreRecursive(base)
  }
  console.log(`\n${GREEN}✅ ${restored} archivo${restored === 1 ? '' : 's'} restaurado${restored === 1 ? '' : 's'}${RESET}\n`)
  process.exit(0)
}

const components = process.argv.slice(2).filter(a => !a.startsWith('--'))
const forceFlag = process.argv.includes('--force')

if (components.length === 0) {
  console.error(`${YELLOW}Uso: node scripts/trace-components.mjs Component1 Component2 ...${RESET}`)
  console.error(`${YELLOW}      node scripts/trace-components.mjs --undo${RESET}\n`)
  process.exit(1)
}

console.log(`${CYAN}🔍 Trace de ciclo de vida para: ${components.join(', ')}${RESET}\n`)

// Phase 1: find all component files
const fileMap = new Map()
for (const name of components) {
  const filePath = findComponentFile(name, ROOT)
  if (!filePath) {
    console.log(`  ${YELLOW}⚠️  ${name}: no encontrado${RESET}`)
    continue
  }
  fileMap.set(name, filePath)
}

// Phase 2: check for uncommitted changes
const filesToModify = [...fileMap.values()]
const dirty = checkDirtyFiles(filesToModify, ROOT)
if (dirty.length > 0) {
  if (forceFlag) {
    console.log(`  ${YELLOW}⚠️  --force: ignorando archivos con cambios sin commitear${RESET}\n`)
  } else {
    console.log(`\n${RED}⚠️  Hay cambios sin commitear en archivos que serán modificados:${RESET}`)
    for (const d of dirty) {
      console.log(`  ${RED}   ${d.rel} (${d.status})${RESET}`)
    }
    console.log(`\n${YELLOW}Sugerencia: git stash o git commit antes de ejecutar trace.${RESET}`)
    console.log(`${YELLOW}Usa --force para ignorar esta advertencia y continuar.${RESET}\n`)
    process.exit(1)
  }
}

// Phase 3: inject traces
let traced = 0
for (const [name, filePath] of fileMap) {
  const source = readFileSync(filePath, 'utf-8')
  const result = injectTrace(source, name)

  if (result.injected) {
    const bakPath = filePath + BAK_EXT
    if (!existsSync(bakPath)) {
      copyFileSync(filePath, bakPath)
    }
    writeFileSync(filePath, result.content)
    console.log(`  ${GREEN}✅ ${name} → ${filePath.replace(ROOT + '/', '')}${RESET}`)
    traced++
  } else {
    console.log(`  ${YELLOW}⚠️  ${name}: no se pudo inyectar (formato de export no reconocido)${RESET}`)
  }
}

if (traced > 0) {
  console.log(`\n${GREEN}✅ ${traced} componente${traced === 1 ? '' : 's'} traceado${traced === 1 ? '' : 's'}${RESET}`)
  console.log(`${CYAN}   Ejecuta next dev y abre la consola del navegador para ver los logs.${RESET}`)
  console.log(`${CYAN}   Para restaurar: node scripts/trace-components.mjs --undo${RESET}`)
  console.log(`${CYAN}   Logs: [MOUNT] verde | [UNMOUNT] rojo | [RENDER] azul${RESET}\n`)
}
