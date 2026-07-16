import { existsSync, readFileSync, readdirSync } from 'fs'
import { join, basename } from 'path'
import { execSync } from 'child_process'
import { RESET, CYAN, GREEN, YELLOW, BOLD } from '../utils.mjs'
import { getBovedaDir, readSessionHistory, readDecisions } from '../vault.mjs'

export function cmdArchitect(cwd, args) {
  if (args.includes('--guide') || args.includes('--help') || args.includes('-h')) {
    return showArchitectGuide()
  }

  const dryIdx = args.indexOf('--')
  const moduleName = args.find(a => !a.startsWith('-'))
  const full = args.includes('--full')

  if (!moduleName) {
    return showArchitectDefault(cwd)
  }

  console.log(`${CYAN}${BOLD}# ${moduleName} — Contexto Arquitectónico${RESET}\n`)
  showBovedaContext(cwd, moduleName, full)
  showDependencies(cwd, moduleName, full)
  showHistory(cwd, moduleName, full)

  console.log(`${CYAN}💡 Modo completo:${RESET} ${GREEN}youmindag architect ${moduleName} --full${RESET}`)
  console.log(`${CYAN}💡 Diagnóstico:${RESET} ${GREEN}youmindag doctor${RESET}\n`)
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
  console.log(`  ${CYAN}youmindag architect --guide${RESET}            Mostrar esta guía\n`)
}

function showArchitectDefault(cwd) {
  console.log(`${CYAN}${BOLD}🧠 YouMindAG — Arquitecto${RESET}\n`)

  const bovedaDir = getBovedaDir(cwd)
  if (!bovedaDir) {
    console.log(`${YELLOW}⚠️  Bóveda no encontrada. Ejecuta${RESET} ${GREEN}npx youmindag${RESET} ${YELLOW}para instalar.${RESET}\n`)
    return
  }

  const featuresDir = join(cwd, bovedaDir, '🧩 Features')
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
      console.log(`  ${YELLOW}• ${d.decision || ''}${RESET}`)
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

  const featureFile = join(cwd, bovedaDir, '🧩 Features', `${moduleName}.md`)

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
    const featuresDir = join(cwd, bovedaDir, '🧩 Features')
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

  const graphPath = join(cwd, '.graphify', 'graph.json')
  if (!existsSync(graphPath)) {
    console.log(`  ${YELLOW}⚠️  Grafo no encontrado. Ejecuta${RESET} ${GREEN}youmindag sync${RESET} ${YELLOW}para generarlo.${RESET}\n`)
    return
  }

  try {
    const result = execSync(`npx graphify query "${moduleName}" 2>/dev/null || echo ""`, {
      cwd, stdio: 'pipe', timeout: 15000, encoding: 'utf-8'
    }).trim()

    if (result) {
      const lines = result.split('\n').filter(Boolean)
      const limit = full ? lines.length : 15
      console.log()
      for (const l of lines.slice(0, limit)) {
        console.log(`  ${l}`)
      }
      if (!full && lines.length > limit) {
        console.log(`  ${YELLOW}... (${lines.length - limit} resultados más)${RESET}`)
      }
    } else {
      try {
        const graph = JSON.parse(readFileSync(graphPath, 'utf-8'))
        const nodes = graph.nodes || []
        const matching = nodes.filter(n =>
          (n.id || n.name || '').toLowerCase().includes(moduleName.toLowerCase())
        )
        if (matching.length > 0) {
          console.log()
          for (const n of matching.slice(0, full ? matching.length : 15)) {
            console.log(`  ${CYAN}• ${n.id || n.name || n}${RESET}`)
          }
        } else {
          console.log(`  ${YELLOW}⚠️  Sin resultados en el grafo para "${moduleName}"${RESET}`)
        }
      } catch {
        console.log(`  ${YELLOW}⚠️  No se pudo consultar el grafo${RESET}`)
      }
    }
  } catch {
    try {
      const graph = JSON.parse(readFileSync(graphPath, 'utf-8'))
      const nodes = graph.nodes || []
      const matching = nodes.filter(n =>
        (n.id || n.name || '').toLowerCase().includes(moduleName.toLowerCase())
      )
      if (matching.length > 0) {
        console.log()
        for (const n of matching.slice(0, full ? matching.length : 10)) {
          console.log(`  ${CYAN}• ${n.id || n.name || n}${RESET}`)
        }
      } else {
        console.log(`  ${YELLOW}⚠️  Sin resultados en el grafo para "${moduleName}"${RESET}`)
      }
    } catch {
      console.log(`  ${YELLOW}⚠️  No se pudo consultar el grafo${RESET}`)
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
      const ts = d.timestamp ? new Date(d.timestamp).toLocaleString() : '?'
      console.log(`  ${YELLOW}• [${ts}] ${d.decision || ''}${RESET}`)
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
        const ts = s.timestamp ? new Date(s.timestamp).toLocaleString() : '?'
        console.log(`  ${CYAN}• [${ts}] ${s.key || ''}:${RESET} ${(s.text || '').slice(0, 120)}`)
      }
      console.log()
    }
  }
}

function indent(text, prefix) {
  return text.split('\n').map(l => prefix + l).join('\n')
}
