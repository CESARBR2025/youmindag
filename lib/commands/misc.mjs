// YouMindAG — CLI commands
import { existsSync, readFileSync, writeFileSync, readdirSync } from 'fs'
import { join } from 'path'
import { RESET, CYAN, GREEN, YELLOW, BOLD } from '../utils.mjs'
import { getBovedaDir, readYoumindagVersion, readYoumindagData, YOUMINDAG_JSON } from '../vault.mjs'
import { cleanGitignoreEntries } from '../gitignore.mjs'


export function cmdStatus(cwd, version) {
  const showJson = process.argv.includes('--json')

  const oldVersion = readYoumindagVersion(cwd)
  const isInstalled = !!oldVersion
  const isUpToDate = oldVersion === version
  const staleBoveda = checkStaleBoveda(cwd, true)

  if (showJson) {
    const status = {
      version: version,
      installed: isInstalled,
      installedVersion: oldVersion || null,
      upToDate: isUpToDate,
      staleBoveda: staleBoveda || null,
      hasBoveda: !!getBovedaDir(cwd),
      hasDotOpendcode: existsSync(join(cwd, '.opencode', 'opencode.json')),
      hasScripts: existsSync(join(cwd, 'scripts', 'load-context.mjs')),
      hasGraphify: existsSync(join(cwd, 'node_modules', '@sentropic', 'graphify')),
      hasGraph: existsSync(join(cwd, '.graphify', 'graph.json')),
    }
    process.stdout.write(JSON.stringify(status, null, 2) + '\n')
    return
  }

  console.log(`${BOLD}YouMindAG v${version} — Estado${RESET}\n`)

  if (isInstalled) {
    if (isUpToDate) {
      console.log(`  ${GREEN}✅ Versión actualizada (v${version})${RESET}`)
    } else {
      console.log(`  ${YELLOW}⚠️  v${oldVersion} → v${version} disponible${RESET}`)
      console.log(`  ${YELLOW}   Ejecuta npx youmindag para actualizar${RESET}`)
    }
  } else {
    console.log(`  ${YELLOW}⚠️  YouMindAG no instalado en este proyecto${RESET}`)
    console.log(`  ${YELLOW}   Ejecuta npx youmindag para instalar${RESET}`)
  }

  checkStaleBoveda(cwd)
  console.log()
}

