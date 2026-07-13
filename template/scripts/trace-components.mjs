// scripts/trace-components.mjs
// Inyecta logger de ciclo de vida en componentes React para debug
// Uso: node scripts/trace-components.mjs Toaster LoadingProvider
//       node scripts/trace-components.mjs --undo

import { existsSync, readFileSync, writeFileSync, copyFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import {
  GREEN, YELLOW, RED, CYAN, RESET,
  findSourceFile, checkDirtyFiles, restoreBackups,
} from './trace-utils.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')

const BAK_EXT = '.trace.bak'
const SEARCH_DIRS = ['app', 'lib', 'src', 'components']
const EXTENSIONS = ['.tsx', '.jsx', '.ts', '.js']

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

// ─── Main ──────────────────────────────────────────────────────

if (process.argv[2] === '--undo') {
  console.log(`${CYAN}♻️  Restaurando componentes originales...${RESET}\n`)
  const restored = restoreBackups(ROOT, BAK_EXT, SEARCH_DIRS)
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

const fileMap = new Map()
for (const name of components) {
  const filePath = findSourceFile(name, ROOT, SEARCH_DIRS, EXTENSIONS)
  if (!filePath) {
    console.log(`  ${YELLOW}⚠️  ${name}: no encontrado${RESET}`)
    continue
  }
  fileMap.set(name, filePath)
}

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
