// YouMindAG — tests de staleness por feature (lib/staleness.mjs)
import { describe, it, before, after } from 'node:test'
import assert from 'node:assert'
import { existsSync, mkdirSync, writeFileSync, rmSync } from 'fs'
import { join } from 'path'
import { execFileSync } from 'child_process'
import { checkStaleness } from '../lib/staleness.mjs'

const TMP = join(process.cwd(), 'test', '__tmp_staleness__')

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

describe('checkStaleness — per-feature', () => {
  before(() => {
    rmSync(TMP, { recursive: true, force: true })
    mkdirSync(TMP, { recursive: true })
    initRepo(TMP)

    mkdirSync(join(TMP, 'lib', 'test'), { recursive: true })
    mkdirSync(join(TMP, 'boveda', '🧩 Features'), { recursive: true })

    writeFileSync(join(TMP, 'lib', 'test', 'foo.ts'), 'export const foo = 1\n')
    writeFileSync(join(TMP, 'boveda', '🧩 Features', 'Test.md'), [
      '# Test — feature de prueba',
      '',
      '## Componentes',
      '',
      '| Archivo | Rol |',
      '|---------|-----|',
      '| `lib/test/foo.ts` | hace foo |',
      '',
    ].join('\n'))
    writeFileSync(join(TMP, '.youmindag.json'), JSON.stringify({ version: '2.11.3', bovedaDir: 'boveda' }))

    commit(TMP, 'initial: doc y código juntos')
  })

  after(() => rmSync(TMP, { recursive: true, force: true }))

  it('no marca stale si el doc y el código se commitearon juntos', () => {
    const r = checkStaleness(TMP)
    assert.strictEqual(r.mode, 'per-feature')
    assert.strictEqual(r.evaluated, 1)
    assert.deepStrictEqual(r.stale, [])
  })

  it('marca stale el feature cuyo código cambió después que su doc', () => {
    writeFileSync(join(TMP, 'lib', 'test', 'foo.ts'), 'export const foo = 2 // cambio real\n')
    commit(TMP, 'cambio en foo.ts, sin tocar boveda')

    const r = checkStaleness(TMP)
    assert.strictEqual(r.mode, 'per-feature')
    assert.strictEqual(r.stale.length, 1)
    assert.strictEqual(r.stale[0].feature, 'Test')
    assert.ok(r.stale[0].count >= 1)
  })

  it('deja de estar stale si se actualiza el doc también', () => {
    writeFileSync(join(TMP, 'boveda', '🧩 Features', 'Test.md'), [
      '# Test — feature de prueba (actualizado)',
      '',
      '## Componentes',
      '',
      '| Archivo | Rol |',
      '|---------|-----|',
      '| `lib/test/foo.ts` | hace foo, ahora vale 2 |',
      '',
    ].join('\n'))
    commit(TMP, 'actualiza doc tras el cambio real')

    const r = checkStaleness(TMP)
    assert.strictEqual(r.stale.length, 0, 'tras actualizar el doc no debe quedar stale')
  })

  it('no revienta con commits de otro feature no relacionado', () => {
    mkdirSync(join(TMP, 'lib', 'otro'), { recursive: true })
    writeFileSync(join(TMP, 'lib', 'otro', 'bar.ts'), 'export const bar = 1\n')
    commit(TMP, 'agrega módulo no documentado')

    const r = checkStaleness(TMP)
    assert.strictEqual(r.stale.length, 0, 'cambios fuera de los archivos documentados no deben marcar stale')
  })
})

describe('checkStaleness — fallback legacy', () => {
  const dir = join(process.cwd(), 'test', '__tmp_staleness_legacy__')

  before(() => {
    rmSync(dir, { recursive: true, force: true })
    mkdirSync(dir, { recursive: true })
    initRepo(dir)

    mkdirSync(join(dir, 'lib'), { recursive: true })
    mkdirSync(join(dir, 'boveda', '🧩 Features'), { recursive: true })
    writeFileSync(join(dir, 'lib', 'algo.ts'), 'export const x = 1\n')
    // Feature doc SIN tabla de Componentes parseable
    writeFileSync(join(dir, 'boveda', '🧩 Features', 'SinTabla.md'), '# SinTabla\n\nSolo prosa, sin tabla de archivos.\n')
    writeFileSync(join(dir, '.youmindag.json'), JSON.stringify({ version: '2.11.3', bovedaDir: 'boveda' }))
    commit(dir, 'initial')
  })

  after(() => rmSync(dir, { recursive: true, force: true }))

  it('cae a legacy (repo-global) cuando ningún doc es evaluable', () => {
    writeFileSync(join(dir, 'lib', 'algo.ts'), 'export const x = 2\n')
    commit(dir, 'cambio en lib sin evaluable')

    const r = checkStaleness(dir)
    assert.ok(r === null || r.mode === 'legacy', 'sin docs evaluables debe ser null o legacy')
  })
})

describe('checkStaleness — casos límite', () => {
  it('devuelve null fuera de un repo git', () => {
    const dir = join(process.cwd(), 'test', '__tmp_staleness_nogit__')
    rmSync(dir, { recursive: true, force: true })
    mkdirSync(dir, { recursive: true })
    const r = checkStaleness(dir)
    assert.strictEqual(r, null)
    rmSync(dir, { recursive: true, force: true })
  })

  it('devuelve null sin bóveda instalada', () => {
    const dir = join(process.cwd(), 'test', '__tmp_staleness_noboveda__')
    rmSync(dir, { recursive: true, force: true })
    mkdirSync(dir, { recursive: true })
    initRepo(dir)
    writeFileSync(join(dir, 'readme.md'), 'x')
    commit(dir, 'x')
    const r = checkStaleness(dir)
    assert.strictEqual(r, null)
    rmSync(dir, { recursive: true, force: true })
  })
})
