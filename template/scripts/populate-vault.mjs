#!/usr/bin/env node
// scripts/populate-vault.mjs
// Puebla la bóveda con info detectada del proyecto.
// Uso: node scripts/populate-vault.mjs
// Ejecutar DENTRO del directorio del proyecto destino.

import { existsSync, readFileSync, writeFileSync, readdirSync, mkdirSync } from 'fs'
import { join, dirname, basename, relative } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const CWD = process.cwd()

const GREEN = '\x1b[32m'
const YELLOW = '\x1b[33m'
const RESET = '\x1b[0m'

const AUTO_START = '<!-- AUTO-GENERATED START -->'
const AUTO_END = '<!-- AUTO-GENERATED END -->'

function writeBovedaSection(filePath, newContent) {
  const wrapped = AUTO_START + '\n' + newContent.trim() + '\n' + AUTO_END + '\n'
  if (!existsSync(filePath)) {
    mkdirSync(dirname(filePath), { recursive: true })
    writeFileSync(filePath, wrapped)
    return
  }
  const existing = readFileSync(filePath, 'utf-8')
  const startIdx = existing.indexOf(AUTO_START)
  const endIdx = existing.indexOf(AUTO_END)
  if (startIdx !== -1 && endIdx !== -1) {
    const before = existing.slice(0, startIdx)
    const after = existing.slice(endIdx + AUTO_END.length)
    writeFileSync(filePath, before + wrapped + after)
  } else {
    writeFileSync(filePath, wrapped)
  }
}

function populateComandos(cwd) {
  const file = join(cwd, 'boveda', '🛠 Stack', 'Comandos.md')
  const pkgPath = join(cwd, 'package.json')
  if (!existsSync(pkgPath)) return false
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'))
  const scripts = pkg.scripts
  if (!scripts || !Object.keys(scripts).length) return false

  let md = `# Comandos\n\n**Propósito**: Referencia rápida de comandos útiles.\n\n---\n\n| Comando | Script |\n|---------|-------|\n`
  for (const [name, cmd] of Object.entries(scripts)) {
    md += `| \`${name}\` | \`${cmd}\` |\n`
  }
  writeBovedaSection(file, md)
  return true
}

function populateLibrerias(cwd) {
  const file = join(cwd, 'boveda', '🛠 Stack', 'Librerias.md')
  const pkgPath = join(cwd, 'package.json')
  if (!existsSync(pkgPath)) return false
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'))
  const deps = pkg.dependencies
  const devDeps = pkg.devDependencies
  if ((!deps || !Object.keys(deps).length) && (!devDeps || !Object.keys(devDeps).length)) return false

  let md = `# Librerías y Stack\n\n**Propósito**: Dependencias del proyecto.\n\n---\n\n`

  if (deps && Object.keys(deps).length) {
    md += `## Producción\n\n| Paquete | Versión |\n|---------|--------|\n`
    for (const [name, ver] of Object.entries(deps).sort()) {
      md += `| ${name} | ${ver} |\n`
    }
    md += '\n'
  }

  if (devDeps && Object.keys(devDeps).length) {
    md += `## Desarrollo\n\n| Paquete | Versión |\n|---------|--------|\n`
    for (const [name, ver] of Object.entries(devDeps).sort()) {
      md += `| ${name} | ${ver} |\n`
    }
    md += '\n'
  }

  writeBovedaSection(file, md)
  return true
}

function populateEnvVars(cwd) {
  const file = join(cwd, 'boveda', '🛠 Stack', 'Variables de Entorno.md')
  let envContent = null
  for (const name of ['.env.example', '.env']) {
    const p = join(cwd, name)
    if (existsSync(p)) {
      envContent = readFileSync(p, 'utf-8')
      break
    }
  }
  if (!envContent) return false

  const vars = []
  let currentDesc = ''
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim()
    if (trimmed.startsWith('#')) {
      currentDesc = trimmed.replace(/^#\s*/, '')
      continue
    }
    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=/)
    if (match) {
      const val = trimmed.includes('=') ? trimmed.split('=').slice(1).join('=') : ''
      const required = val === '' || val === '""' || val === "''" || val.startsWith('<your-') ? 'Sí' : 'No'
      vars.push({ key: match[1], required, desc: currentDesc || '—' })
      currentDesc = ''
    }
  }

  if (!vars.length) return false

  let md = `# Variables de Entorno\n\n**Propósito**: Documentación de variables de entorno.\n\n---\n\n| Variable | Requerida | Descripción |\n|----------|-----------|-------------|\n`
  for (const v of vars) {
    md += `| \`${v.key}\` | ${v.required} | ${v.desc} |\n`
  }
  writeBovedaSection(file, md)
  return true
}

