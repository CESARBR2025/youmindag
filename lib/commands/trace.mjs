// YouMindAG — CLI commands
import { existsSync } from 'fs'
import { join } from 'path'
import { RESET, YELLOW } from '../utils.mjs'
import { runNode } from '../exec.mjs'


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
    runNode(cwd, scriptPath, filteredArgs, { stdio: 'inherit' })
  } catch {
    process.exit(1)
  }
}
