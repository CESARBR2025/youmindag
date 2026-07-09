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
    // wildcard check for .csproj
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

async function main() {
  console.log(`\n${CYAN}${BOLD}  🧠 YouMindAG v1.0${RESET}`)
  console.log(`${CYAN}  ──────────────────────────${RESET}\n`)

  // Step 1: Detect project
  const projectName = basename(CWD)
  const info = detectLang()
  const pkg = existsSync(join(CWD, 'package.json'))
  const hasGit = existsSync(join(CWD, '.git'))
  const hasBoveda = existsSync(join(CWD, 'boveda'))

  console.log(`  ${BOLD}📦 Proyecto:${RESET} ${projectName}`)
  console.log(`  ${BOLD}🔤 Lenguaje:${RESET} ${info.lang}`)
  if (info.framework !== info.lang) console.log(`  ${BOLD}⚙️  Framework:${RESET} ${info.framework}`)
  console.log(`  ${BOLD}📂 Git:${RESET} ${hasGit ? '✅' : '❌'}`)
  console.log(`  ${BOLD}🏛️  Bóveda:${RESET} ${hasBoveda ? 'Ya existe' : 'Se creará'}`)
  console.log()

  // Step 2: Ask about BD
  const hasDB = hasPostgres()
  const wantSchema = hasDB
  if (hasDB) {
    console.log(`  ${YELLOW}📦 PostgreSQL detectado en package.json${RESET}`)
  }
  console.log()

  // Step 3: Inject boveda/
  if (!hasBoveda) {
    console.log(`${BOLD}📚 Creando bóveda de conocimiento...${RESET}`)
    copyDir(join(TEMPLATE, 'boveda'), join(CWD, 'boveda'))
    // Update Home.md with project name
    const homePath = join(CWD, 'boveda', 'Home.md')
    if (existsSync(homePath)) {
      let home = readFileSync(homePath, 'utf-8')
      home = home.replace('[Nombre del Proyecto]', pascalCase(projectName))
      writeFileSync(homePath, home)
    }
    const count = readdirSync(join(CWD, 'boveda'), { recursive: true }).filter(f => f.endsWith('.md')).length
    console.log(`  ${GREEN}✅ boveda/ creada (${count} documentos)${RESET}\n`)
  }

  // Step 4: Inject .opencode/
  console.log(`${BOLD}🔧 Inyectando contexto para AI...${RESET}`)
  copyDir(join(TEMPLATE, '.opencode'), join(CWD, '.opencode'))

  // Update context-map.yaml with project name
  const ctxPath = join(CWD, '.opencode', 'context-map.yaml')
  if (existsSync(ctxPath)) {
    let ctx = readFileSync(ctxPath, 'utf-8')
    ctx = ctx.replace('[Nombre del Proyecto]', pascalCase(projectName))
    writeFileSync(ctxPath, ctx)
  }
  console.log(`  ${GREEN}✅ .opencode/ inyectado (plugin + skills + context-map)${RESET}\n`)

  // Step 5: Inject scripts/
  console.log(`${BOLD}📜 Instalando scripts de utilidad...${RESET}`)
  copyDir(join(TEMPLATE, 'scripts'), join(CWD, 'scripts'))
  console.log(`  ${GREEN}✅ scripts/ instalados (load-context, extract-domain, export-schema)${RESET}\n`)

  // Step 6: Backup + update AGENTS.md
  const agentsPath = join(CWD, 'AGENTS.md')
  if (existsSync(agentsPath)) {
    const backupPath = join(CWD, 'AGENTS.md.bak')
    copyFileSync(agentsPath, backupPath)
    console.log(`  ${YELLOW}📄 AGENTS.md existente → respaldado como AGENTS.md.bak${RESET}`)
  }
  const templateAgents = join(TEMPLATE, 'AGENTS.md')
  if (existsSync(templateAgents)) {
    copyFileSync(templateAgents, agentsPath)
    console.log(`  ${GREEN}✅ AGENTS.md actualizado${RESET}\n`)
  }

  // Step 7: Install graphify
  if (pkg) {
    console.log(`${BOLD}🔗 Instalando Graphify...${RESET}`)
    try {
      execSync('npm install @sentropic/graphify', { cwd: CWD, stdio: 'pipe', timeout: 60000 })
      console.log(`  ${GREEN}✅ @sentropic/graphify instalado${RESET}\n`)
    } catch (e) {
      console.log(`  ${YELLOW}⚠️  No se pudo instalar graphify: ${e.message}${RESET}\n`)
    }
  }

  // Step 8: Build graph
  if (existsSync(join(CWD, 'node_modules', '@sentropic', 'graphify'))) {
    console.log(`${BOLD}🌐 Construyendo grafo de conocimiento...${RESET}`)
    try {
      execSync('npx graphify detect . 2>/dev/null', { cwd: CWD, stdio: 'pipe', timeout: 30000 })
      execSync('npx graphify update . 2>&1 | tail -3', { cwd: CWD, stdio: 'pipe', timeout: 120000 })
      const graphPath = join(CWD, '.graphify', 'graph.json')
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

  // Step 9: Summary
  const bovedaCount = readdirSync(join(CWD, 'boveda'), { recursive: true }).filter(f => f.endsWith('.md')).length

  console.log(`${CYAN}${BOLD}  ──────────────────────────${RESET}`)
  console.log(`${GREEN}${BOLD}  🎉 YouMindAG activo en ${projectName}${RESET}\n`)
  console.log(`  ${BOLD}📚 Bóveda:${RESET} ${bovedaCount} documentos en boveda/`)
  console.log(`  ${BOLD}🔧 Contexto:${RESET} Plugin + skills + context-map`)
  console.log(`  ${BOLD}🌐 Grafo:${RESET} Graphify indexando el código`)
  console.log(`  ${BOLD}📜 Scripts:${RESET} load-context, extract-domain, export-schema`)
  console.log(`\n  ${CYAN}Próximo paso: abrir un chat y escribir cualquier tarea.${RESET}`)
  console.log(`  ${CYAN}El agente cargará el contexto automáticamente.${RESET}\n`)
}

main().catch(e => {
  console.error(`\n${YELLOW}Error: ${e.message}${RESET}\n`)
  process.exit(1)
})
