import { RESET, CYAN, GREEN, YELLOW, BOLD } from '../utils.mjs'

export function cmdGuide(cwd, args) {
  const topic = args.find(a => !a.startsWith('-'))

  if (topic === 'boveda' || topic === 'bóveda' || topic === 'vault') {
    return showBovedaGuide()
  }
  if (topic === 'graphify' || topic === 'grafo' || topic === 'graph') {
    return showGraphifyGuide()
  }

  showFullGuide()
}

function showFullGuide() {
  console.log(`${CYAN}${BOLD}🧠 YouMindAG — Arquitectura Integrada${RESET}\n`)

  console.log(`${BOLD}┌─────────────────────────────────────────────────────────┐${RESET}`)
  console.log(`${BOLD}│ BOVEDA (boveda-*)                                       │${RESET}`)
  console.log(`${BOLD}│${RESET} ├─ 🏗  Arquitectura/ — ADRs, decisiones, flow          `)
  console.log(`${BOLD}│${RESET} ├─ 🧩  Features/ — qué hace cada módulo (negocio)      `)
  console.log(`${BOLD}│${RESET} ├─ 📡  API/ — endpoints, server actions                `)
  console.log(`${BOLD}│${RESET} ├─ 🛠  Stack/ — comandos, librerías, env vars          `)
  console.log(`${BOLD}│${RESET} ├─ 📦  Datos/ — esquema BD                             `)
  console.log(`${BOLD}│${RESET} └─ 🗺  Roadmap/ — changelog, TODOs, troubleshooting    `)
  console.log(`${BOLD}│${RESET}                                                         `)
  console.log(`${BOLD}│${RESET} ¿Cuándo usarla? Cuando necesitas CONTEXTO DE NEGOCIO  `)
  console.log(`${BOLD}│${RESET} Ejemplo: "¿Cómo fluye una infracción?"                 `)
  console.log(`${BOLD}└─────────────────────────────────────────────────────────┘${RESET}`)
  console.log(`              ↕ (${GREEN}youmindag sync${RESET} mantiene sincronizadas)`)
  console.log(`${BOLD}┌─────────────────────────────────────────────────────────┐${RESET}`)
  console.log(`${BOLD}│ GRAPHIFY (.graphify/graph.json)                         │${RESET}`)
  console.log(`${BOLD}│${RESET} ├─ Módulos — qué archivos existen                      `)
  console.log(`${BOLD}│${RESET} ├─ Dependencias — quién importa a quién                `)
  console.log(`${BOLD}│${RESET} └─ Cambios — qué impacta cada diff                     `)
  console.log(`${BOLD}│${RESET}                                                         `)
  console.log(`${BOLD}│${RESET} ¿Cuándo usarla? Cuando necesitas CÓDIGO ACTUAL         `)
  console.log(`${BOLD}│${RESET} Ejemplo: "¿Qué archivos tocan infracciones?"           `)
  console.log(`${BOLD}└─────────────────────────────────────────────────────────┘${RESET}`)
  console.log(`              ↕ (${GREEN}youmindag architect${RESET} mezcla ambas)`)
  console.log(`${BOLD}┌─────────────────────────────────────────────────────────┐${RESET}`)
  console.log(`${BOLD}│ YOUMINDAG (CLI)                                         │${RESET}`)
  console.log(`${BOLD}│${RESET} ├─ ${GREEN}architect <modulo>${RESET} — contexto para arquitecto `)
  console.log(`${BOLD}│${RESET} ├─ ${GREEN}doctor${RESET} — health check del proyecto              `)
  console.log(`${BOLD}│${RESET} ├─ ${GREEN}history${RESET} — sesiones + decisiones previas         `)
  console.log(`${BOLD}│${RESET} ├─ ${GREEN}guide${RESET} — esta guía                               `)
  console.log(`${BOLD}│${RESET} └─ sync, status, db, trace, watch, context...           `)
  console.log(`${BOLD}└─────────────────────────────────────────────────────────┘${RESET}\n`)

  console.log(`${CYAN}${BOLD}Flujo típico de un agente:${RESET}`)
  console.log(`  ${GREEN}1.${RESET} ${CYAN}youmindag architect <modulo>${RESET}  → Lee bóveda + grafo + historial`)
  console.log(`  ${GREEN}2.${RESET} Entiende el contexto                   → Ya sabe qué archivos tocar`)
  console.log(`  ${GREEN}3.${RESET} Implementa                             → Sigue reglas de AGENTS.md`)
  console.log(`  ${GREEN}4.${RESET} Verifica                               → npx tsc + npm run build`)
  console.log(`  ${GREEN}5.${RESET} ${CYAN}youmindag sync${RESET}                     → Actualiza grafo + historial\n`)

  console.log(`${CYAN}💡 Explora secciones:${RESET} ${GREEN}youmindag guide boveda${RESET}  │  ${GREEN}youmindag guide graphify${RESET}\n`)
}

