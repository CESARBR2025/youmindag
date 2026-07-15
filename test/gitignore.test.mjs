// YouMindAG — gitignore tests (ensureGitignoreEntries idempotent, Bug 1 regression)

import { describe, it, before, after } from 'node:test'
import assert from 'node:assert'
import { mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from 'fs'
import { join } from 'path'
import { ensureGitignoreEntries } from '../lib/gitignore.mjs'

const TMP = join(process.cwd(), 'test', '__tmp_gitignore__')

function setup(content) {
  if (existsSync(TMP)) rmSync(TMP, { recursive: true, force: true })
  mkdirSync(TMP, { recursive: true })
  if (content !== undefined) writeFileSync(join(TMP, '.gitignore'), content)
}

function read() {
  return readFileSync(join(TMP, '.gitignore'), 'utf-8')
}

function cleanup() {
  if (existsSync(TMP)) rmSync(TMP, { recursive: true, force: true })
}

describe('ensureGitignoreEntries', () => {
  after(cleanup)

  it('crea .gitignore con entradas si no existe', () => {
    setup(undefined)
    ensureGitignoreEntries(TMP)
    const content = read()
    assert.ok(content.includes('.graphify/'))
    assert.ok(content.includes('graphify-visual/'))
    assert.ok(content.includes('# YouMindAG — generated knowledge graph'))
  })

  it('agrega entradas si faltan en .gitignore existente', () => {
    setup('node_modules/\n')
    ensureGitignoreEntries(TMP)
    const content = read()
    assert.ok(content.includes('node_modules/'))
    assert.ok(content.includes('.graphify/'))
    assert.ok(content.includes('graphify-visual/'))
  })

  it('Bug 1: doble ejecución no duplica entradas', () => {
    setup('')
    ensureGitignoreEntries(TMP)
    ensureGitignoreEntries(TMP)
    const content = read()
    const graphifyCount = content.split('\n').filter(l => l.trim() === '.graphify/').length
    const visualCount = content.split('\n').filter(l => l.trim() === 'graphify-visual/').length
    assert.strictEqual(graphifyCount, 1)
    assert.strictEqual(visualCount, 1)
  })

  it('Bug 1: triple ejecución no duplica entradas', () => {
    setup('node_modules/\n.env\n')
    ensureGitignoreEntries(TMP)
    ensureGitignoreEntries(TMP)
    ensureGitignoreEntries(TMP)
    const content = read()
    const graphifyCount = content.split('\n').filter(l => l.trim() === '.graphify/').length
    assert.strictEqual(graphifyCount, 1)
  })

  it('no elimina otras entradas del usuario', () => {
    setup('node_modules/\n.env\n')
    ensureGitignoreEntries(TMP)
    const content = read()
    assert.ok(content.includes('node_modules/'))
    assert.ok(content.includes('.env'))
  })

  it('limpia entradas viejas dispersas y las reemplaza', () => {
    setup('node_modules/\n.graphify/\ngraphify-visual/\n# YouMindAG — old comment\n.env\n')
    ensureGitignoreEntries(TMP)
    const content = read()
    assert.ok(content.includes('node_modules/'))
    assert.ok(content.includes('.env'))
    // Solo una aparición de cada entrada
    const graphifyCount = content.split('\n').filter(l => l.trim() === '.graphify/').length
    // No debería tener "old comment"
    assert.ok(!content.includes('old comment'))
  })
})
