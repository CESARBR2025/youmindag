// YouMindAG — ejecución segura de procesos externos.
// Siempre execFileSync con array de args (sin shell): el input del usuario
// jamás se interpola en una cadena de comando.

import { execFileSync } from 'child_process'

export function npxBin() {
  return process.platform === 'win32' ? 'npx.cmd' : 'npx'
}

export function runGraphify(cwd, args, opts = {}) {
  return String(execFileSync(npxBin(), ['graphify', ...args], {
    cwd,
    stdio: ['ignore', 'pipe', 'ignore'],
    encoding: 'utf-8',
    timeout: 15000,
    ...opts,
  }))
}

export function runNode(cwd, scriptPath, args = [], opts = {}) {
  return execFileSync(process.execPath, [scriptPath, ...args], { cwd, ...opts })
}

// git sin shell. Lanza si el comando falla (código != 0); envolver en try/catch.
export function runGit(cwd, args, opts = {}) {
  return String(execFileSync('git', args, {
    cwd,
    encoding: 'utf-8',
    stdio: ['ignore', 'pipe', 'ignore'],
    ...opts,
  })).trim()
}
