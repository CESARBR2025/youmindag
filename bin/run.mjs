#!/usr/bin/env node
// YouMindAG — Inyecta inteligencia de contexto a cualquier proyecto.
// Uso: npx youmindag
// Ejecutar DENTRO del directorio del proyecto destino.

import { existsSync, readFileSync, writeFileSync, mkdirSync, copyFileSync, readdirSync, statSync } from 'fs'
import { join, dirname, basename, relative } from 'path'
import { fileURLToPath } from 'url'
import { execSync } from 'child_process'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const TEMPLATE = join(ROOT, 'template')
const CWD = process.cwd()

const PKG = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf-8'))
const VERSION = PKG.version

const YOUMINDAG_JSON = '.youmindag.json'

const RESET = '\x1b[0m'
const CYAN = '\x1b[36m'
const GREEN = '\x1b[32m'
const YELLOW = '\x1b[33m'
const BOLD = '\x1b[1m'

function log(msg) { console.log(msg) }

function copyDir(src, dst, overwrite = false) {
  if (!existsSync(src)) return
  mkdirSync(dst, { recursive: true })
  for (const entry of readdirSync(src)) {
    const srcPath = join(src, entry)
    const dstPath = join(dst, entry)
    const stat = statSync(srcPath)
    if (stat.isDirectory()) {
      copyDir(srcPath, dstPath, overwrite)
    } else {
      if (existsSync(dstPath) && !overwrite) continue
      copyFileSync(srcPath, dstPath)
    }
  }
}

function fileLines(p) {
  try { return readFileSync(p, 'utf-8').split('\n').length } catch { return 0 }
}

function detectLang() {
  const indicators = [
    { file: 'package.json', lang: 'TypeScript / JavaScript', framework: 'Node.js' },
    { file: 'tsconfig.json', lang: 'TypeScript', framework: 'Node.js / Next.js' },
    { file: 'go.mod', lang: 'Go', framework: 'Go' },
    { file: 'Cargo.toml', lang: 'Rust', framework: 'Rust' },
    { file: 'pyproject.toml', lang: 'Python', framework: 'Python' },
    { file: 'requirements.txt', lang: 'Python', framework: 'Python' },
    { file: 'Gemfile', lang: 'Ruby', framework: 'Ruby' },
    { file: 'composer.json', lang: 'PHP', framework: 'PHP' },
    { file: '.csproj', lang: 'C#', framework: '.NET' },
  ]
  for (const ind of indicators) {
    if (existsSync(join(CWD, ind.file))) return ind
    if (ind.file === '.csproj') {
      const files = readdirSync(CWD).filter(f => f.endsWith('.csproj'))
      if (files.length > 0) return ind
    }
  }
  return { lang: 'Unknown', framework: 'Unknown' }
}

function hasPostgres() {
  try {
    const pkg = JSON.parse(readFileSync(join(CWD, 'package.json'), 'utf-8'))
    return !!(pkg.dependencies?.pg || pkg.devDependencies?.pg || pkg.dependencies?.['@neondatabase/serverless'])
  } catch { return false }
}

function pascalCase(str) {
  return str
    .replace(/[-_]/g, ' ')
    .replace(/\w\S*/g, w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .replace(/\s+/g, '')
}

// ─── Poblado automático de bóveda ─────────────────────────────────

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
  writeFileSync(file, md)
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

  writeFileSync(file, md)
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
  writeFileSync(file, md)
  return true
}

function populateEstructura(cwd) {
  const file = join(cwd, 'boveda', '🏗 Arquitectura', 'Estructura.md')
  const ignored = new Set(['node_modules', '.git', 'boveda', '.graphify', 'graphify-visual', '.next', 'dist', 'build', '.cache'])
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
  writeFileSync(file, md)
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
  writeFileSync(file, md)
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
  writeFileSync(file, md)
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
              // Find exported function names
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
  writeFileSync(file, md)
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
  // Detect auth patterns
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
  writeFileSync(file, md)
  return true
}

function populateVaultFiles(cwd) {
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
        console.log(`  ${GREEN}✅ boveda/${t.name} poblado${RESET}`)
      }
    } catch (e) {
      console.log(`  ${YELLOW}⚠️  boveda/${t.name}: ${e.message}${RESET}`)
    }
  }
  if (populated > 0) console.log(`  ${GREEN}✅ Bóveda auto-poblada (${populated} secciones)${RESET}\n`)
}

