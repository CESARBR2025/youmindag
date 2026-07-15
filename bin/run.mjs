#!/usr/bin/env node
// YouMindAG — Inyecta inteligencia de contexto a cualquier proyecto.
// Uso: npx youmindag
// Ejecutar DENTRO del directorio del proyecto destino.

import { fileURLToPath } from 'url'
import { join, dirname, basename } from 'path'
import { existsSync, readFileSync, writeFileSync, mkdirSync, copyFileSync, readdirSync, statSync, appendFileSync, openSync, closeSync, rmSync, watch } from 'fs'
import { execSync } from 'child_process'
import { spawn } from 'child_process'
import { createInterface } from 'readline'

import { RESET, CYAN, GREEN, YELLOW, BOLD, pascalCase, kebabCase } from '../lib/utils.mjs'
import { detectLang, hasPostgres, detectDBEngine, getDBMigrationCommands } from '../lib/detect.mjs'
import { getBovedaDir, readYoumindagVersion, writeBovedaSection, AUTO_START, AUTO_END, readYoumindagData, YOUMINDAG_JSON } from '../lib/vault.mjs'
import { log, parseEnvFile, copyDir, maybeWriteFile, maybeCopyFile, maybeCopyDir, maybeExecSync, maybeRmSync, getDryRun, setDryRun } from '../lib/fs-helpers.mjs'
import { upgradeAgentsMd, mergeContextMap } from '../lib/agents.mjs'
import { ensureGitignoreEntries, cleanGitignoreEntries } from '../lib/gitignore.mjs'
import { populateVaultFiles } from '../lib/populate.mjs'
import { getGraphifyVersion, installGraphify } from '../lib/graphify.mjs'
import { cmdStatus, cmdUninstall, checkStaleBoveda, cmdReferences, cmdContext, showHelp } from '../lib/commands/misc.mjs'
import { cmdDb } from '../lib/commands/db.mjs'
import { cmdTrace } from '../lib/commands/trace.mjs'
import { cmdDev } from '../lib/commands/dev.mjs'
import { cmdWatch } from '../lib/commands/watch.mjs'
import { cmdSync } from '../lib/commands/sync.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const TEMPLATE = join(ROOT, 'template')
const CWD = process.cwd()

const PKG = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf-8'))
const VERSION = PKG.version





function writeYoumindagVersion(cwd, graphifyVersion, bovedaDir) {
  const data = { version: VERSION, installedAt: new Date().toISOString() }
  if (graphifyVersion) data.graphifyVersion = graphifyVersion
  if (bovedaDir) data.bovedaDir = bovedaDir
  maybeWriteFile(join(cwd, YOUMINDAG_JSON), JSON.stringify(data, null, 2) + '\n')
}







function upgradeScriptsOpencode(cwd) {
  const changes = []

  // scripts/ — overwrite
  const scriptsSrc = join(TEMPLATE, 'scripts')
  const scriptsDst = join(cwd, 'scripts')
  if (existsSync(scriptsSrc)) {
    const before = existsSync(scriptsDst)
    maybeCopyDir(scriptsSrc, scriptsDst, true)
    if (before) changes.push('scripts/ actualizados')
    else changes.push('scripts/ creados')
  }

  // .opencode/ plugins — overwrite
  const pluginsSrc = join(TEMPLATE, '.opencode', 'plugins')
  const pluginsDst = join(cwd, '.opencode', 'plugins')
  if (existsSync(pluginsSrc)) {
    maybeCopyDir(pluginsSrc, pluginsDst, true)
    changes.push('.opencode/plugins actualizado')
  }

  // .opencode/ skills — overwrite
  const skillsSrc = join(TEMPLATE, '.opencode', 'skills')
  const skillsDst = join(cwd, '.opencode', 'skills')
  if (existsSync(skillsSrc)) {
    maybeCopyDir(skillsSrc, skillsDst, true)
    changes.push('.opencode/skills actualizado')
  }

  // .opencode/ opencode.json — overwrite (managed)
  const cfgSrc = join(TEMPLATE, '.opencode', 'opencode.json')
  const cfgDst = join(cwd, '.opencode', 'opencode.json')
  if (existsSync(cfgSrc)) {
    maybeCopyFile(cfgSrc, cfgDst)
    changes.push('.opencode/opencode.json actualizado')
  }

  return changes
}