export function cmdUninstall(cwd, version) {
  console.log(`${BOLD}YouMindAG v${version} — Desinstalación${RESET}\n`)

  const oldVersion = readYoumindagVersion(cwd)
  if (!oldVersion) {
    console.log(`  ${YELLOW}⚠️  YouMindAG no está instalado en este proyecto${RESET}\n`)
    return
  }

  console.log(`  ${YELLOW}⚠️  Se eliminarán los siguientes archivos/directorios:${RESET}`)
  const targets = []
  const bovedaDir = getBovedaDir(cwd)
  const check = (path, label) => { if (existsSync(path)) targets.push(label) }
  if (bovedaDir) check(join(cwd, bovedaDir), `📚 ${bovedaDir}/ (bóveda de conocimiento)`)
  // Legacy cleanup
  if (existsSync(join(cwd, 'boveda')) && !bovedaDir) check(join(cwd, 'boveda'), '📚 boveda/ (bóveda legacy)')
  check(join(cwd, '.opencode'), '🔧 .opencode/ (plugin + skills + context-map)')
  check(join(cwd, 'scripts'), '📜 scripts/ (utilidades)')
  check(join(cwd, '.youmindag'), '📁 .youmindag/ (sesión + estado)')
  check(join(cwd, '.youmindag.json'), '📄 .youmindag.json (versión)')
  check(join(cwd, '.graphify'), '🌐 .graphify/ (grafo de conocimiento)')
  check(join(cwd, 'graphify-visual'), '🎨 graphify-visual/ (studio visual)')
  check(join(cwd, 'AGENTS.md'), '📋 AGENTS.md (reglas del agente)')

  for (const t of targets) console.log(`  ${t}`)
  console.log()

  // Git safety check — warn about uncommitted changes in targets
  if (existsSync(join(cwd, '.git'))) {
    try {
      const bovedaGitPath = getBovedaDir(cwd) || 'boveda'
      const dirty = String(execSync(`git status --porcelain ${bovedaGitPath}/ .opencode/ scripts/ AGENTS.md 2>/dev/null || true`, { cwd, encoding: 'utf-8' })).trim()
      if (dirty) {
        const lines = dirty.split('\n').length
        console.log(`  ${YELLOW}⚠️  ${lines} archivo${lines !== 1 ? 's' : ''} sin commitear en los directorios a eliminar:${RESET}`)
        for (const line of dirty.split('\n').slice(0, 5)) {
          console.log(`     ${line}`)
        }
        if (dirty.split('\n').length > 5) console.log(`     ... y ${dirty.split('\n').length - 5} más`)
        console.log(`  ${YELLOW}   Se perderán si no están commiteados.${RESET}\n`)
      }
    } catch {}
  }

  const readline = createInterface({ input: process.stdin, output: process.stdout })
  readline.question(`  ${YELLOW}¿Continuar con la desinstalación? (y/N)${RESET} `, (answer) => {
    readline.close()
    if (!answer || !answer.toLowerCase().startsWith('y')) {
      console.log(`  ${YELLOW}Cancelado.${RESET}\n`)
      return
    }

    const dirsToRemove = ['.youmindag', '.opencode', 'scripts', '.graphify', 'graphify-visual']
    const bd = getBovedaDir(cwd)
    if (bd) dirsToRemove.push(bd)
    if (existsSync(join(cwd, 'boveda'))) dirsToRemove.push('boveda') // legacy
    for (const dir of dirsToRemove) {
      const full = join(cwd, dir)
      if (existsSync(full)) {
        try { rmSync(full, { recursive: true, force: true }); console.log(`  ${GREEN}✅ Eliminado: ${dir}${RESET}`) }
        catch { console.log(`  ${YELLOW}⚠️  No se pudo eliminar: ${dir}${RESET}`) }
      }
    }

    const ymJson = join(cwd, '.youmindag.json')
    if (existsSync(ymJson)) {
      try { rmSync(ymJson); console.log(`  ${GREEN}✅ Eliminado: .youmindag.json${RESET}`) } catch {}
    }

    const agentsPath = join(cwd, 'AGENTS.md')
    if (existsSync(agentsPath)) {
      try {
        const content = readFileSync(agentsPath, 'utf-8')
        if (content.includes('<!-- BEGIN:youmindag -->')) {
          const begin = content.indexOf('<!-- BEGIN:youmindag -->')
          const end = content.indexOf('<!-- END:youmindag -->')
          if (begin !== -1 && end !== -1) {
            const stripped = content.slice(0, begin) + content.slice(end + '<!-- END:youmindag -->'.length)
            writeFileSync(agentsPath, stripped.trimStart())
            console.log(`  ${GREEN}✅ Marcadores YouMindAG retirados de AGENTS.md${RESET}`)
          }
        } else {
          rmSync(agentsPath)
          console.log(`  ${GREEN}✅ Eliminado: AGENTS.md${RESET}`)
        }
        const bakPath = join(cwd, 'AGENTS.md.bak')
        if (existsSync(bakPath)) { rmSync(bakPath); console.log(`  ${GREEN}✅ Eliminado: AGENTS.md.bak${RESET}`) }
      } catch { console.log(`  ${YELLOW}⚠️  No se pudo procesar AGENTS.md${RESET}`) }
    }

    const pkgPath = join(cwd, 'package.json')
    if (existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'))
        if (pkg.dependencies?.['@sentropic/graphify']) {
          delete pkg.dependencies['@sentropic/graphify']
          writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n')
          console.log(`  ${GREEN}✅ @sentropic/graphify retirado de package.json${RESET}`)
        }
        if (pkg.scripts?.dev === 'node scripts/ym-dev.mjs') {
          delete pkg.scripts.dev
          writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n')
          console.log(`  ${YELLOW}⚠️  Dev script restaurado (vuelve a configurarlo manualmente)${RESET}`)
        }
      } catch {}
    }

    try { cleanGitignoreEntries(cwd); console.log(`  ${GREEN}✅ Entradas de .gitignore limpiadas${RESET}`) } catch {}

    console.log(`\n  ${GREEN}${BOLD}✅ YouMindAG desinstalado.${RESET}`)
    console.log(`  ${CYAN}   Para eliminar node_modules/@sentropic/graphify: npm uninstall @sentropic/graphify${RESET}\n`)
  })
}