// ─── Delta upgrade ────────────────────────────────────────────────

function readYoumindagVersion(cwd) {
  const p = join(cwd, YOUMINDAG_JSON)
  if (!existsSync(p)) return null
  try {
    const data = JSON.parse(readFileSync(p, 'utf-8'))
    return data.version || null
  } catch { return null }
}

function writeYoumindagVersion(cwd) {
  writeFileSync(join(cwd, YOUMINDAG_JSON), JSON.stringify({
    version: VERSION,
    installedAt: new Date().toISOString(),
  }, null, 2) + '\n')
}

function upgradeAgentsMd(cwd) {
  const agentsPath = join(cwd, 'AGENTS.md')
  const templatePath = join(TEMPLATE, 'AGENTS.md')

  if (!existsSync(agentsPath)) {
    copyFileSync(templatePath, agentsPath)
    return 'creado (no existía)'
  }

  if (!existsSync(templatePath)) return 'omitido (template no encontrado)'

  const current = readFileSync(agentsPath, 'utf-8')
  const template = readFileSync(templatePath, 'utf-8')

  const beginMarker = '<!-- BEGIN:youmindag -->'
  const endMarker = '<!-- END:youmindag -->'

  const tBegin = template.indexOf(beginMarker)
  const tEnd = template.indexOf(endMarker)
  if (tBegin === -1 || tEnd === -1) return 'omitido (template sin markers)'

  const newContent = template.slice(tBegin + beginMarker.length, tEnd)

  // Backup
  const backupPath = join(cwd, 'AGENTS.md.bak')
  copyFileSync(agentsPath, backupPath)

  const cBegin = current.indexOf(beginMarker)
  const cEnd = current.indexOf(endMarker)

  if (cBegin !== -1 && cEnd !== -1) {
    // Replace content between markers, preserving anything outside
    const updated = current.slice(0, cBegin + beginMarker.length) + newContent + current.slice(cEnd)
    writeFileSync(agentsPath, updated)
    return 'actualizado (merge)'
  }

  // No markers found in current → check if there's content outside template markers
  // Write new content between markers, preserving user content outside
  const before = cBegin !== -1 ? current.slice(0, cBegin + beginMarker.length) : ''
  const after = cEnd !== -1 ? current.slice(cEnd) : ''

  if (!before && !after) {
    // Entire file is managed → full replace with template
    writeFileSync(agentsPath, template)
    return 'actualizado (reemplazo total)'
  }

  // Merge: preserve user content before/after, replace managed block
  writeFileSync(agentsPath, before + beginMarker + newContent + endMarker + after)
  return 'actualizado (merge + markers nuevos)'
}

function mergeContextMap(cwd) {
  const currentPath = join(cwd, '.opencode', 'context-map.yaml')
  const templatePath = join(TEMPLATE, '.opencode', 'context-map.yaml')

  if (!existsSync(currentPath)) {
    copyFileSync(templatePath, currentPath)
    return 'creado (no existía)'
  }
  if (!existsSync(templatePath)) return 'omitido (template no encontrado)'

  const current = readFileSync(currentPath, 'utf-8')
  const template = readFileSync(templatePath, 'utf-8')

  // Simple strategy: if template has new sections/keys not in current,
  // append them at the end. Otherwise keep current as-is.
  // This is a heuristic — full YAML deep merge would require a YAML parser.
  const templateLines = template.split('\n').filter(l => l.trim() && !l.trim().startsWith('#'))
  const currentHasContent = current.split('\n').filter(l => l.trim() && !l.trim().startsWith('#')).length > 2

  if (!currentHasContent) {
    writeFileSync(currentPath, template)
    return 'actualizado (vacío → template)'
  }

  // Template is effectively just a header + example comments, no managed keys to merge
  return 'sin cambios (preservado)'
}