function populateEstructura(cwd) {
  const file = join(cwd, 'boveda', '🏗 Arquitectura', 'Estructura.md')
  const ignored = new Set(['node_modules', '.git', 'boveda', '.graphify', 'graphify-visual', '.next', 'dist', 'build', '.cache'])
  const maxDepth = 4

  function walk(dir, prefix = '') {
    if (prefix.length > maxDepth * 4) return ''
    let result = ''
    try {
      const entries = readdirSync(dir, { withFileTypes: true })
        .filter(e => !ignored.has(e.name) && !e.name.startsWith('.'))
        .sort((a, b) => {
          if (a.isDirectory() && !b.isDirectory()) return -1
          if (!a.isDirectory() && b.isDirectory()) return 1
          return a.name.localeCompare(b.name)
        })
      for (let i = 0; i < entries.length; i++) {
        const e = entries[i]
        const isLast = i === entries.length - 1
        const connector = isLast ? '└── ' : '├── '
        result += `${prefix}${connector}${e.name}${e.isDirectory() ? '/' : ''}\n`
        if (e.isDirectory()) {
          const newPrefix = prefix + (isLast ? '    ' : '│   ')
          result += walk(join(dir, e.name), newPrefix)
        }
      }
    } catch {}
    return result
  }

  const tree = walk(cwd)
  if (!tree) return false

  const md = `# Estructura del Proyecto\n\n**Propósito**: Mapa del árbol de directorios del proyecto.\n\n---\n\n\`\`\`\n${tree}\`\`\`\n`
  writeBovedaSection(file, md)
  return true
}

function populateAPIRoutes(cwd) {
  const file = join(cwd, 'boveda', '📡 API', 'API Routes.md')
  const routeDirs = [
    join(cwd, 'app', 'api'),
    join(cwd, 'pages', 'api'),
    join(cwd, 'src', 'app', 'api'),
    join(cwd, 'src', 'pages', 'api'),
    join(cwd, 'src', 'routes'),
    join(cwd, 'routes'),
  ]

  const httpMethodRe = /export\s+(async\s+)?function\s+(GET|POST|PUT|PATCH|DELETE|OPTIONS|HEAD)\b/g

  function findRoutes(dir, prefix = '') {
    const routes = []
    if (!existsSync(dir)) return routes
    try {
      const entries = readdirSync(dir, { withFileTypes: true })
      for (const e of entries) {
        const full = join(dir, e.name)
        if (e.isDirectory()) {
          routes.push(...findRoutes(full, prefix ? `${prefix}/${e.name}` : e.name))
        } else if (e.name.match(/^route\.(ts|js|tsx|jsx)$/) || e.name.match(/^.+\.route\.(ts|js)$/)) {
          let methods = ['GET']
          try {
            const content = readFileSync(full, 'utf-8')
            const found = [...content.matchAll(httpMethodRe)].map(m => m[2])
            if (found.length > 0) methods = found
          } catch {}
          routes.push({ path: prefix || '', methods })
        }
      }
    } catch {}
    return routes
  }

  const allRoutes = []
  for (const dir of routeDirs) {
    allRoutes.push(...findRoutes(dir))
  }

  if (!allRoutes.length) return false

  allRoutes.sort((a, b) => a.path.localeCompare(b.path))
  let md = `# API Routes\n\n**Propósito**: Endpoints RESTful del sistema.\n\n---\n\n| Ruta | Métodos | Descripción |\n|------|---------|-------------|\n`
  for (const r of allRoutes) {
    md += `| \`${r.path}\` | ${r.methods.join(', ')} | (Pendiente) |\n`
  }
  writeBovedaSection(file, md)
  return true
}

function populateFeatures(cwd) {
  const file = join(cwd, 'boveda', '🧩 Features', 'Index.md')
  const srcDirs = [join(cwd, 'src'), join(cwd, 'lib'), join(cwd, 'app')]

  const modules = []
  for (const dir of srcDirs) {
    if (!existsSync(dir)) continue
    try {
      const entries = readdirSync(dir, { withFileTypes: true })
      for (const e of entries) {
        if (e.isDirectory() && !e.name.startsWith('.') && e.name !== 'api' && e.name !== 'components' && e.name !== 'layouts') {
          modules.push(e.name)
        }
      }
    } catch {}
  }

  if (!modules.length) return false

  const unique = [...new Set(modules)].sort()
  let md = `# Features — Índice\n\n**Propósito**: Catálogo de todas las funcionalidades del sistema.\n\n---\n\n| Módulo | Descripción | Estado |\n|--------|-------------|--------|\n`
  for (const m of unique) {
    md += `| ${m} | (Pendiente) | ✨ Detectado |\n`
  }
  writeBovedaSection(file, md)
  return true
}