export function checkStaleBoveda(cwd, returnResult = false) {
  if (!existsSync(join(cwd, '.git'))) return returnResult ? null : undefined

  try {
    const bovedaGitPath = getBovedaDir(cwd) || 'boveda'
    const bovedaLog = String(execSync(`git log --oneline -1 -- ${bovedaGitPath}/ 2>/dev/null || true`, { cwd, encoding: 'utf-8' })).trim()
    const srcDirs = ['app/', 'lib/', 'src/', 'components/']
    let sourceLog = ''
    for (const dir of srcDirs) {
      if (existsSync(join(cwd, dir.replace('/', '')))) {
        sourceLog = String(execSync(`git log --oneline -1 -- ${dir} 2>/dev/null || true`, { cwd, encoding: 'utf-8' })).trim()
        if (sourceLog) break
      }
    }

    if (!bovedaLog || !sourceLog) return returnResult ? null : undefined

    const bovedaCommit = bovedaLog.split(' ')[0]
    const sourceCommit = sourceLog.split(' ')[0]

    if (bovedaCommit === sourceCommit) return returnResult ? null : undefined

    const countStr = String(execSync(`git rev-list --count ${bovedaCommit}..${sourceCommit} 2>/dev/null || echo 0`, { cwd, encoding: 'utf-8' })).trim()
    const count = parseInt(countStr, 10) || 0

    if (count > 0) {
      if (returnResult) return { count, bovedaLog, sourceLog }
      console.log(`  ${YELLOW}⚠️  ${bovedaGitPath}/ está ${count} commit${count === 1 ? '' : 's'} atrasada respecto al código fuente${RESET}`)
      console.log(`  ${YELLOW}   Último cambio en bóveda:  ${bovedaLog}${RESET}`)
      console.log(`  ${YELLOW}   Último cambio en source: ${sourceLog}${RESET}`)
      console.log()
    }
  } catch {}
  return returnResult ? null : undefined
}

// ─── Dev script wrapper ─────────────────────────────────────────


export function cmdReferences(cwd, symbol) {
  if (!symbol) {
    console.error(`${YELLOW}Uso: youmindag references <simbolo>${RESET}`)
    console.error(`${YELLOW}Ej: youmindag references requireOperador${RESET}\n`)
    process.exit(1)
  }

  console.log(`${CYAN}🔍 Buscando referencias de: ${symbol}${RESET}\n`)

  const files = findProjectFiles(cwd)
  const results = []

  const wordBoundary = new RegExp(`\\b${symbol.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`)

  for (const file of files) {
    try {
      const content = readFileSync(file, 'utf-8')
      const lines = content.split('\n')
      for (let i = 0; i < lines.length; i++) {
        if (wordBoundary.test(lines[i]) && !lines[i].trim().startsWith('//') && !lines[i].trim().startsWith('*')) {
          const rel = relative(cwd, file)
          const snippet = lines[i].trim().slice(0, 60) + (lines[i].trim().length > 60 ? '…' : '')
          results.push({ file: rel, line: i + 1, snippet })
        }
      }
    } catch {}
  }

  if (results.length === 0) {
    console.log(`${YELLOW}No se encontraron referencias.${RESET}\n`)
    return
  }

  const fileWidth = Math.max('Archivo'.length, ...results.map(r => r.file.length))
  const lineWidth = Math.max('Línea'.length, ...results.map(r => String(r.line).length))
  const snippetWidth = Math.max('Contexto'.length, ...results.map(r => r.snippet.length))

  const c1 = fileWidth + 2
  const c2 = lineWidth + 2
  const c3 = snippetWidth + 2

  let out = ''
  out += '┌' + '─'.repeat(c1) + '┬' + '─'.repeat(c2) + '┬' + '─'.repeat(c3) + '┐\n'
  out += '│ ' + 'Archivo'.padEnd(fileWidth) + ' │ ' + 'Línea'.padEnd(lineWidth) + ' │ ' + 'Contexto'.padEnd(snippetWidth) + ' │\n'
  out += '├' + '─'.repeat(c1) + '┼' + '─'.repeat(c2) + '┼' + '─'.repeat(c3) + '┤\n'

  for (const r of results) {
    out += '│ ' + r.file.padEnd(fileWidth) + ' │ ' + String(r.line).padStart(lineWidth) + ' │ ' + r.snippet.padEnd(snippetWidth) + ' │\n'
  }

  out += '└' + '─'.repeat(c1) + '┴' + '─'.repeat(c2) + '┴' + '─'.repeat(c3) + '┘\n'
  out += `\n${results.length} referencia${results.length === 1 ? '' : 's'} en ${new Set(results.map(r => r.file)).size} archivo${new Set(results.map(r => r.file)).size === 1 ? '' : 's'}\n`

  process.stdout.write(out)
}

