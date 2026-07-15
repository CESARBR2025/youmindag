// YouMindAG — CLI commands
import { existsSync, readFileSync, writeFileSync, readdirSync, mkdirSync, openSync, closeSync, appendFileSync } from 'fs'
import { join, dirname } from 'path'
import { execSync, spawn } from 'child_process'
import { RESET, CYAN, GREEN, YELLOW, BOLD } from '../utils.mjs'
import { getBovedaDir, readYoumindagVersion, readYoumindagData, writeYoumindagData, YOUMINDAG_JSON } from '../vault.mjs'
import { maybeWriteFile, maybeCopyFile, maybeCopyDir, maybeRmSync, getDryRun } from '../fs-helpers.mjs'


export function isDevScriptWrapped(cwd) {
  try {
    const pkg = JSON.parse(readFileSync(join(cwd, 'package.json'), 'utf-8'))
    return (pkg.scripts?.dev || '').startsWith('node scripts/ym-dev.mjs')
  } catch { return false }
}

export function wrapDevScript(cwd) {
  const pkgPath = join(cwd, 'package.json')
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'))
  const original = pkg.scripts?.dev
  if (!original) {
    console.log(`  ${YELLOW}⚠️  No se encontró un script "dev" en package.json${RESET}\n`)
    return false
  }
  if (original.startsWith('node scripts/ym-dev.mjs')) {
    console.log(`  ${YELLOW}⚠️  El dev script ya está envuelto${RESET}\n`)
    return false
  }

  mkdirSync(join(cwd, '.youmindag'), { recursive: true })
  writeFileSync(join(cwd, '.youmindag', 'dev-original.txt'), original + '\n')
  pkg.scripts.dev = 'node scripts/ym-dev.mjs'
  writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n')
  console.log(`  ${GREEN}✅ Dev script envuelto${RESET}`)
  console.log(`  ${CYAN}   Original: ${original}${RESET}`)
  console.log(`  ${CYAN}   Los logs se capturarán automáticamente en .youmindag/dev.log${RESET}\n`)
  return true
}

export function unwrapDevScript(cwd) {
  const origPath = join(cwd, '.youmindag', 'dev-original.txt')
  if (!existsSync(origPath)) {
    console.log(`  ${YELLOW}⚠️  No hay dev script envuelto (falta .youmindag/dev-original.txt)${RESET}\n`)
    return false
  }

  const pkgPath = join(cwd, 'package.json')
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'))
  const original = readFileSync(origPath, 'utf-8').trim()

  pkg.scripts.dev = original
  writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n')
  try { execSync(`rm "${origPath}"`, { cwd }) } catch {}
  console.log(`  ${GREEN}✅ Dev script restaurado${RESET}`)
  console.log(`  ${CYAN}   Script: ${original}${RESET}\n`)
  return true
}

// ─── youmindag dev ──────────────────────────────────────────────


export function findDevProcess(cwd) {
  try {
    const out = String(execSync('pgrep -f "next dev" 2>/dev/null || true', { cwd, encoding: 'utf-8' })).trim()
    if (out) {
      const pids = out.split('\n').filter(Boolean)
      return pids[0]
    }
  } catch {}
  return null
}