async function freshInstall(cwd, projectName, info, pkg, hasGit, hasBoveda, hasDB, wantSchema) {
  if (getDryRun()) console.log(`  ${YELLOW}⚠️  Modo simulación (--dry-run) — no se escribirán archivos${RESET}\n`)
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
  const bovedaDirName = getBovedaDir(cwd) || `boveda-${kebabCase(projectName)}`
  if (!hasBoveda) {
    console.log(`${BOLD}📚 Creando bóveda de conocimiento...${RESET}`)
    maybeCopyDir(join(TEMPLATE, 'boveda'), join(cwd, bovedaDirName))
    const homePath = join(cwd, bovedaDirName, 'Home.md')
    if (existsSync(homePath)) {
      let home = readFileSync(homePath, 'utf-8')
      home = home.replace('[Nombre del Proyecto]', pascalCase(projectName))
      maybeWriteFile(homePath, home)
    }
    const count = readdirSync(join(cwd, bovedaDirName), { recursive: true }).filter(f => f.endsWith('.md')).length
    console.log(`  ${GREEN}✅ ${bovedaDirName}/ creada (${count} documentos)${RESET}\n`)
    populateVaultFiles(cwd)

    // Post-install: check if .env.example is empty or missing
    const envExample = join(cwd, '.env.example')
    const envFile = join(cwd, '.env')
    const hasEnv = existsSync(envExample) || existsSync(envFile)
    if (!hasEnv) {
      console.log(`  ${YELLOW}💡 No se encontró .env ni .env.example${RESET}`)
      console.log(`  ${YELLOW}   Crea un archivo .env.example con tus variables de entorno.${RESET}`)
      const engine = detectDBEngine(cwd)
      if (engine === 'supabase') {
        console.log(`  ${YELLOW}   Variables comunes para Supabase:${RESET}`)
        console.log(`  ${YELLOW}     NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co${RESET}`)
        console.log(`  ${YELLOW}     NEXT_PUBLIC_SUPABASE_ANON_KEY=...${RESET}`)
        console.log(`  ${YELLOW}     SUPABASE_SERVICE_ROLE_KEY=...${RESET}`)
        console.log(`  ${YELLOW}     SUPABASE_ACCESS_TOKEN=sbp_... (para migraciones / Management API)${RESET}`)
      }
      console.log()
    }
  }

  // Inject .opencode/
  console.log(`${BOLD}🔧 Inyectando contexto para AI...${RESET}`)
  maybeCopyDir(join(TEMPLATE, '.opencode'), join(cwd, '.opencode'), true)
  const ctxPath = join(cwd, '.opencode', 'context-map.yaml')
  if (existsSync(ctxPath)) {
    let ctx = readFileSync(ctxPath, 'utf-8')
    ctx = ctx.replace('[Nombre del Proyecto]', pascalCase(projectName))
    maybeWriteFile(ctxPath, ctx)
  }
  console.log(`  ${GREEN}✅ .opencode/ inyectado (plugin + skills + context-map)${RESET}\n`)

  // Inject scripts/
  console.log(`${BOLD}📜 Instalando scripts de utilidad...${RESET}`)
  maybeCopyDir(join(TEMPLATE, 'scripts'), join(cwd, 'scripts'))
  if (!getDryRun()) ensureGitignoreEntries(cwd)
  console.log(`  ${GREEN}✅ scripts/ instalados (load-context, extract-domain, export-schema)${RESET}\n`)

  // Backup + update AGENTS.md
  const agentsPath = join(cwd, 'AGENTS.md')
  if (existsSync(agentsPath)) {
    const backupPath = join(cwd, 'AGENTS.md.bak')
    maybeCopyFile(agentsPath, backupPath)
    console.log(`  ${YELLOW}📄 AGENTS.md existente → respaldado como AGENTS.md.bak${RESET}`)
  }
  const templateAgents = join(TEMPLATE, 'AGENTS.md')
  if (existsSync(templateAgents)) {
    maybeCopyFile(templateAgents, agentsPath)
    console.log(`  ${GREEN}✅ AGENTS.md actualizado${RESET}\n`)
  }

  // Install graphify
  let graphifyVersion = getGraphifyVersion(cwd)
  if (pkg) {
    console.log(`${BOLD}🔗 Instalando Graphify...${RESET}`)
    const tryInstall = (pkgSpec) => {
      try {
        maybeExecSync(`npm install ${pkgSpec}`, { cwd, stdio: 'pipe', timeout: 60000 })
        return true
      } catch { return false }
    }
    let installed = false
    const graphifyPkg = graphifyVersion
      ? `@sentropic/graphify@^${graphifyVersion}`
      : '@sentropic/graphify'
    installed = tryInstall(graphifyPkg)
    if (!installed && graphifyVersion) {
      console.log(`  ${YELLOW}⚠️  Falló pin v${graphifyVersion} — reintentando con latest...${RESET}`)
      installed = tryInstall('@sentropic/graphify')
      if (installed) graphifyVersion = null // will detect below
    }
    if (installed) {
      const p = join(cwd, 'node_modules', '@sentropic', 'graphify', 'package.json')
      if (!getDryRun() && existsSync(p)) {
        graphifyVersion = JSON.parse(readFileSync(p, 'utf-8')).version
      }
      console.log(`  ${GREEN}✅ graphify ${graphifyVersion || ''} instalado${RESET}\n`)
    } else {
      console.log(`  ${YELLOW}⚠️  No se pudo instalar graphify${RESET}\n`)
    }
  }

  // Build graph
  const graphPath = join(cwd, '.graphify', 'graph.json')
  if (getDryRun() || existsSync(join(cwd, 'node_modules', '@sentropic', 'graphify'))) {
    console.log(`${BOLD}🌐 Construyendo grafo de conocimiento...${RESET}`)
    try {
      maybeExecSync('npx graphify detect . 2>/dev/null', { cwd, stdio: 'pipe', timeout: 30000 })
      maybeExecSync('npx graphify update . 2>&1 | tail -3', { cwd, stdio: 'pipe', timeout: 120000 })
      if (!getDryRun() && existsSync(graphPath)) {
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
  if (!getDryRun() && existsSync(graphPath)) {
    if (!existsSync(studioPath)) {
      console.log(`${BOLD}🎨 Generando visualización interactiva...${RESET}`)
      try {
        maybeExecSync('npx graphify studio export ./graphify-visual 2>&1 | tail -3', { cwd, stdio: 'pipe', timeout: 60000 })
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
  writeYoumindagVersion(cwd, graphifyVersion, bovedaDirName)

  // Summary
  const bovedaCount = readdirSync(join(cwd, bovedaDirName), { recursive: true }).filter(f => f.endsWith('.md')).length
  console.log(`${CYAN}${BOLD}  ──────────────────────────${RESET}`)
  console.log(`${GREEN}${BOLD}  🎉 YouMindAG activo en ${projectName}${RESET}\n`)
  console.log(`  ${BOLD}📚 Bóveda:${RESET} ${bovedaCount} documentos en ${bovedaDirName}/`)
  console.log(`  ${BOLD}🔧 Contexto:${RESET} Plugin + skills + context-map`)
  console.log(`  ${BOLD}🌐 Grafo:${RESET} Graphify indexando el código`)
  console.log(`  ${BOLD}📜 Scripts:${RESET} load-context, extract-domain, export-schema, ym-dev, trace-*`)
  if (!isDevScriptWrapped(cwd)) {
    console.log(`  ${YELLOW}💡 Recomendación: youmindag dev --wrap para capturar logs del dev server automáticamente${RESET}`)
  }
  console.log(`\n  ${CYAN}Próximo paso: abrir un chat y escribir cualquier tarea.${RESET}`)
  console.log(`  ${CYAN}El agente cargará el contexto automáticamente.${RESET}\n`)
}





async function upgrade(oldVersion, cwd, projectName) {
  const changes = []
  if (getDryRun()) console.log(`  ${YELLOW}⚠️  Modo simulación (--dry-run) — no se escribirán archivos${RESET}\n`)
  console.log(`  ${BOLD}🔄 Upgrade:${RESET} v${oldVersion} → v${VERSION}`)
  console.log(`  ${BOLD}📦 Proyecto:${RESET} ${projectName}\n`)

  const existingBoveda = getBovedaDir(cwd)
  const bovedaDirName = existingBoveda || `boveda-${kebabCase(projectName)}`

  // 1. AGENTS.md — merge via markers
  const agentsResult = getDryRun() ? 'simulado (dry-run)' : upgradeAgentsMd(cwd, TEMPLATE)
  changes.push(`📄 AGENTS.md — ${agentsResult}`)

  // 2. Bóveda — skip (user territory)
  if (existingBoveda) {
    changes.push(`📦 ${existingBoveda}/ — sin cambios (poblada por el usuario)`)
  } else {
    console.log(`${BOLD}📚 Creando bóveda de conocimiento...${RESET}`)
    maybeCopyDir(join(TEMPLATE, 'boveda'), join(cwd, bovedaDirName))
    const homePath = join(cwd, bovedaDirName, 'Home.md')
    if (existsSync(homePath)) {
      let home = readFileSync(homePath, 'utf-8')
      home = home.replace('[Nombre del Proyecto]', pascalCase(projectName))
      maybeWriteFile(homePath, home)
    }
    const count = readdirSync(join(cwd, bovedaDirName), { recursive: true }).filter(f => f.endsWith('.md')).length
    console.log(`  ${GREEN}✅ ${bovedaDirName}/ creada (${count} documentos)${RESET}\n`)
    populateVaultFiles(cwd)
    changes.push(`📦 ${bovedaDirName}/ — creada`)
  }

  // 3. Scripts + .opencode — overwrite
  if (!getDryRun()) mkdirSync(join(cwd, '.opencode'), { recursive: true })
  const fileChanges = upgradeScriptsOpencode(cwd)
  changes.push(...fileChanges.map(c => `📜 ${c}`))

  // 4. context-map.yaml — merge (preserve user entries)
  if (!getDryRun()) mkdirSync(join(cwd, '.opencode'), { recursive: true })
  const ctxResult = getDryRun() ? 'simulado (dry-run)' : mergeContextMap(cwd, TEMPLATE)
  changes.push(`🔗 .opencode/context-map.yaml — ${ctxResult}`)

  // 5. .gitignore — ensure entries
  if (!getDryRun()) {
    ensureGitignoreEntries(cwd)
    changes.push('📂 .gitignore — entradas actualizadas')
  }

  // 6. Write version
  writeYoumindagVersion(cwd, getGraphifyVersion(cwd), bovedaDirName)

  // Report
  console.log(`${BOLD}\n📋 Cambios aplicados:${RESET}`)
  for (const c of changes) {
    console.log(`  ${GREEN}   ${c}${RESET}`)
  }

  if (!isDevScriptWrapped(cwd)) {
    console.log(`  ${YELLOW}💡 youmindag dev --wrap para capturar logs del dev server automáticamente${RESET}`)
  }

  console.log(`\n${CYAN}${BOLD}  ──────────────────────────${RESET}`)
  console.log(`${GREEN}${BOLD}  ✅ Proyecto actualizado a v${VERSION}${RESET}\n`)
}





async function main() {
  const args = process.argv.slice(2)
  const dryRunIdx = args.indexOf('--dry-run')
  if (dryRunIdx !== -1) {
    setDryRun(true)
    args.splice(dryRunIdx, 1)
  }
  const subcommand = args[0]

  if (subcommand === 'db') {
    return cmdDb(CWD, args.slice(1).join(' ') || null)
  }
  if (subcommand === 'dev') {
    return cmdDev(CWD, args.slice(1))
  }
  if (subcommand === 'references') {
    return cmdReferences(CWD, args[1])
  }
  if (subcommand === 'context') {
    return cmdContext(CWD, args.slice(1))
  }
  if (subcommand === 'trace') {
    return cmdTrace(CWD, args.slice(1))
  }
  if (subcommand === 'status') {
    return cmdStatus(CWD)
  }
  if (subcommand === 'uninstall') {
    return cmdUninstall(CWD)
  }
  if (subcommand === 'watch') {
    return cmdWatch(CWD, args.slice(1))
  }
  if (subcommand === 'sync') {
    return cmdSync(CWD, args.slice(1))
  }
  if (subcommand === 'help' || subcommand === '--help' || subcommand === '-h') {
    return showHelp()
  }
  if (subcommand && (subcommand.startsWith('-') || subcommand.startsWith('--'))) {
    console.error(`${YELLOW}Opción no reconocida: ${subcommand}${RESET}`)
    console.error(`${YELLOW}Usa npx youmindag help para ver los comandos disponibles${RESET}\n`)
    process.exit(1)
  }

  // Default: install or upgrade
  checkStaleBoveda(CWD)

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
    const info = detectLang(CWD)
    const pkg = existsSync(join(CWD, 'package.json'))
    const hasGit = existsSync(join(CWD, '.git'))
    const hasBoveda = !!getBovedaDir(CWD)
    const hasDB = hasPostgres(CWD)
    const wantSchema = hasDB
    await freshInstall(CWD, projectName, info, pkg, hasGit, hasBoveda, hasDB, wantSchema)
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
main().catch(e => {
  console.error(`\n${YELLOW}Error: ${e.message}${RESET}\n`)
  process.exit(1)
})
}