// ─── youmindag context ───────────────────────────────────────────

export function cmdContext(cwd, subArgs) {
  const loadIdx = subArgs.indexOf('--load')
  const moduleName = loadIdx !== -1 ? subArgs[loadIdx + 1] : null

  if (!moduleName) {
    console.error(`${YELLOW}Uso: youmindag context --load <modulo>${RESET}\n`)
    process.exit(1)
  }

  console.log(`${CYAN}📋 Contexto para: ${moduleName}${RESET}\n`)

  const contextMapPath = join(cwd, '.opencode', 'context-map.yaml')
  let fromMap = false

  if (existsSync(contextMapPath)) {
    try {
      const yaml = readFileSync(contextMapPath, 'utf-8')
      const section = yaml.split('\n').reduce((acc, line) => {
        if (line.match(/^\S/)) acc.current = line.trim()
        if (acc.current && acc.current.toLowerCase().includes(moduleName.toLowerCase())) {
          acc.lines.push(line)
        }
        return acc
      }, { current: null, lines: [] })

      if (section.lines.length > 0) {
        fromMap = true
        console.log(`${GREEN}📄 Detectado en context-map.yaml:${RESET}`)
        for (const l of section.lines) {
          console.log(`  ${l.trim()}`)
        }
        console.log()
      }
    } catch {}
  }

  // Heuristic fallback
  const bovedaDir = getBovedaDir(cwd) || 'boveda'
  const bovedaFile = join(cwd, bovedaDir, '🧩 Features', `${moduleName}.md`)
  if (existsSync(bovedaFile)) {
    const lines = readFileSync(bovedaFile, 'utf-8').split('\n').length
    console.log(`${GREEN}📄 Documentación: ${bovedaDir}/🧩 Features/${moduleName}.md (${lines} líneas)${RESET}`)
  }

  const srcDirs = [join(cwd, 'lib', moduleName), join(cwd, 'app', moduleName), join(cwd, 'src', moduleName)]
  for (const dir of srcDirs) {
    if (existsSync(dir)) {
      const files = readdirSync(dir, { recursive: true }).filter(f => extname(f).match(/\.(ts|tsx|js|jsx)$/)).length
      console.log(`${GREEN}📁 Código: ${relative(cwd, dir)}/ (${files} archivos)${RESET}`)
    }
  }

  const appDirs = [join(cwd, 'app'), join(cwd, 'src', 'app')]
  for (const appDir of appDirs) {
    if (existsSync(appDir)) {
      const matches = readdirSync(appDir, { recursive: true, withFileTypes: true })
        .filter(e => e.isDirectory() && e.name.toLowerCase().includes(moduleName.toLowerCase()))
      for (const m of matches) {
        const full = join(m.parentPath || appDir, m.name)
        console.log(`${GREEN}🖥  Vistas: ${relative(cwd, full)}/${RESET}`)
      }
    }
  }

  if (!fromMap) {
    console.log(`${GREEN}🔍 Graphify: graphify query "${moduleName}"${RESET}`)
  }

  console.log(`\n${CYAN}📖 Carga sugerida para el modelo:${RESET}`)
  if (existsSync(bovedaFile)) {
    console.log(`  ${CYAN}1.${RESET} ${bovedaDir}/🧩 Features/${moduleName}.md`)
  }
  const codeDirs = [join(cwd, 'lib', moduleName), join(cwd, 'app', moduleName), join(cwd, 'src', moduleName)]
  for (const dir of codeDirs) {
    if (!existsSync(dir)) continue
    const typeFile = [join(dir, 'types.ts'), join(dir, 'types.tsx')].find(f => existsSync(f))
    const mainFile = [join(dir, 'actions.ts'), join(dir, 'service.ts'), join(dir, 'index.ts')].find(f => existsSync(f))
    if (typeFile) console.log(`  ${CYAN}2.${RESET} ${relative(cwd, typeFile)}`)
    if (mainFile) console.log(`  ${CYAN}3.${RESET} ${relative(cwd, mainFile)}`)
  }
  console.log()
}

