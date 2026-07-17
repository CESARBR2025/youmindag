import { existsSync, readFileSync, readdirSync } from 'fs'
import { join } from 'path'
import { RESET, CYAN, GREEN, YELLOW, BOLD } from '../utils.mjs'
import { getBovedaDir, readSessionHistory, readDecisions, resolveVaultEntry } from '../vault.mjs'
import { graphifyQueryCompact } from '../graphify.mjs'

const MODULE_NAME_RE = /^[\p{L}\p{N}@/._\- ]+$/u

export function cmdArchitect(cwd, args) {
  if (args.includes('--guide') || args.includes('--help') || args.includes('-h')) {
    return showArchitectGuide()
  }

  const moduleName = args.find(a => !a.startsWith('-'))
  const full = args.includes('--full')
  const showJson = args.includes('--json')

  if (!moduleName) {
    return showArchitectDefault(cwd)
  }

  if (!MODULE_NAME_RE.test(moduleName)) {
    console.error(`${YELLOW}Nombre de módulo inválido: solo letras, números, @/._- y espacios.${RESET}`)
    process.exit(1)
  }

  if (showJson) {
    const context = collectArchitectContext(cwd, moduleName, full)
    process.stdout.write(JSON.stringify(context, null, 2) + '\n')
    return
  }

  console.log(`${CYAN}${BOLD}# ${moduleName} — Contexto Arquitectónico${RESET}\n`)
  showBovedaContext(cwd, moduleName, full)
  showDependencies(cwd, moduleName, full)
  showHistory(cwd, moduleName, full)

  if (!full) {
    console.log(`${CYAN}💡 Modo completo:${RESET} ${GREEN}youmindag architect ${moduleName} --full${RESET}`)
  }
  console.log(`${CYAN}💡 Diagnóstico:${RESET} ${GREEN}youmindag doctor${RESET}\n`)
}

function collectArchitectContext(cwd, moduleName, full) {
  const context = { module: moduleName, boveda: null, graph: null, decisions: [], sessions: [] }

  const bovedaDir = getBovedaDir(cwd)
  if (bovedaDir) {
    const featuresDir = resolveVaultEntry(join(cwd, bovedaDir), '🧩 Features')
    const featureFile = join(featuresDir, `${moduleName}.md`)
    if (existsSync(featureFile)) {
      try {
        const content = readFileSync(featureFile, 'utf-8')
        const lines = content.split('\n')
        context.boveda = {
          file: featureFile,
          lines: lines.length,
          content: full ? content : lines.slice(0, 25).join('\n'),
        }
      } catch {}
    }
  }

  context.graph = graphifyQueryCompact(cwd, moduleName, { summary: !full })

  const decisions = readDecisions(cwd)
  context.decisions = decisions.slice(full ? 0 : -5)

  const q = moduleName.toLowerCase()
  const sessions = readSessionHistory(cwd).filter(s =>
    (`${s.key || ''} ${s.text || ''}`).toLowerCase().includes(q),
  )
  context.sessions = sessions.slice(full ? 0 : -5)

  return context
}

function showArchitectGuide() {
  console.log(`${CYAN}${BOLD}🧠 Protocolo Arquitecto — YouMindAG${RESET}\n`)
  console.log(`${BOLD}Flujo recomendado para cargar contexto de un módulo:${RESET}\n`)
  console.log(`  ${GREEN}1. Bóveda${RESET} → Lee la documentación de negocio en boveda/🧩 Features/<modulo>.md`)
  console.log(`  ${GREEN}2. Graphify${RESET} → Carga el grafo de dependencias (npx graphify query "<modulo>")`)
  console.log(`  ${GREEN}3. Historial${RESET} → Revisa decisiones previas y problemas conocidos\n`)
  console.log(`${BOLD}Uso:${RESET}`)
  console.log(`  ${CYAN}youmindag architect${RESET}                    Mostrar resumen del proyecto`)
  console.log(`  ${CYAN}youmindag architect <modulo>${RESET}           Cargar contexto de un módulo`)
  console.log(`  ${CYAN}youmindag architect <modulo> --full${RESET}    Contexto completo (bóveda + grafo + historial)`)
  console.log(`  ${CYAN}youmindag architect <modulo> --json${RESET}    Contexto en formato JSON`)
  console.log(`  ${CYAN}youmindag architect --guide${RESET}            Mostrar esta guía\n`)
}

