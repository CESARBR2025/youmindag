import { existsSync, readFileSync, readdirSync, statSync } from 'fs'
import { join } from 'path'
import { execFileSync } from 'child_process'
import { RESET, CYAN, GREEN, YELLOW, BOLD } from '../utils.mjs'
import { getBovedaDir, readYoumindagVersion, readSessionHistory, readDecisions, resolveVaultEntry } from '../vault.mjs'
import { PKG_VERSION } from '../version.mjs'
import { claudeLayerStatus } from '../claude.mjs'
import { checkStaleBoveda } from './misc.mjs'

export function cmdDoctor(cwd, args) {
  const showJson = args.includes('--json')
  const remote = args.includes('--remote')

  if (showJson) {
    const result = collectChecks(cwd, remote)
    process.stdout.write(JSON.stringify(result, null, 2) + '\n')
    return
  }

  const installedVersion = readYoumindagVersion(cwd)

  console.log(`${CYAN}${BOLD}YouMindAG v${PKG_VERSION} — Diagnóstico${RESET}\n`)

  if (!installedVersion) {
    console.log(`  ${YELLOW}⚠️  YouMindAG no está instalado en este proyecto${RESET}`)
    console.log(`  ${YELLOW}   Ejecuta${RESET} ${GREEN}npx youmindag${RESET} ${YELLOW}para instalar${RESET}\n`)
    return
  }

  const checks = collectChecks(cwd, remote)

  // Installed version
  const status = checks.upToDate ? '✅' : '⚠️'
  console.log(`${status} ${BOLD}Versión instalada:${RESET} ${installedVersion} (${checks.upToDate ? 'actualizada' : `v${checks.latestVersion} disponible`})`)

  // Boveda
  if (checks.hasBoveda) {
    console.log(`✅ ${BOLD}Bóveda:${RESET} ${checks.bovedaDir} (${checks.featuresCount}/${checks.featuresCount + checks.featuresMissing} features documentados)`)
  } else {
    console.log(`❌ ${BOLD}Bóveda:${RESET} No encontrada`)
  }

  // Graphify
  if (checks.hasGraphify && checks.hasGraph) {
    const ago = checks.graphAge || 'desconocido'
    const stale = checks.graphStale ? ` (stale: ${ago}, recomendado: youmindag sync)` : ''
    console.log(`✅ ${BOLD}Graphify:${RESET} .graphify/graph.json${stale}`)
  } else if (checks.hasGraphify) {
    console.log(`⚠️  ${BOLD}Graphify:${RESET} Instalado sin grafo. Ejecuta youmindag sync`)
  } else {
    console.log(`⚠️  ${BOLD}Graphify:${RESET} No instalado`)
  }

  // AGENTS.md
  if (checks.hasAgentsMd) {
    console.log(`✅ ${BOLD}AGENTS.md:${RESET} Con reglas de YouMindAG`)
  } else {
    console.log(`⚠️  ${BOLD}AGENTS.md:${RESET} Sin marcadores YouMindAG`)
  }

  // Scripts
  const scriptsStatus = checks.hasScripts ? '✅' : '⚠️'
  console.log(`${scriptsStatus} ${BOLD}Scripts:${RESET} ${checks.hasScripts ? 'load-context, extract-domain, session-checkpoint, etc.' : 'No encontrados'}`)

  // Enforcement Claude Code
  if (checks.enforcement.detected) {
    const e = checks.enforcement
    const eOk = e.hooksOk && e.claudeMdOk && e.skillOk && e.scriptsOk
    console.log(`${eOk ? '✅' : '⚠️'} ${BOLD}Enforcement Claude Code:${RESET} ${eOk ? `activo (guard: ${e.guardMode})` : 'incompleto — ejecuta youmindag enforce --install'}`)
  }

  // Sessions + Decisions
  const sessionCount = checks.sessionsCount
  const decisionCount = checks.decisionsCount
  if (sessionCount > 0 || decisionCount > 0) {
    console.log(`✅ ${BOLD}Historial:${RESET} ${sessionCount} sesiones, ${decisionCount} decisiones registradas`)
  } else {
    console.log(`⚠️  ${BOLD}Historial:${RESET} Sin datos de sesión/decisiones`)
  }

  // Brechas
  console.log()
  if (checks.featuresMissing > 0) {
    console.log(`⚠️  ${BOLD}Brechas:${RESET} ${checks.featuresMissing} features sin documentación en la bóveda`)
  }
  if (checks.staleBoveda) {
    const sb = checks.staleBoveda
    if (sb.mode === 'per-feature' && sb.stale.length > 0) {
      console.log(`⚠️  ${BOLD}Brechas:${RESET} ${sb.stale.length}/${sb.evaluated} feature${sb.stale.length === 1 ? '' : 's'} posiblemente desactualizado${sb.stale.length === 1 ? '' : 's'}: ${sb.stale.map(s => s.feature).join(', ')}`)
    } else if (sb.mode === 'legacy') {
      console.log(`⚠️  ${BOLD}Brechas:${RESET} Bóveda ${sb.count} commits atrasada (chequeo global, impreciso — sin tablas de Componentes en los docs)`)
    }
  }

  // Code anomalies
  if (checks.deadCode.length > 0) {
    console.log(`\n❌ ${BOLD}Código muerto detectado:${RESET}`)
    for (const dc of checks.deadCode) {
      console.log(`   ${dc}`)
    }
  }

  // Recommendations
  const recs = []
  if (!checks.upToDate) {
    recs.push(`${GREEN}npx youmindag${RESET} — actualizar a la última versión`)
  }
  if (checks.hasGraphify && (checks.graphStale || !checks.hasGraph)) {
    recs.push(`${GREEN}youmindag sync${RESET} — actualizar grafo`)
  }
  if (checks.hasBoveda && checks.featuresWithDocs.length > 0) {
    recs.push(`${GREEN}youmindag architect ${checks.featuresWithDocs[0]}${RESET} — cargar contexto del módulo principal`)
  }
  if (!checks.hasBoveda || checks.featuresMissing > 0) {
    recs.push(`${GREEN}node scripts/populate-vault.mjs${RESET} — repoblar bóveda`)
  }
  recs.push(`${GREEN}youmindag guide${RESET} — entender cómo funciona YouMindAG`)

  console.log(`\n${CYAN}${BOLD}💡 Próximos pasos recomendados:${RESET}`)
  recs.forEach((r, i) => console.log(`   ${i + 1}. ${r}`))
  console.log()
}