function upgradeScriptsOpencode(cwd) {
  const changes = []

  // scripts/ — overwrite
  const scriptsSrc = join(TEMPLATE, 'scripts')
  const scriptsDst = join(cwd, 'scripts')
  if (existsSync(scriptsSrc)) {
    const before = existsSync(scriptsDst)
    copyDir(scriptsSrc, scriptsDst, true)
    if (before) changes.push('scripts/ actualizados')
    else changes.push('scripts/ creados')
  }

  // .opencode/ plugins — overwrite
  const pluginsSrc = join(TEMPLATE, '.opencode', 'plugins')
  const pluginsDst = join(cwd, '.opencode', 'plugins')
  if (existsSync(pluginsSrc)) {
    copyDir(pluginsSrc, pluginsDst, true)
    changes.push('.opencode/plugins actualizado')
  }

  // .opencode/ skills — overwrite
  const skillsSrc = join(TEMPLATE, '.opencode', 'skills')
  const skillsDst = join(cwd, '.opencode', 'skills')
  if (existsSync(skillsSrc)) {
    copyDir(skillsSrc, skillsDst, true)
    changes.push('.opencode/skills actualizado')
  }

  // .opencode/ opencode.json — overwrite (managed)
  const cfgSrc = join(TEMPLATE, '.opencode', 'opencode.json')
  const cfgDst = join(cwd, '.opencode', 'opencode.json')
  if (existsSync(cfgSrc)) {
    copyFileSync(cfgSrc, cfgDst)
    changes.push('.opencode/opencode.json actualizado')
  }

  return changes
}