function showArchitectDefault(cwd) {
  console.log(`${CYAN}${BOLD}🧠 YouMindAG — Arquitecto${RESET}\n`)

  const bovedaDir = getBovedaDir(cwd)
  if (!bovedaDir) {
    console.log(`${YELLOW}⚠️  Bóveda no encontrada. Ejecuta${RESET} ${GREEN}npx youmindag${RESET} ${YELLOW}para instalar.${RESET}\n`)
    return
  }

  const featuresDir = resolveVaultEntry(join(cwd, bovedaDir), '🧩 Features')
  if (existsSync(featuresDir)) {
    const features = readdirSync(featuresDir).filter(f => f.endsWith('.md')).map(f => f.replace('.md', ''))
    if (features.length > 0) {
      console.log(`${BOLD}📚 Módulos documentados en la bóveda:${RESET}\n`)
      for (const f of features) {
        const path = join(featuresDir, `${f}.md`)
        try {
          const content = readFileSync(path, 'utf-8')
          const firstLine = content.split('\n').find(l => l.trim() && !l.startsWith('#')) || ''
          const preview = firstLine.trim().slice(0, 80) + (firstLine.length > 80 ? '…' : '')
          console.log(`  ${GREEN}🧩 ${f}${RESET} — ${preview}`)
        } catch {
          console.log(`  ${GREEN}🧩 ${f}${RESET}`)
        }
      }
    } else {
      console.log(`${YELLOW}📚 No hay features documentados en ${featuresDir}${RESET}`)
    }
  } else {
    console.log(`${YELLOW}📚 Directorio Features no existe en la bóveda${RESET}`)
  }

  const decisions = readDecisions(cwd)
  if (decisions.length > 0) {
    console.log(`\n${BOLD}📋 Últimas 3 decisiones:${RESET}`)
    for (const d of decisions.slice(-3)) {
      console.log(`  ${YELLOW}• ${d.text || ''}${RESET}`)
    }
  }

  const sessions = readSessionHistory(cwd)
  if (sessions.length > 0) {
    console.log(`\n${BOLD}📜 Última sesión:${RESET}`)
    const last = sessions[sessions.length - 1]
    console.log(`  ${CYAN}${last.key || ''}${RESET}: ${(last.text || '').slice(0, 100)}`)
  }

  console.log(`\n${CYAN}💡 Carga un módulo:${RESET} ${GREEN}youmindag architect <nombre-modulo>${RESET}\n`)
}

function showBovedaContext(cwd, moduleName, full) {
  const bovedaDir = getBovedaDir(cwd)
  if (!bovedaDir) return

  const featuresDir = resolveVaultEntry(join(cwd, bovedaDir), '🧩 Features')
  const featureFile = join(featuresDir, `${moduleName}.md`)

  console.log(`${BOLD}📚 Documentación (Bóveda)${RESET}`)

  if (existsSync(featureFile)) {
    try {
      const content = readFileSync(featureFile, 'utf-8')
      const lines = content.split('\n')
      const limit = full ? lines.length : 25
      console.log(`  ${GREEN}${bovedaDir}/🧩 Features/${moduleName}.md${RESET} (${lines.length} líneas)\n`)
      const snippet = lines.slice(0, limit).join('\n')
      console.log(indent(snippet, '  '))
      if (!full && lines.length > limit) {
        console.log(`  ${YELLOW}... (${lines.length - limit} líneas más — usa --full para ver todo)${RESET}`)
      }
    } catch {
      console.log(`  ${YELLOW}⚠️  No se pudo leer ${featureFile}${RESET}`)
    }
  } else {
    console.log(`  ${YELLOW}⚠️  No se encontró documentación para "${moduleName}"${RESET}`)
    if (existsSync(featuresDir)) {
      const all = readdirSync(featuresDir).filter(f => f.endsWith('.md'))
      const similar = all.filter(f => f.toLowerCase().includes(moduleName.toLowerCase()))
      if (similar.length > 0) {
        console.log(`  ${CYAN}   Quizás quisiste decir:${RESET} ${similar.map(f => f.replace('.md', '')).join(', ')}`)
      }
    }
  }
  console.log()
}

function showDependencies(cwd, moduleName, full) {
  console.log(`${BOLD}🌐 Dependencias (Graphify)${RESET}`)

  const result = graphifyQueryCompact(cwd, moduleName, { summary: !full })

  for (const w of result.warnings) {
    console.log(`  ${YELLOW}⚠️  ${w}${RESET}`)
  }

  if (result.modules.length > 0) {
    console.log()
    for (const m of result.modules) {
      console.log(`  ${CYAN}• ${m}${RESET}`)
    }
  }

  if (result.dependencies.length > 0) {
    console.log(`\n  ${BOLD}Relaciones:${RESET}`)
    for (const d of result.dependencies) {
      console.log(`  ${d.from} ${YELLOW}→${RESET} ${d.to} ${CYAN}[${d.type}]${RESET}`)
    }
  }
  console.log()
}

function showHistory(cwd, moduleName, full) {
  const decisions = readDecisions(cwd)
  if (decisions.length > 0) {
    const limit = full ? decisions.length : 5
    console.log(`${BOLD}📋 Últimas Decisiones (Historial)${RESET}`)
    for (const d of decisions.slice(-limit)) {
      const ts = d.ts ? new Date(d.ts).toLocaleString() : '?'
      console.log(`  ${YELLOW}• [${ts}] ${d.text || ''}${RESET}`)
      if (d.rationale) {
        console.log(`    ${d.rationale.slice(0, 100)}${d.rationale.length > 100 ? '…' : ''}`)
      }
    }
    console.log()
  }

  const sessions = readSessionHistory(cwd)
  if (sessions.length > 0) {
    const limit = full ? sessions.length : 5
    const relevant = sessions.filter(s => {
      const t = (s.key || '') + (s.text || '')
      return t.toLowerCase().includes(moduleName.toLowerCase())
    })
    if (relevant.length > 0) {
      console.log(`${BOLD}📜 Sesiones Relacionadas${RESET}`)
      for (const s of relevant.slice(-limit)) {
        const ts = s.ts ? new Date(s.ts).toLocaleString() : '?'
        console.log(`  ${CYAN}• [${ts}] ${s.key || ''}:${RESET} ${(s.text || '').slice(0, 120)}`)
      }
      console.log()
    }
  }
}

function indent(text, prefix) {
  return text.split('\n').map(l => prefix + l).join('\n')
}