function populateServerActions(cwd) {
  const file = join(cwd, 'boveda', '📡 API', 'Server Actions.md')
  const searchDirs = [
    join(cwd, 'src'),
    join(cwd, 'app'),
    join(cwd, 'lib'),
    join(cwd, 'actions'),
  ]

  function scan(dir) {
    const actions = []
    if (!existsSync(dir)) return actions
    try {
      const entries = readdirSync(dir, { withFileTypes: true })
      for (const e of entries) {
        const full = join(dir, e.name)
        if (e.isDirectory() && !e.name.startsWith('.') && e.name !== 'node_modules') {
          actions.push(...scan(full))
        } else if (e.name.match(/\.(ts|js|tsx|jsx)$/)) {
          try {
            const content = readFileSync(full, 'utf-8')
            if (content.includes('"use server"') || content.includes("'use server'")) {
              const rel = relative(cwd, full)
              const funcs = [...content.matchAll(/export\s+(async\s+)?function\s+(\w+)/g)].map(m => m[2])
              actions.push({ file: rel, functions: funcs.length > 0 ? funcs : ['(unknown)'] })
            }
          } catch {}
        }
      }
    } catch {}
    return actions
  }

  const allActions = []
  for (const dir of searchDirs) {
    allActions.push(...scan(dir))
  }

  if (!allActions.length) return false

  allActions.sort((a, b) => a.file.localeCompare(b.file))
  let md = `# Server Actions\n\n**Propósito**: Catálogo de server actions del sistema.\n\n---\n\n| Archivo | Funciones exportadas |\n|---------|---------------------|\n`
  for (const a of allActions) {
    md += `| \`${a.file}\` | ${a.functions.join(', ')} |\n`
  }
  writeBovedaSection(file, md)
  return true
}

function populateMiddleware(cwd) {
  const file = join(cwd, 'boveda', '🏗 Arquitectura', 'Middleware y Auth.md')
  const candidates = [
    join(cwd, 'middleware.ts'),
    join(cwd, 'src', 'middleware.ts'),
    join(cwd, 'auth.ts'),
    join(cwd, 'src', 'auth.ts'),
    join(cwd, 'app', 'auth.config.ts'),
    join(cwd, 'lib', 'auth.ts'),
  ]

  let found = null
  for (const p of candidates) {
    if (existsSync(p)) {
      found = p
      break
    }
  }
  if (!found) return false

  const rel = relative(cwd, found)
  let content = ''
  try { content = readFileSync(found, 'utf-8') } catch {}
  const lines = content.split('\n').length

  let md = `# Middleware y Flujo de Autenticación\n\n**Propósito**: Cómo se protegen las rutas y se gestiona la autenticación.\n\n---\n\n**Middleware detectado:** \`${rel}\` (${lines} líneas)\n\n`
  const patterns = [
    { name: 'NextAuth.js / Auth.js', re: /next-auth|@auth/ },
    { name: 'Clerk', re: /@clerk/ },
    { name: 'Lucia', re: /lucia/ },
    { name: 'JWT manual', re: /jsonwebtoken|jwt/ },
    { name: 'Session cookies', re: /session|cookie/ },
    { name: 'Middleware matcher', re: /config\s*.*matcher/ },
  ]

  const detected = patterns.filter(p => p.re.test(content)).map(p => p.name)
  if (detected.length > 0) {
    md += `**Patrones detectados:** ${detected.join(', ')}\n\n`
  }

  md += `(Pendiente de documentar según el proyecto)\n`
  writeBovedaSection(file, md)
  return true
}

function main() {
  console.log(`\n📚 Poblando bóveda de conocimiento...\n`)

  const tasks = [
    { name: 'Comandos', fn: () => populateComandos(CWD) },
    { name: 'Librerías', fn: () => populateLibrerias(CWD) },
    { name: 'Variables de Entorno', fn: () => populateEnvVars(CWD) },
    { name: 'Estructura', fn: () => populateEstructura(CWD) },
    { name: 'API Routes', fn: () => populateAPIRoutes(CWD) },
    { name: 'Server Actions', fn: () => populateServerActions(CWD) },
    { name: 'Middleware / Auth', fn: () => populateMiddleware(CWD) },
    { name: 'Features', fn: () => populateFeatures(CWD) },
  ]

  let populated = 0
  for (const t of tasks) {
    try {
      if (t.fn()) {
        populated++
        console.log(`  ${GREEN}✅ boveda/${t.name}${RESET}`)
      } else {
        console.log(`  ${YELLOW}⚠️  boveda/${t.name}: no se pudo detectar información${RESET}`)
      }
    } catch (e) {
      console.log(`  ${YELLOW}⚠️  boveda/${t.name}: ${e.message}${RESET}`)
    }
  }

  console.log(`\n${GREEN}✅ Bóveda poblada (${populated} secciones actualizadas)${RESET}`)
  if (populated < 6) {
    console.log(`${YELLOW}💡 Ejecuta de nuevo tras añadir más configuración al proyecto.${RESET}`)
  }
  console.log()
}

main()
