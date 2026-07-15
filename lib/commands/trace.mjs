// YouMindAG — CLI commands
import { existsSync, readFileSync, writeFileSync, readdirSync, mkdirSync } from 'fs'
import { join } from 'path'
import { execSync } from 'child_process'
import { RESET, CYAN, GREEN, YELLOW, BOLD } from '../utils.mjs'


export async function cmdTrace(cwd, args) {
  const isClient = args.includes('--client')
  const isServer = args.includes('--server')
  const scriptName = isClient ? 'trace-client.mjs' : isServer ? 'trace-server.mjs' : 'trace-components.mjs'
  const scriptPath = join(cwd, 'scripts', scriptName)

  if (!existsSync(scriptPath)) {
    console.error(`${YELLOW}Error: scripts/${scriptName} no encontrado${RESET}`)
    console.error(`${YELLOW}   Ejecuta npx youmindag primero para instalar los scripts.${RESET}`)
    process.exit(1)
  }

  const filteredArgs = args.filter(a => a !== '--server' && a !== '--client')
  try {
    execSync(`node "${scriptPath}" ${filteredArgs.join(' ')}`, { cwd, stdio: 'inherit' })
  } catch {
    process.exit(1)
  }
}
