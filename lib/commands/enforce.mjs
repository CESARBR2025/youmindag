// YouMindAG — comando enforce: gestiona la capa de enforcement para Claude Code
import { RESET, CYAN, GREEN, YELLOW, BOLD } from '../utils.mjs'
import { installClaudeLayer, uninstallClaudeLayer, claudeLayerStatus, installCursorRule } from '../claude.mjs'

export function cmdEnforce(cwd, args, templateDir) {
  if (args.includes('--install')) {
    console.log(`${CYAN}${BOLD}🛡️  YouMindAG — Instalando enforcement${RESET}\n`)
    const { ok, results } = installClaudeLayer(cwd, templateDir)
    for (const r of results) console.log(`  ${ok ? GREEN : YELLOW}${r}${RESET}`)
    if (args.includes('--cursor')) {
      const cursorResult = installCursorRule(cwd)
      if (cursorResult) console.log(`  ${GREEN}🖱  ${cursorResult}${RESET}`)
      else console.log(`  ${YELLOW}🖱  .cursor/ no existe — regla de Cursor omitida${RESET}`)
    }
    console.log(`\n  ${CYAN}Modo del guard: "warn" por defecto. Para bloquear: agrega ${GREEN}"guard": "block"${CYAN} en .youmindag.json${RESET}`)
    console.log(`  ${CYAN}Escape hatch puntual: ${GREEN}YM_NO_GUARD=1${RESET}\n`)
    return
  }

  if (args.includes('--uninstall')) {
    console.log(`${CYAN}${BOLD}🛡️  YouMindAG — Retirando enforcement${RESET}\n`)
    const results = uninstallClaudeLayer(cwd)
    if (results.length === 0) console.log(`  ${YELLOW}Nada que retirar.${RESET}`)
    for (const r of results) console.log(`  ${GREEN}${r}${RESET}`)
    console.log()
    return
  }

  // --status (default)
  const s = claudeLayerStatus(cwd)
  console.log(`${CYAN}${BOLD}🛡️  YouMindAG — Enforcement (Claude Code)${RESET}\n`)
  console.log(`  ${s.detected ? '✅' : '⚠️'} Claude Code detectado: ${s.detected ? 'sí' : 'no (.claude/ o CLAUDE.md no encontrados)'}`)
  console.log(`  ${s.hooksOk ? '✅' : '❌'} Hooks en .claude/settings.json: ${s.hooksOk ? 'instalados' : 'no instalados'}`)
  console.log(`  ${s.claudeMdOk ? '✅' : '❌'} CLAUDE.md → AGENTS.md: ${s.claudeMdOk ? 'ok' : 'falta'}`)
  console.log(`  ${s.skillOk ? '✅' : '❌'} Skill .claude/skills/youmindag: ${s.skillOk ? 'instalada' : 'falta'}`)
  console.log(`  ${s.scriptsOk ? '✅' : '❌'} Scripts ym-hook-*: ${s.scriptsOk ? 'presentes' : 'faltan (ejecuta npx youmindag)'}`)
  console.log(`  ⚙️  Modo del guard: ${BOLD}${s.guardMode}${RESET} ("warn" | "block" | "off" en .youmindag.json)`)

  if (!s.hooksOk || !s.claudeMdOk || !s.skillOk) {
    console.log(`\n  ${CYAN}💡 Instala la capa completa:${RESET} ${GREEN}youmindag enforce --install${RESET}`)
  }
  console.log()
}
