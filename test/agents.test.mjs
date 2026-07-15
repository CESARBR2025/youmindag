// YouMindAG — agents tests (upgradeAgentsMd, mergeContextMap)

import { describe, it, before, after } from 'node:test'
import assert from 'node:assert'
import { mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from 'fs'
import { join } from 'path'
import { upgradeAgentsMd, mergeContextMap } from '../lib/agents.mjs'

const TMP = join(process.cwd(), 'test', '__tmp_agents__')

function setup(agentsContent, contextMapContent) {
  if (existsSync(TMP)) rmSync(TMP, { recursive: true, force: true })
  mkdirSync(TMP, { recursive: true })
  // Template dir
  const templateDir = join(TMP, 'template')
  mkdirSync(templateDir, { recursive: true })
  writeFileSync(join(templateDir, 'AGENTS.md'), [
    '# Some user content',
    '<!-- BEGIN:youmindag -->',
    '# NUEVAS REGLAS DE ORO v2',
    '1. Regla nueva A',
    '2. Regla nueva B',
    '<!-- END:youmindag -->',
    '# More user content',
  ].join('\n'))

  mkdirSync(join(templateDir, '.opencode'), { recursive: true })
  writeFileSync(join(templateDir, '.opencode', 'context-map.yaml'), [
    'projects:',
    '  - name: example',
    '    path: lib/example',
  ].join('\n'))

  if (agentsContent !== undefined) writeFileSync(join(TMP, 'AGENTS.md'), agentsContent)
  if (contextMapContent !== undefined) {
    mkdirSync(join(TMP, '.opencode'), { recursive: true })
    writeFileSync(join(TMP, '.opencode', 'context-map.yaml'), contextMapContent)
  } else mkdirSync(join(TMP, '.opencode'), { recursive: true })
}

function cleanup() {
  if (existsSync(TMP)) rmSync(TMP, { recursive: true, force: true })
}

const templateDir = join(TMP, 'template')

describe('upgradeAgentsMd', () => {
  after(cleanup)

  it('crea AGENTS.md si no existe', () => {
    setup(undefined)
    const result = upgradeAgentsMd(TMP, templateDir)
    assert.strictEqual(result, 'creado (no existía)')
    assert.ok(existsSync(join(TMP, 'AGENTS.md')))
  })

  it('preserva contenido usuario en upgrade (merge por markers)', () => {
    const userContent = [
      '<!-- BEGIN:youmindag -->',
      '# REGLAS VIEJAS',
      '1. Regla vieja',
      '<!-- END:youmindag -->',
      '# Mi contenido personal',
    ].join('\n')
    setup(userContent)
    const result = upgradeAgentsMd(TMP, templateDir)
    assert.strictEqual(result, 'actualizado (merge)')
    const content = readFileSync(join(TMP, 'AGENTS.md'), 'utf-8')
    // Contenido personal preservado
    assert.ok(content.includes('Mi contenido personal'))
    // Contenido nuevo inyectado
    assert.ok(content.includes('NUEVAS REGLAS DE ORO v2'))
    assert.ok(content.includes('Regla nueva A'))
  })

  it('reemplazo total si no tiene markers', () => {
    const userContent = '# Just some file'
    setup(userContent)
    const result = upgradeAgentsMd(TMP, templateDir)
    assert.ok(result.includes('actualizado'))
    const content = readFileSync(join(TMP, 'AGENTS.md'), 'utf-8')
    assert.ok(content.includes('NUEVAS REGLAS DE ORO v2'))
  })
})

describe('mergeContextMap', () => {
  after(cleanup)

  it('crea context-map.yaml si no existe', () => {
    setup('', undefined)
    const result = mergeContextMap(TMP, templateDir)
    assert.strictEqual(result, 'creado (no existía)')
    assert.ok(existsSync(join(TMP, '.opencode', 'context-map.yaml')))
  })

  it('preserva entradas existentes', () => {
    const userMap = [
      'projects:',
      '  - name: my-proj',
      '    path: lib/my-proj',
      '  - name: another',
      '    path: lib/another',
      '  - name: third',
      '    path: lib/third',
      '',
    ].join('\n')
    setup('', userMap)
    const result = mergeContextMap(TMP, templateDir)
    assert.strictEqual(result, 'sin cambios (preservado)')
    const content = readFileSync(join(TMP, '.opencode', 'context-map.yaml'), 'utf-8')
    assert.ok(content.includes('my-proj'))
    assert.ok(content.includes('another'))
  })
})