async function freshInstall(cwd, projectName, info, pkg, hasGit, hasBoveda, hasDB, wantSchema) {
  console.log(`  ${BOLD}📦 Proyecto:${RESET} ${projectName}`)
  console.log(`  ${BOLD}🔤 Lenguaje:${RESET} ${info.lang}`)
  if (info.framework !== info.lang) console.log(`  ${BOLD}⚙️  Framework:${RESET} ${info.framework}`)
  console.log(`  ${BOLD}📂 Git:${RESET} ${hasGit ? '✅' : '❌'}`)
  console.log(`  ${BOLD}🏛️  Bóveda:${RESET} ${hasBoveda ? 'Ya existe' : 'Se creará'}`)
  console.log()

  if (hasDB) {
    console.log(`  ${YELLOW}📦 PostgreSQL detectado en package.json${RESET}`)
  }
  console.log()

  // Inject boveda/
  if (!hasBoveda) {
    console.log(`${BOLD}📚 Creando bóveda de conocimiento...${RESET}`)
    copyDir(join(TEMPLATE, 'boveda'), join(cwd, 'boveda'))
    const homePath = join(cwd, 'boveda', 'Home.md')
    if (existsSync(homePath)) {
      let home = readFileSync(homePath, 'utf-8')
      home = home.replace('[Nombre del Proyecto]', pascalCase(projectName))
      writeFileSync(homePath, home)
    }
    const count = readdirSync(join(cwd, 'boveda'), { recursive: true }).filter(f => f.endsWith('.md')).length
    console.log(`  ${GREEN}✅ boveda/ creada (${count} documentos)${RESET}\n`)
    populateVaultFiles(cwd)
  }

  // Inject .opencode/
  console.log(`${BOLD}🔧 Inyectando contexto para AI...${RESET}`)
  copyDir(join(TEMPLATE, '.opencode'), join(cwd, '.opencode'), true)
  const ctxPath = join(cwd, '.opencode', 'context-map.yaml')
  if (existsSync(ctxPath)) {
    let ctx = readFileSync(ctxPath, 'utf-8')
    ctx = ctx.replace('[Nombre del Proyecto]', pascalCase(projectName))
    writeFileSync(ctxPath, ctx)
  }
  console.log(`  ${GREEN}✅ .opencode/ inyectado (plugin + skills + context-map)${RESET}\n`)

  // Inject scripts/
  console.log(`${BOLD}📜 Instalando scripts de utilidad...${RESET}`)
  copyDir(join(TEMPLATE, 'scripts'), join(cwd, 'scripts'))
  const gitignorePath = join(cwd, '.gitignore')
  if (existsSync(gitignorePath)) {
    let gitignore = readFileSync(gitignorePath, 'utf-8')
    if (!gitignore.includes('graphify-visual')) {
      gitignore += '\n# YouMindAG — generated visual\n.graphify/cache/\n.graphify/branch.json\n.graphify/worktree.json\n.graphify/needs_update\ngraphify-visual/\n'
      writeFileSync(gitignorePath, gitignore)
    }
  }
  console.log(`  ${GREEN}✅ scripts/ instalados (load-context, extract-domain, export-schema)${RESET}\n`)

  // Backup + update AGENTS.md
  const agentsPath = join(cwd, 'AGENTS.md')
  if (existsSync(agentsPath)) {
    const backupPath = join(cwd, 'AGENTS.md.bak')
    copyFileSync(agentsPath, backupPath)
    console.log(`  ${YELLOW}📄 AGENTS.md existente → respaldado como AGENTS.md.bak${RESET}`)
  }
  const templateAgents = join(TEMPLATE, 'AGENTS.md')
  if (existsSync(templateAgents)) {
    copyFileSync(templateAgents, agentsPath)
    console.log(`  ${GREEN}✅ AGENTS.md actualizado${RESET}\n`)
  }

  // Install graphify
  if (pkg) {
    console.log(`${BOLD}🔗 Instalando Graphify...${RESET}`)
    try {
      execSync('npm install @sentropic/graphify', { cwd, stdio: 'pipe', timeout: 60000 })
      console.log(`  ${GREEN}✅ @sentropic/graphify instalado${RESET}\n`)
    } catch (e) {
      console.log(`  ${YELLOW}⚠️  No se pudo instalar graphify: ${e.message}${RESET}\n`)
    }
  }

  // Build graph
  const graphPath = join(cwd, '.graphify', 'graph.json')
  if (existsSync(join(cwd, 'node_modules', '@sentropic', 'graphify'))) {
    console.log(`${BOLD}🌐 Construyendo grafo de conocimiento...${RESET}`)
    try {
      execSync('npx graphify detect . 2>/dev/null', { cwd, stdio: 'pipe', timeout: 30000 })
      execSync('npx graphify update . 2>&1 | tail -3', { cwd, stdio: 'pipe', timeout: 120000 })
      if (existsSync(graphPath)) {
        const graph = JSON.parse(readFileSync(graphPath, 'utf-8'))
        const nodes = graph.nodes?.length || 0
        const edges = graph.edges?.length || 0
        console.log(`  ${GREEN}✅ Grafo construido: ${nodes} nodos, ${edges} aristas${RESET}\n`)
      }
    } catch {
      console.log(`  ${YELLOW}⚠️  No se pudo construir el grafo automáticamente${RESET}\n`)
    }
  }

  // Studio visual
  const studioPath = join(cwd, 'graphify-visual', 'studio.html')
  if (existsSync(graphPath)) {
    if (!existsSync(studioPath)) {
      console.log(`${BOLD}🎨 Generando visualización interactiva...${RESET}`)
      try {
        execSync('npx graphify studio export ./graphify-visual 2>&1 | tail -3', { cwd, stdio: 'pipe', timeout: 60000 })
      } catch { /* ignore */ }
    }
    if (existsSync(studioPath)) {
      const size = Math.round(statSync(studioPath).size / 1024)
      console.log(`  ${GREEN}✅ Studio visual (${size} KB)${RESET}`)
      console.log(`  ${CYAN}   📊 Ruta: ${studioPath}${RESET}`)
      console.log(`  ${CYAN}   📊 Abrir: open "${studioPath}"${RESET}\n`)
    }
  }

  // Write version
  writeYoumindagVersion(cwd)

  // Summary
  const bovedaCount = readdirSync(join(cwd, 'boveda'), { recursive: true }).filter(f => f.endsWith('.md')).length
  console.log(`${CYAN}${BOLD}  ──────────────────────────${RESET}`)
  console.log(`${GREEN}${BOLD}  🎉 YouMindAG activo en ${projectName}${RESET}\n`)
  console.log(`  ${BOLD}📚 Bóveda:${RESET} ${bovedaCount} documentos en boveda/`)
  console.log(`  ${BOLD}🔧 Contexto:${RESET} Plugin + skills + context-map`)
  console.log(`  ${BOLD}🌐 Grafo:${RESET} Graphify indexando el código`)
  console.log(`  ${BOLD}📜 Scripts:${RESET} load-context, extract-domain, export-schema`)
  console.log(`\n  ${CYAN}Próximo paso: abrir un chat y escribir cualquier tarea.${RESET}`)
  console.log(`  ${CYAN}El agente cargará el contexto automáticamente.${RESET}\n`)
}

