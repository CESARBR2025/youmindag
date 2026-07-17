// YouMindAG — tests de los hooks que cierran el hueco de staleness narrativa:
// ym-hook-session-start.mjs (muestra features stale al iniciar sesión) y
// ym-hook-posttool.mjs (nudge al editar un archivo documentado).
import { describe, it, before, after } from 'node:test'
import assert from 'node:assert'
import { existsSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { execFileSync, spawnSync } from 'child_process'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SESSION_START = join(__dirname, '..', 'template', 'scripts', 'ym-hook-session-start.mjs')
const POSTTOOL = join(__dirname, '..', 'template', 'scripts', 'ym-hook-posttool.mjs')

function git(cwd, args) {
  return execFileSync('git', args, { cwd, encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] })
}

function initRepo(cwd) {
  git(cwd, ['init', '-q'])
  git(cwd, ['config', 'user.email', 'test@example.com'])
  git(cwd, ['config', 'user.name', 'Test'])
  git(cwd, ['config', 'commit.gpgsign', 'false'])
}

function commit(cwd, msg) {
  git(cwd, ['add', '-A'])
  git(cwd, ['commit', '-q', '-m', msg])
}

function setupProject(dir) {
  rmSync(dir, { recursive: true, force: true })
  mkdirSync(dir, { recursive: true })
  initRepo(dir)

  mkdirSync(join(dir, 'lib', 'test'), { recursive: true })
  mkdirSync(join(dir, 'boveda', '🧩 Features'), { recursive: true })

  writeFileSync(join(dir, 'lib', 'test', 'foo.ts'), 'export const foo = 1\n')
  writeFileSync(join(dir, 'boveda', '🧩 Features', 'Test.md'), [
    '# Test — feature de prueba',
    '',
    '## Componentes',
    '',
    '| Archivo | Rol |',
    '|---------|-----|',
    '| `lib/test/foo.ts` | hace foo |',
    '',
  ].join('\n'))
  writeFileSync(join(dir, '.youmindag.json'), JSON.stringify({ version: '2.11.4', bovedaDir: 'boveda' }))

  commit(dir, 'initial: doc y código juntos')
}

function runSessionStart(cwd) {
  return spawnSync(process.execPath, [SESSION_START], { cwd, encoding: 'utf-8' })
}

function runPostTool(cwd, filePath, toolName = 'Edit') {
  return spawnSync(process.execPath, [POSTTOOL], {
    input: JSON.stringify({ tool_name: toolName, tool_input: { file_path: filePath } }),
    encoding: 'utf-8',
    cwd,
  })
}

describe('ym-hook-session-start — staleness por feature', () => {
  const dir = join(process.cwd(), 'test', '__tmp_ss_staleness__')

  before(() => setupProject(dir))
  after(() => rmSync(dir, { recursive: true, force: true }))

  it('no menciona features stale si doc y código están al día', () => {
    const r = runSessionStart(dir)
    assert.strictEqual(r.status, 0)
    assert.ok(!r.stdout.includes('posiblemente desactualizados'))
  })

  it('menciona el feature cuando el código cambia después que el doc', () => {
    writeFileSync(join(dir, 'lib', 'test', 'foo.ts'), 'export const foo = 2\n')
    commit(dir, 'cambio en foo.ts sin tocar boveda')

    const r = runSessionStart(dir)
    assert.strictEqual(r.status, 0)
    assert.ok(r.stdout.includes('Features posiblemente desactualizados'))
    assert.ok(r.stdout.includes('Test'))
  })

  it('sigue mostrando el resto del resumen aunque haya staleness', () => {
    const r = runSessionStart(dir)
    assert.ok(r.stdout.includes('Módulos documentados'))
    assert.ok(r.stdout.includes('Protocolo:'))
  })
})

describe('ym-hook-posttool — nudge de doc al editar archivo documentado', () => {
  const dir = join(process.cwd(), 'test', '__tmp_pt_nudge__')

  before(() => setupProject(dir))
  after(() => rmSync(dir, { recursive: true, force: true }))

  it('avisa la primera vez que se edita un archivo documentado', () => {
    const r = runPostTool(dir, 'lib/test/foo.ts')
    assert.strictEqual(r.status, 0)
    assert.ok(r.stdout.includes('YouMindAG'))
    assert.ok(r.stdout.includes('Test.md'))
    assert.ok(r.stdout.includes('lib/test/foo.ts'))
  })

  it('respeta el cooldown — no repite el aviso del mismo feature', () => {
    const r = runPostTool(dir, 'lib/test/foo.ts')
    assert.strictEqual(r.status, 0)
    assert.strictEqual(r.stdout, '')
  })

  it('no avisa nada para un archivo que ningún doc menciona', () => {
    mkdirSync(join(dir, 'lib', 'otro'), { recursive: true })
    writeFileSync(join(dir, 'lib', 'otro', 'bar.ts'), 'export const bar = 1\n')
    const r = runPostTool(dir, 'lib/otro/bar.ts')
    assert.strictEqual(r.status, 0)
    assert.strictEqual(r.stdout, '')
  })

  it('no avisa para NotebookEdit (campo de ruta no verificado, alcance reducido)', () => {
    const r = runPostTool(dir, 'lib/test/foo.ts', 'NotebookEdit')
    assert.strictEqual(r.status, 0)
    assert.strictEqual(r.stdout, '')
  })

  it('sigue contando ediciones para el auto-sync en paralelo al nudge', () => {
    const stateBefore = JSON.parse(readFileSync(join(dir, '.youmindag', 'plugin-state.json'), 'utf-8'))
    const countBefore = Number(stateBefore.ymEditCount) || 0
    runPostTool(dir, 'lib/otro/bar.ts')
    const stateAfter = JSON.parse(readFileSync(join(dir, '.youmindag', 'plugin-state.json'), 'utf-8'))
    assert.strictEqual(stateAfter.ymEditCount, countBefore + 1)
  })

  it('sin tool_input.file_path no rompe nada (fail-open)', () => {
    const r = spawnSync(process.execPath, [POSTTOOL], {
      input: JSON.stringify({ tool_name: 'Edit', tool_input: {} }),
      encoding: 'utf-8',
      cwd: dir,
    })
    assert.strictEqual(r.status, 0)
    assert.strictEqual(r.stdout, '')
  })

  it('un nuevo feature con cooldown vencido vuelve a avisar', () => {
    mkdirSync(join(dir, '.youmindag'), { recursive: true })
    const statePath = join(dir, '.youmindag', 'plugin-state.json')
    const state = JSON.parse(readFileSync(statePath, 'utf-8'))
    state.ymDocNudge = state.ymDocNudge || {}
    state.ymDocNudge['Test'] = Date.now() - 31 * 60 * 1000 // hace 31 min, vencido
    writeFileSync(statePath, JSON.stringify(state, null, 2) + '\n')

    const r = runPostTool(dir, 'lib/test/foo.ts')
    assert.ok(r.stdout.includes('Test.md'), 'con el cooldown vencido debe volver a avisar')
  })
})
