import { readSessionHistory, readDecisions } from '../vault.mjs'
import { RESET, CYAN, GREEN, YELLOW, BOLD } from '../utils.mjs'

export function cmdHistory(cwd, args) {
  const showSessions = args.includes('--sessions')
  const showDecisions = args.includes('--decisions')
  const recentIdx = args.indexOf('--recent')
  const recent = recentIdx !== -1 ? parseInt(args[recentIdx + 1], 10) || 5 : 5
  const filterIdx = args.indexOf('--filter')
  const filter = filterIdx !== -1 ? args[filterIdx + 1] : null

  const showAll = !showSessions && !showDecisions

  if (showAll || showSessions) {
    const sessions = readSessionHistory(cwd)
    let filtered = sessions
    if (filter) {
      const re = new RegExp(filter, 'i')
      filtered = filtered.filter(e => re.test(e.key || '') || re.test(e.text || ''))
    }
    const recentSessions = filtered.slice(-recent)

    if (recentSessions.length > 0) {
      console.log(`${BOLD}📜 Sesiones (últimas ${recentSessions.length})${RESET}`)
      for (const s of recentSessions) {
        const ts = s.timestamp ? new Date(s.timestamp).toLocaleString() : '?'
        console.log(`  ${CYAN}[${ts}]${RESET} ${GREEN}${s.key || ''}${RESET}: ${s.text || ''}`)
      }
      console.log()
    } else {
      console.log(`${YELLOW}📜 Sin eventos de sesión registrados${RESET}\n`)
    }
  }

  if (showAll || showDecisions) {
    const decisions = readDecisions(cwd)
    let filtered = decisions
    if (filter) {
      const re = new RegExp(filter, 'i')
      filtered = filtered.filter(e => re.test(e.decision || '') || re.test(e.rationale || ''))
    }
    const recentDecisions = filtered.slice(-recent)

    if (recentDecisions.length > 0) {
      console.log(`${BOLD}📋 Decisiones/ADRs (últimas ${recentDecisions.length})${RESET}`)
      for (const d of recentDecisions) {
        const ts = d.timestamp ? new Date(d.timestamp).toLocaleString() : '?'
        console.log(`  ${CYAN}[${ts}]${RESET} ${YELLOW}${d.decision || ''}${RESET}`)
        if (d.rationale) {
          console.log(`           ${d.rationale.slice(0, 100)}${d.rationale.length > 100 ? '…' : ''}`)
        }
      }
      console.log()
    } else {
      console.log(`${YELLOW}📋 Sin decisiones registradas${RESET}\n`)
    }
  }

  if ((!showAll || (readSessionHistory(cwd).length === 0 && readDecisions(cwd).length === 0))) return

  console.log(`${CYAN}💡 Usa${RESET} ${GREEN}youmindag history --recent 20${RESET} ${CYAN}para más entradas${RESET}`)
  console.log(`${CYAN}💡 Usa${RESET} ${GREEN}youmindag history --filter "patrón"${RESET} ${CYAN}para buscar${RESET}\n`)
}
