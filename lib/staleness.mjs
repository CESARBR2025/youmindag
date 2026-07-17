// YouMindAG — staleness de la bóveda, a nivel de feature (no de repo global).
//
// git-log-distance repo-global mide ACTIVIDAD, no DRIFT de contenido: un
// commit que solo arregla un typo en lib/x.ts sube el contador igual que
// uno que reescribe el flujo completo; y un commit que toca boveda/ de paso
// resetea el contador aunque la prosa real no se haya actualizado. Además
// no dice QUÉ parte de la bóveda revisar.
//
// Esta versión usa la tabla `## Componentes` que cada Feature doc ya declara
// (plantilla estándar: `| Archivo | Rol |` con rutas entre backticks) para
// comparar el último commit del doc contra el último commit de los archivos
// que ese doc dice describir. Señal por feature, no por repo.

import { existsSync, readFileSync, readdirSync } from 'fs'
import { join } from 'path'
import { runGit } from './exec.mjs'
import { getBovedaDir, resolveVaultEntry } from './vault.mjs'

const CODE_EXT_RE = /\.(ts|tsx|js|jsx|mjs|cjs|py|go|rb|java|php|vue|svelte)$/

function parseComponentPaths(mdContent) {
  const paths = new Set()
  const re = /`([a-zA-Z0-9_./-]+)`/g
  let m
  while ((m = re.exec(mdContent))) {
    if (CODE_EXT_RE.test(m[1])) paths.add(m[1])
  }
  return [...paths]
}

// Fallback legacy: distancia global boveda/ vs primer directorio de código
// con historial. Impreciso, pero mejor que nada cuando ningún Feature doc
// tiene tabla de Componentes parseable.
function legacyRepoWideCheck(cwd) {
  try {
    const bovedaGitPath = getBovedaDir(cwd) || 'boveda'
    const bovedaLog = runGit(cwd, ['log', '--oneline', '-1', '--', `${bovedaGitPath}/`])
    const srcDirs = ['app/', 'lib/', 'src/', 'components/'].filter(d => existsSync(join(cwd, d.replace('/', ''))))
    if (srcDirs.length === 0 || !bovedaLog) return null

    const sourceLog = runGit(cwd, ['log', '--oneline', '-1', '--', ...srcDirs])
    if (!sourceLog) return null

    const bovedaCommit = bovedaLog.split(' ')[0]
    const sourceCommit = sourceLog.split(' ')[0]
    if (bovedaCommit === sourceCommit) return null

    let countStr = '0'
    try { countStr = runGit(cwd, ['rev-list', '--count', `${bovedaCommit}..${sourceCommit}`]) } catch {}
    const count = parseInt(countStr, 10) || 0
    if (count === 0) return null

    return { mode: 'legacy', count, bovedaLog, sourceLog }
  } catch {
    return null
  }
}

// Devuelve { mode: 'per-feature', evaluated, total, stale: [...] }
//       o  { mode: 'legacy', count, bovedaLog, sourceLog }
//       o  null si no hay nada que reportar / no es un repo git.
export function checkStaleness(cwd) {
  if (!existsSync(join(cwd, '.git'))) return null

  const bovedaDir = getBovedaDir(cwd)
  if (!bovedaDir) return null

  const featuresDir = resolveVaultEntry(join(cwd, bovedaDir), '🧩 Features')
  let files = []
  try {
    if (existsSync(featuresDir)) {
      files = readdirSync(featuresDir).filter(f => f.endsWith('.md') && f !== 'Index.md')
    }
  } catch { files = [] }

  const stale = []
  let evaluated = 0

  for (const file of files) {
    const docPath = join(featuresDir, file)
    let content = ''
    try { content = readFileSync(docPath, 'utf-8') } catch { continue }

    const componentPaths = parseComponentPaths(content).filter(p => existsSync(join(cwd, p)))
    if (componentPaths.length === 0) continue // sin tabla de Componentes parseable — no opinamos

    let docLog = ''
    try { docLog = runGit(cwd, ['log', '--oneline', '-1', '--', docPath]) } catch {}
    if (!docLog) continue // el doc nunca se commiteó, no comparable

    let sourceLog = ''
    try { sourceLog = runGit(cwd, ['log', '--oneline', '-1', '--', ...componentPaths]) } catch {}
    if (!sourceLog) continue

    evaluated++

    const docCommit = docLog.split(' ')[0]
    const sourceCommit = sourceLog.split(' ')[0]
    if (docCommit === sourceCommit) continue

    let countStr = '0'
    try { countStr = runGit(cwd, ['rev-list', '--count', `${docCommit}..${sourceCommit}`]) } catch {}
    const count = parseInt(countStr, 10) || 0
    if (count > 0) {
      stale.push({ feature: file.replace('.md', ''), count, docLog, sourceLog })
    }
  }

  if (evaluated > 0) {
    return { mode: 'per-feature', evaluated, total: files.length, stale }
  }

  const legacy = legacyRepoWideCheck(cwd)
  return legacy
}