function collectChecks(cwd, remote = false) {
  const bovedaDir = getBovedaDir(cwd)
  const hasBoveda = !!bovedaDir

  let featuresCount = 0
  let featuresMissing = 0
  let featuresWithDocs = []

  if (hasBoveda) {
    const featuresDir = resolveVaultEntry(join(cwd, bovedaDir), '🧩 Features')
    if (existsSync(featuresDir)) {
      const docFiles = readdirSync(featuresDir).filter(f => f.endsWith('.md') && f !== 'Index.md')
      featuresWithDocs = []
      for (const f of docFiles) {
        try {
          const content = readFileSync(join(featuresDir, f), 'utf-8')
          if (content.includes('Pendiente de documentar')) featuresMissing++
          else featuresWithDocs.push(f.replace('.md', ''))
        } catch {
          featuresMissing++
        }
      }
      featuresCount = featuresWithDocs.length
    }
  }

  const hasGraphify = existsSync(join(cwd, 'node_modules', '@sentropic', 'graphify'))
  const graphPath = join(cwd, '.graphify', 'graph.json')
  const hasGraph = existsSync(graphPath)

  let graphAge = null
  let graphStale = false
  if (hasGraph) {
    try {
      const graphStat = statSync(graphPath)
      const ageMs = Date.now() - graphStat.mtimeMs
      const ageMin = Math.round(ageMs / 60000)
      if (ageMin < 60) {
        graphAge = `${ageMin}min`
      } else {
        graphAge = `${Math.round(ageMin / 60)}h`
      }
      graphStale = ageMin > 120
    } catch {}
  }

  const hasAgentsMd = existsSync(join(cwd, 'AGENTS.md'))
  const hasScripts = existsSync(join(cwd, 'scripts', 'load-context.mjs'))
  const hasDotOpendcode = existsSync(join(cwd, '.opencode', 'opencode.json'))

  const sessions = readSessionHistory(cwd)
  const decisions = readDecisions(cwd)

  const staleBoveda = checkStaleBoveda(cwd, true)

  const deadCode = []

  // Check referenced but non-existent scripts
  if (hasAgentsMd) {
    try {
      const agentsContent = readFileSync(join(cwd, 'AGENTS.md'), 'utf-8')
      const scriptRefs = [...agentsContent.matchAll(/node scripts\/([a-zA-Z0-9_-]+\.mjs)/g)]
      for (const ref of scriptRefs) {
        const scriptPath = join(cwd, 'scripts', ref[1])
        if (!existsSync(scriptPath)) {
          deadCode.push(`Referencia a script inexistente: scripts/${ref[1]}`)
        }
      }
    } catch {}
  }

  const installedVersion = readYoumindagVersion(cwd)
  // Por defecto se compara contra la versión local del CLI (sin red).
  // Con --remote se consulta npm para conocer la última publicada.
  let latestVersion = PKG_VERSION
  if (remote) {
    try {
      const result = String(execFileSync('npm', ['view', 'youmindag', 'version'], { timeout: 5000, encoding: 'utf-8' })).trim()
      if (result) latestVersion = result
    } catch {}
  }

  return {
    version: installedVersion,
    installed: !!installedVersion,
    upToDate: installedVersion === latestVersion,
    latestVersion,
    hasBoveda,
    bovedaDir,
    featuresCount,
    featuresMissing,
    featuresWithDocs,
    hasGraphify,
    hasGraph,
    graphAge,
    graphStale,
    hasAgentsMd,
    hasScripts,
    hasDotOpendcode,
    sessionsCount: sessions.length,
    decisionsCount: decisions.length,
    staleBoveda,
    deadCode,
    enforcement: claudeLayerStatus(cwd),
  }
}
