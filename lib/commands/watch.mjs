// YouMindAG — CLI commands
import { existsSync, readFileSync, writeFileSync, readdirSync } from 'fs'
import { join } from 'path'
import { RESET, CYAN, GREEN, YELLOW, BOLD } from '../utils.mjs'


export function cmdWatch(cwd, args) {
  console.log(`${CYAN}${BOLD}YouMindAG — Watch mode${RESET}\n`)

  const usePoll = args.includes('--poll')
  let watchTimer = null
  const DEBOUNCE_MS = 500
  const watchers = new Map()

  function closeWatcher(path) {
    if (watchers.has(path)) {
      try { watchers.get(path).close() } catch {}
      watchers.delete(path)
    }
  }

  function onChange() {
    if (watchTimer) clearTimeout(watchTimer)
    watchTimer = setTimeout(() => {
      watchTimer = null
      console.log(`  ${YELLOW}📝 Cambio detectado — repoblando bóveda...${RESET}`)
      populateVaultFiles(cwd)
    }, DEBOUNCE_MS)
  }

  function watchDirTree(dir) {
    if (watchers.has(dir)) return
    try {
      const w = watch(dir, (eventType, filename) => {
        if (eventType === 'rename' && filename) {
          const fullPath = join(dir, filename)
          if (existsSync(fullPath)) {
            try {
              if (statSync(fullPath).isDirectory()) watchDirTree(fullPath)
            } catch {}
          } else {
            closeWatcher(fullPath)
          }
        }
        onChange()
      })
      watchers.set(dir, w)
      const entries = readdirSync(dir, { withFileTypes: true })
      for (const e of entries) {
        if (e.isDirectory() && !e.name.startsWith('.') && e.name !== 'node_modules') {
          watchDirTree(join(dir, e.name))
        }
      }
    } catch {}
  }

  const targets = [
    join(cwd, 'package.json'),
    join(cwd, '.env'),
    join(cwd, '.env.example'),
    join(cwd, 'middleware.ts'),
    join(cwd, 'src', 'middleware.ts'),
    join(cwd, 'auth.ts'),
    join(cwd, 'src', 'auth.ts'),
  ]

  for (const t of targets) {
    if (existsSync(t)) watch(t, () => onChange())
  }

  const srcDirs = ['src', 'app', 'lib', 'pages', 'actions']
  for (const dir of srcDirs) {
    const full = join(cwd, dir)
    if (existsSync(full)) watchDirTree(full)
  }

  console.log(`  ${CYAN}👀 Observando cambios en archivos del proyecto...`)
  console.log(`  ${CYAN}   Presiona Ctrl+C para detener.${RESET}\n`)

  if (usePoll) {
    console.log(`  ${YELLOW}ℹ️  Polling activo cada 2s${RESET}\n`)
  }

  process.on('SIGINT', () => {
    console.log(`\n  ${CYAN}👋 Watch mode detenido.${RESET}\n`)
    process.exit(0)
  })
}

// ─── youmindag sync ──────────────────────────────────────────────