async function upgrade(oldVersion, cwd, projectName) {
  const changes = []
  console.log(`  ${BOLD}🔄 Upgrade:${RESET} v${oldVersion} → v${VERSION}`)
  console.log(`  ${BOLD}📦 Proyecto:${RESET} ${projectName}\n`)

  const hasBoveda = existsSync(join(cwd, 'boveda'))

  // 1. AGENTS.md — merge via markers
  const agentsResult = upgradeAgentsMd(cwd)
  changes.push(`📄 AGENTS.md — ${agentsResult}`)

  // 2. Bóveda — skip (user territory)
  if (hasBoveda) {
    changes.push('📦 boveda/ — sin cambios (poblada por el usuario)')
  } else {
    console.log(`${BOLD}📚 Creando bóveda de conocimiento...${RESET}`)
    copyDir(join(TEMPLATE, 'boveda'), join(cwd, 'boveda'))
    const homePath = join(cwd, 'boveda', 'Home.md')
    if (existsSync(homePath)) {
      let home = readFileSync(homePath, 'utf-8')
      home = home.replace('[Nombre del Proyecto]', pascalCase(projectName))
      writeFileSync(homePath, home)
    }
    const count = readdirSync(join(cwd, 'boveda'), { recursive: true }).filter(f => f.endsWith('.md')).length
    console.log(`  ${GREEN}✅ boveda/ creada (${count} documentos)${RESET}\n`)
    populateVaultFiles(cwd)
    changes.push('📦 boveda/ — creada')
  }

  // 3. Scripts + .opencode — overwrite
  mkdirSync(join(cwd, '.opencode'), { recursive: true })
  const fileChanges = upgradeScriptsOpencode(cwd)
  changes.push(...fileChanges.map(c => `📜 ${c}`))

  // 4. context-map.yaml — merge (preserve user entries)
  mkdirSync(join(cwd, '.opencode'), { recursive: true })
  const ctxResult = mergeContextMap(cwd)
  changes.push(`🔗 .opencode/context-map.yaml — ${ctxResult}`)

  // 5. .gitignore — ensure entries
  const gitignorePath = join(cwd, '.gitignore')
  if (existsSync(gitignorePath)) {
    let gitignore = readFileSync(gitignorePath, 'utf-8')
    if (!gitignore.includes('graphify-visual')) {
      gitignore += '\n# YouMindAG — generated visual\n.graphify/cache/\n.graphify/branch.json\n.graphify/worktree.json\n.graphify/needs_update\ngraphify-visual/\n'
      writeFileSync(gitignorePath, gitignore)
      changes.push('📂 .gitignore — entradas agregadas')
    }
  }

  // 6. Write version
  writeYoumindagVersion(cwd)

  // Report
  console.log(`${BOLD}\n📋 Cambios aplicados:${RESET}`)
  for (const c of changes) {
    console.log(`  ${GREEN}   ${c}${RESET}`)
  }

  console.log(`\n${CYAN}${BOLD}  ──────────────────────────${RESET}`)
  console.log(`${GREEN}${BOLD}  ✅ Proyecto actualizado a v${VERSION}${RESET}\n`)
}

async function main() {
  console.log(`\n${CYAN}${BOLD}  🧠 YouMindAG v${VERSION}${RESET}`)
  console.log(`${CYAN}  ──────────────────────────${RESET}\n`)

  const projectName = basename(CWD)
  const oldVersion = readYoumindagVersion(CWD)

  if (oldVersion) {
    if (oldVersion === VERSION) {
      console.log(`  ${GREEN}✅ Ya estás en la última versión (v${VERSION})${RESET}`)
      console.log(`  ${CYAN}   Para forzar reinstalación, elimina ${YOUMINDAG_JSON}${RESET}\n`)
      return
    }
    // Upgrade mode
    await upgrade(oldVersion, CWD, projectName)
  } else {
    // Fresh install
    const info = detectLang()
    const pkg = existsSync(join(CWD, 'package.json'))
    const hasGit = existsSync(join(CWD, '.git'))
    const hasBoveda = existsSync(join(CWD, 'boveda'))
    const hasDB = hasPostgres()
    const wantSchema = hasDB
    await freshInstall(CWD, projectName, info, pkg, hasGit, hasBoveda, hasDB, wantSchema)
  }
}

main().catch(e => {
  console.error(`\n${YELLOW}Error: ${e.message}${RESET}\n`)
  process.exit(1)
})