export function showHelp(version) {
  console.log(`\n${BOLD}${CYAN}🧠 YouMindAG v${version}${RESET}`)
  console.log(`${CYAN}Inyecta inteligencia de contexto a cualquier proyecto.${RESET}\n`)
  console.log(`${BOLD}Uso:${RESET}`)
  console.log(`  npx youmindag                           Instalar o actualizar el proyecto`)
  console.log(`  npx youmindag --dry-run                 Simular instalación (sin escribir)`)
  console.log(`  npx youmindag db "SELECT ..."           Ejecutar query SQL contra la BD`)
  console.log(`  npx youmindag db                        Modo interactivo REPL de BD`)
  console.log(`  npx youmindag dev --status              Ver estado del servidor de desarrollo`)
  console.log(`  npx youmindag dev --restart             Reiniciar el servidor de desarrollo`)
  console.log(`  npx youmindag dev --logs                Ver logs del servidor de desarrollo`)
  console.log(`  npx youmindag dev --wrap                Envolver dev script para capturar logs automáticos`)
  console.log(`  npx youmindag dev --unwrap              Restaurar dev script original`)
  console.log(`  npx youmindag references <simbolo>      Buscar referencias de un símbolo en el código`)
  console.log(`  npx youmindag context --load <modulo>   Cargar contexto de un módulo`)
  console.log(`  npx youmindag trace --client "Comp"     Rastrear hooks (useEffect/useState) en componente cliente`)
  console.log(`  npx youmindag trace --components "A,B"  Inyectar lifecycle tracker en UI (React)`)
  console.log(`  npx youmindag trace --server "fn1,fn2"  Inyectar tracer en funciones server-side`)
  console.log(`  npx youmindag trace --undo              Restaurar todos los archivos originales`)
  console.log(`  npx youmindag trace --force             Ignorar advertencia de cambios sin commit`)
  console.log(`  npx youmindag status                    Verificar estado de la bóveda`)
  console.log(`  npx youmindag status --json             Estado en formato JSON`)
  console.log(`  npx youmindag watch                     Observar cambios y repoblar bóveda automáticamente`)
  console.log(`  npx youmindag watch --poll              Watch con polling (para sistemas de archivos remotos)`)
  console.log(`  npx youmindag sync                      Sincronizar grafo y bóveda (post git pull/merge)`)
  console.log(`  npx youmindag sync --hook               Instalar git hook post-merge para sync automático`)
  console.log(`  npx youmindag uninstall                 Desinstalar YouMindAG del proyecto`)
  console.log(`  npx youmindag help                      Mostrar esta ayuda`)
  console.log()
}
