// YouMindAG — tests de la capa de enforcement para Claude Code
import { describe, it, before, after } from 'node:test'
import assert from 'node:assert'
import { existsSync, readFileSync, writeFileSync, mkdirSync, rmSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { spawnSync } from 'child_process'
import { mergeClaudeSettings, upgradeClaudeMd, uninstallClaudeLayer } from '../lib/claude.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const TMP = join(process.cwd(), 'test', '__tmp_enforce__')
const GUARD = join(__dirname, '..', 'template', 'scripts', 'ym-hook-guard.mjs')

function reset() {
  rmSync(TMP, { recursive: true, force: true })
  mkdirSync(TMP, { recursive: true })
  writeFileSync(join(TMP, '.youmindag.json'), JSON.stringify({ version: '2.11.0' }))
}

describe('mergeClaudeSettings', () => {
  before(reset)
  after(() => rmSync(TMP, { recursive: true, force: true }))

  it('crea settings.json con los hooks', () => {
    const r = mergeClaudeSettings(TMP)
    assert.ok(r.ok)
    const s = JSON.parse(readFileSync(join(TMP, '.claude', 'settings.json'), 'utf-8'))
    assert.ok(s.hooks.PreToolUse[0].hooks[0].command.includes('ym-hook-guard'))
  })

  it('es idempotente (2ª corrida no duplica)', () => {
    mergeClaudeSettings(TMP)
    const s = JSON.parse(readFileSync(join(TMP, '.claude', 'settings.json'), 'utf-8'))
    assert.strictEqual(s.hooks.PreToolUse.length, 1, 'no debe duplicar entradas')
  })

  it('preserva hooks preexistentes del usuario', () => {
    reset()
    mkdirSync(join(TMP, '.claude'), { recursive: true })
    writeFileSync(join(TMP, '.claude', 'settings.json'), JSON.stringify({
      hooks: { PreToolUse: [{ matcher: 'Bash', hooks: [{ type: 'command', command: 'mi-hook-propio.sh' }] }] },
      permissions: { allow: ['Read'] },
    }))
    mergeClaudeSettings(TMP)
    const s = JSON.parse(readFileSync(join(TMP, '.claude', 'settings.json'), 'utf-8'))
    assert.ok(JSON.stringify(s).includes('mi-hook-propio.sh'), 'hook del usuario preservado')
    assert.ok(JSON.stringify(s).includes('ym-hook-guard'), 'hook youmindag agregado')
    assert.deepStrictEqual(s.permissions.allow, ['Read'], 'permissions preservados')
  })

  it('no toca un settings.json corrupto', () => {
    reset()
    mkdirSync(join(TMP, '.claude'), { recursive: true })
    const corrupt = '{ esto no es json'
    writeFileSync(join(TMP, '.claude', 'settings.json'), corrupt)
    const r = mergeClaudeSettings(TMP)
    assert.strictEqual(r.ok, false)
    assert.strictEqual(readFileSync(join(TMP, '.claude', 'settings.json'), 'utf-8'), corrupt)
  })
})

describe('upgradeClaudeMd', () => {
  before(reset)
  after(() => rmSync(TMP, { recursive: true, force: true }))

  it('crea CLAUDE.md = @AGENTS.md si no existe', () => {
    upgradeClaudeMd(TMP)
    assert.strictEqual(readFileSync(join(TMP, 'CLAUDE.md'), 'utf-8').trim(), '@AGENTS.md')
  })

  it('no duplica si ya referencia AGENTS.md', () => {
    const before = readFileSync(join(TMP, 'CLAUDE.md'), 'utf-8')
    upgradeClaudeMd(TMP)
    assert.strictEqual(readFileSync(join(TMP, 'CLAUDE.md'), 'utf-8'), before)
  })

  it('agrega bloque si CLAUDE.md existe sin la referencia', () => {
    writeFileSync(join(TMP, 'CLAUDE.md'), '# Mis reglas\nfoo\n')
    upgradeClaudeMd(TMP)
    const c = readFileSync(join(TMP, 'CLAUDE.md'), 'utf-8')
    assert.ok(c.includes('# Mis reglas'), 'preserva contenido del usuario')
    assert.ok(c.includes('@AGENTS.md'), 'agrega la referencia')
  })
})

describe('uninstallClaudeLayer', () => {
  it('retira solo las entradas youmindag', () => {
    reset()
    mkdirSync(join(TMP, '.claude'), { recursive: true })
    writeFileSync(join(TMP, '.claude', 'settings.json'), JSON.stringify({
      hooks: { PreToolUse: [{ matcher: 'Bash', hooks: [{ type: 'command', command: 'mi-hook.sh' }] }] },
    }))
    mergeClaudeSettings(TMP)
    uninstallClaudeLayer(TMP)
    const s = JSON.parse(readFileSync(join(TMP, '.claude', 'settings.json'), 'utf-8'))
    assert.ok(JSON.stringify(s).includes('mi-hook.sh'), 'hook del usuario permanece')
    assert.ok(!JSON.stringify(s).includes('ym-hook'), 'hooks youmindag retirados')
    rmSync(TMP, { recursive: true, force: true })
  })
})

describe('ym-hook-guard (end-to-end)', () => {
  function runGuard(input, env = {}) {
    return spawnSync(process.execPath, [GUARD], {
      input: typeof input === 'string' ? input : JSON.stringify(input),
      encoding: 'utf-8',
      env: { ...process.env, ...env },
      cwd: process.cwd(),
    })
  }

  it('bloquea grep -r en modo block (exit 2)', () => {
    const dir = join(process.cwd(), 'test', '__tmp_guard_block__')
    rmSync(dir, { recursive: true, force: true }); mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, '.youmindag.json'), JSON.stringify({ guard: 'block' }))
    const r = spawnSync(process.execPath, [GUARD], {
      input: JSON.stringify({ tool_name: 'Bash', tool_input: { command: 'grep -r foo src/' } }),
      encoding: 'utf-8', cwd: dir,
    })
    assert.strictEqual(r.status, 2)
    assert.ok(r.stderr.includes('youmindag'))
    rmSync(dir, { recursive: true, force: true })
  })

  it('permite con YM_NO_GUARD=1 (exit 0)', () => {
    const r = runGuard({ tool_name: 'Bash', tool_input: { command: 'grep -r foo src/' } }, { YM_NO_GUARD: '1' })
    assert.strictEqual(r.status, 0)
  })

  it('permite comandos de youmindag (allowlist)', () => {
    const r = runGuard({ tool_name: 'Bash', tool_input: { command: 'npx youmindag references foo' } })
    assert.strictEqual(r.status, 0)
  })

  it('fail-open ante stdin malformado (exit 0)', () => {
    const r = runGuard('esto no es json')
    assert.strictEqual(r.status, 0)
  })

  it('ignora herramientas que no son Bash (exit 0)', () => {
    const r = runGuard({ tool_name: 'Read', tool_input: { file_path: 'x' } })
    assert.strictEqual(r.status, 0)
  })
})