function showBovedaGuide() {
  console.log(`${CYAN}${BOLD}📚 Bóveda de Conocimiento — YouMindAG${RESET}\n`)

  console.log(`${BOLD}Estructura:${RESET}`)
  console.log(`  ${GREEN}boveda-<proyecto>/`)
  console.log(`    ├─ ${CYAN}Home.md${RESET}              — Punto de entrada, resumen del proyecto`)
  console.log(`    ├─ ${CYAN}🏗  Arquitectura/${RESET}    — ADRs, Decisiones.md, FLUJO GENERAL.md`)
  console.log(`    ├─ ${CYAN}🧩  Features/${RESET}        — Un .md por módulo/feature del negocio`)
  console.log(`    ├─ ${CYAN}📡  API/${RESET}             — Endpoints, Server Actions documentados`)
  console.log(`    ├─ ${CYAN}📦  Datos/${RESET}           — Esquema BD, migraciones`)
  console.log(`    ├─ ${CYAN}🛠  Stack/${RESET}           — Comandos, Librerías, Variables de Entorno`)
  console.log(`    ├─ ${CYAN}📚  Referencias/${RESET}     — Documentación externa relevante`)
  console.log(`    └─ ${CYAN}🗺  Roadmap/${RESET}         — Changelog, Pendientes, Troubleshooting\n`)

  console.log(`${BOLD}¿Cuándo consultarla?${RESET}`)
  console.log(`  ${YELLOW}•${RESET} Para entender el negocio y dominio del proyecto`)
  console.log(`  ${YELLOW}•${RESET} Para conocer decisiones técnicas previas (ADRs)`)
  console.log(`  ${YELLOW}•${RESET} Para saber qué features existen y cómo se relacionan`)
  console.log(`  ${YELLOW}•${RESET} Para encontrar comandos, variables de entorno y configuración\n`)

  console.log(`${BOLD}Comandos relacionados:${RESET}`)
  console.log(`  ${GREEN}youmindag architect <modulo>${RESET}   — Contexto de bóveda + grafo`)
  console.log(`  ${GREEN}youmindag context --load <modulo>${RESET} — Documentación y código de un módulo`)
  console.log(`  ${GREEN}youmindag history${RESET}                — Decisiones y sesiones registradas\n`)
}

function showGraphifyGuide() {
  console.log(`${CYAN}${BOLD}🌐 Graphify — Grafo de Conocimiento — YouMindAG${RESET}\n`)

  console.log(`${BOLD}¿Qué es?${RESET}`)
  console.log(`  Un grafo de dependencias de tu código fuente indexado en ${GREEN}.graphify/graph.json${RESET}`)
  console.log(`  Detecta módulos, importaciones y relaciones entre archivos.\n`)

  console.log(`${BOLD}Comandos de graphify:${RESET}`)
  console.log(`  ${GREEN}graphify query "pregunta"${RESET}       — Búsqueda semántica en el código`)
  console.log(`  ${GREEN}graphify summary${RESET}                — Resumen de primer nivel del grafo`)
  console.log(`  ${GREEN}graphify path "A" "B"${RESET}           — Rutas de dependencia entre módulos`)
  console.log(`  ${GREEN}graphify explain "concepto"${RESET}     — Explicar un concepto en el código`)
  console.log(`  ${GREEN}graphify update${RESET}                 — Actualizar el grafo tras cambios\n`)

  console.log(`${BOLD}Integración con YouMindAG:${RESET}`)
  console.log(`  ${GREEN}youmindag sync${RESET}          — graphify detect + update + populate-vault`)
  console.log(`  ${GREEN}youmindag architect <mod>${RESET} — Incluye resultados de graphify query`)
  console.log(`  ${GREEN}youmindag doctor${RESET}         — Verifica si el grafo está actualizado\n`)

  console.log(`${CYAN}💡 Consejo:${RESET} Después de 10+ file edits, ejecuta ${GREEN}youmindag sync${RESET} para mantener el grafo al día.\n`)
}
