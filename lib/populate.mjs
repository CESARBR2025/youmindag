// YouMindAG — vault auto-population functions

import { existsSync, readFileSync, readdirSync } from 'fs'
import { join, relative } from 'path'
import { GREEN, YELLOW } from '../lib/utils.mjs'
import { detectDBEngine, getDBMigrationCommands } from '../lib/detect.mjs'
import { getBovedaDir, writeBovedaSection } from '../lib/vault.mjs'

export function populateComandos(cwd) {
  const bovedaDir = getBovedaDir(cwd) || 'boveda'
  const file = join(cwd, bovedaDir, '🛠 Stack', 'Comandos.md')
  const pkgPath = join(cwd, 'package.json')
  if (!existsSync(pkgPath)) return false
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'))
  const scripts = pkg.scripts
  if (!scripts || !Object.keys(scripts).length) return false

  let md = `# Comandos\n\n**Propósito**: Referencia rápida de comandos útiles.\n\n---\n\n| Comando | Script |\n|---------|-------|\n`
  for (const [name, cmd] of Object.entries(scripts)) {
    md += `| \`${name}\` | \`${cmd}\` |\n`
  }

  const engine = detectDBEngine(cwd)
  if (engine) {
    md += getDBMigrationCommands(engine)
  }

  writeBovedaSection(file, md)
  return true
}

export function populateLibrerias(cwd) {
  const bovedaDir = getBovedaDir(cwd) || 'boveda'
  const file = join(cwd, bovedaDir, '🛠 Stack', 'Librerias.md')
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

export function populateEnvVars(cwd) {
  const bovedaDir = getBovedaDir(cwd) || 'boveda'
  const file = join(cwd, bovedaDir, '🛠 Stack', 'Variables de Entorno.md')
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
      const required = val === '' || val === '""' || val === "''" || val === '<your-' ? 'Sí' : 'No'
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

export function populateEstructura(cwd) {
  const bovedaDir = getBovedaDir(cwd) || 'boveda'
  const file = join(cwd, bovedaDir, '🏗 Arquitectura', 'Estructura.md')
  const ignored = new Set(['node_modules', '.git', bovedaDir, '.graphify', 'graphify-visual', '.next', 'dist', 'build', '.cache'])
  const maxDepth = 4

  function walk(dir, prefix = '') {
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

export function populateAPIRoutes(cwd) {
  const bovedaDir = getBovedaDir(cwd) || 'boveda'
  const file = join(cwd, bovedaDir, '📡 API', 'API Routes.md')
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

export function populateFeatures(cwd) {
  const bovedaDir = getBovedaDir(cwd) || 'boveda'
  const file = join(cwd, bovedaDir, '🧩 Features', 'Index.md')
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
  let md = `# Features — Índice\n\n**Propósito**: Catálogo de todas las funcionalidades del sistema.\n\n---\n\n| Feature | Flujo | Descripción | Estado |\n|--------|-------|-------------|--------|\n`
  for (const m of unique) {
    md += `| ${m} | (Pendiente) | (Pendiente) | ✨ Detectado |\n`
  }
  writeBovedaSection(file, md)
  return true
}

export function populateServerActions(cwd) {
  const bovedaDir = getBovedaDir(cwd) || 'boveda'
  const file = join(cwd, bovedaDir, '📡 API', 'Server Actions.md')
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

export function populateMiddleware(cwd) {
  const bovedaDir = getBovedaDir(cwd) || 'boveda'
  const file = join(cwd, bovedaDir, '🏗 Arquitectura', 'Middleware y Auth.md')
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

export function populateVaultFiles(cwd) {
  const bovedaDir = getBovedaDir(cwd) || 'boveda'
  const tasks = [
    { name: 'Comandos', fn: () => populateComandos(cwd) },
    { name: 'Librerías', fn: () => populateLibrerias(cwd) },
    { name: 'Variables de Entorno', fn: () => populateEnvVars(cwd) },
    { name: 'Estructura', fn: () => populateEstructura(cwd) },
    { name: 'API Routes', fn: () => populateAPIRoutes(cwd) },
    { name: 'Server Actions', fn: () => populateServerActions(cwd) },
    { name: 'Middleware / Auth', fn: () => populateMiddleware(cwd) },
    { name: 'Features', fn: () => populateFeatures(cwd) },
  ]

  let populated = 0
  for (const t of tasks) {
    try {
      if (t.fn()) {
        populated++
        console.log(`  ${GREEN}✅ ${bovedaDir}/${t.name} poblado${RESET}`)
      }
    } catch (e) {
      console.log(`  ${YELLOW}⚠️  ${bovedaDir}/${t.name}: ${e.message}${RESET}`)
    }
  }
  if (populated > 0) console.log(`  ${GREEN}✅ Bóveda auto-poblada (${populated} secciones)${RESET}\n`)
}