export function cmdDev(cwd, args) {
  const showStatus = args.includes('--status')
  const doRestart = args.includes('--restart')
  const showLogs = args.includes('--logs')
  const doWrap = args.includes('--wrap')
  const doUnwrap = args.includes('--unwrap')
  const logFile = join(cwd, '.youmindag', 'dev.log')

  if (doWrap) return wrapDevScript(cwd)
  if (doUnwrap) return unwrapDevScript(cwd)

  if (!showStatus && !doRestart && !showLogs) {
    console.log(`${YELLOW}Uso: youmindag dev --status | --restart | --logs${RESET}\n`)
    return
  }

  if (showLogs) {
    if (!existsSync(logFile)) {
      const runningPid = findDevProcess(cwd)
      if (runningPid) {
        console.log(`${YELLOW}⚠️  next dev está corriendo (PID ${runningPid}) pero no fue iniciado por youmindag.${RESET}`)
        console.log(`${YELLOW}   Usa youmindag dev --restart para capturar los logs automáticamente.${RESET}\n`)
      } else {
        console.log(`${YELLOW}No hay logs disponibles. Inicia el dev server con --restart primero.${RESET}\n`)
      }
      return
    }
    const lines = readFileSync(logFile, 'utf-8').split('\n')
    const tail = lines.slice(-30).join('\n')
    console.log(`${CYAN}── Dev server logs (últimas 30 líneas) ──${RESET}\n`)
    console.log(tail || '(vacío)')
    console.log()
    return
  }

  const data = readYoumindagData(cwd)

  if (showStatus) {
    const pid = data.devPid || findDevProcess(cwd)
    if (!pid) {
      console.log(`${YELLOW}No hay dev server corriendo. Usa --restart para iniciarlo.${RESET}\n`)
      return
    }

    const alive = findDevProcess(cwd) || pid
    let uptime = '?'
    if (alive && data.devStartedAt) {
      uptime = Math.floor((Date.now() - new Date(data.devStartedAt).getTime()) / 1000 / 60)
    }

    console.log(`${GREEN}✅ Dev server corriendo (PID ${alive})${RESET}`)
    console.log(`${GREEN}   Uptime: ~${uptime} min${RESET}`)
    if (data.devPid) {
      console.log(`${GREEN}   Logs: ${logFile}${RESET}`)
    } else {
      console.log(`${YELLOW}   Logs: no disponibles (inicia con --restart para capturarlos)${RESET}`)
    }
    const isWrapped = isDevScriptWrapped(cwd)
    console.log(`${isWrapped ? GREEN : YELLOW}   Dev script: ${isWrapped ? 'envuelto (logs automáticos)' : 'no envuelto (youmindag dev --wrap)'}${RESET}`)
    console.log()
    return
  }

  if (doRestart) {
    const existingPid = data.devPid || findDevProcess(cwd)
    if (existingPid) {
      try {
        execSync(`kill -TERM ${existingPid} 2>/dev/null || true`, { cwd })
        console.log(`${YELLOW}🔪 Dev server anterior detenido (PID ${existingPid})${RESET}`)
      } catch {}
      try { execSync(`kill -9 ${existingPid} 2>/dev/null || true`, { cwd }) } catch {}
    }

    mkdirSync(dirname(logFile), { recursive: true })
    const logFd = openSync(logFile, 'w')
    closeSync(logFd)

    const pkg = existsSync(join(cwd, 'package.json'))
      ? JSON.parse(readFileSync(join(cwd, 'package.json'), 'utf-8'))
      : {}

    const devCmd = pkg.scripts?.dev || 'next dev'

    console.log(`${CYAN}🚀 Iniciando: npm run dev${RESET}`)
    console.log(`${CYAN}   Logs: ${logFile}${RESET}\n`)

    const child = spawn('npx', devCmd.split(' '), {
      cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env },
      detached: true,
    })

    const logStream = (stream) => {
      let buffer = ''
      stream.on('data', (chunk) => {
        buffer += chunk.toString()
        const lines = buffer.split('\n')
        buffer = lines.pop()
        for (const line of lines) {
          appendFileSync(logFile, `[${new Date().toISOString().slice(11, 19)}] ${line}\n`)
        }
      })
      stream.on('end', () => {
        if (buffer) appendFileSync(logFile, `[${new Date().toISOString().slice(11, 19)}] ${buffer}\n`)
      })
    }

    logStream(child.stdout)
    logStream(child.stderr)

    data.devPid = child.pid
    data.devStartedAt = new Date().toISOString()
    writeYoumindagData(cwd, data)

    child.unref()

    setTimeout(() => {
      console.log(`${GREEN}✅ Dev server iniciado (PID ${child.pid})${RESET}`)
      console.log(`${GREEN}   Logs: ${logFile}${RESET}`)
      console.log(`${CYAN}   youmindag dev --logs para ver la salida${RESET}\n`)
    }, 2000)
  }
}

// ─── youmindag watch ────────────────────────────────────────────
