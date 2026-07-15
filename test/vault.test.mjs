// YouMindAG — vault tests (getBovedaDir)

import { describe, it, before, after } from 'node:test'
import assert from 'node:assert'
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'fs'
import { join } from 'path'
import { getBovedaDir, YOUMINDAG_JSON } from '../lib/vault.mjs'

const TMP = join(process.cwd(), 'test', '__tmp_vault__')

function setup(files) {
  if (existsSync(TMP)) rmSync(TMP, { recursive: true, force: true })
  mkdirSync(TMP, { recursive: true })
  for (const [name, content] of Object.entries(files)) {
    const p = join(TMP, name)
    mkdirSync(join(p, '..'), { recursive: true })
    if (content !== '__DIR__') writeFileSync(p, content || '')
    else mkdirSync(p, { recursive: true })
  }
}

function cleanup() {
  if (existsSync(TMP)) rmSync(TMP, { recursive: true, force: true })
}

describe('getBovedaDir', () => {
  after(cleanup)

  it('lee desde .youmindag.json', () => {
    setup({
      [YOUMINDAG_JSON]: JSON.stringify({ version: '2.7.0', bovedaDir: 'boveda-mi-proyecto' }),
      'boveda-mi-proyecto/': '__DIR__'
    })
    assert.strictEqual(getBovedaDir(TMP), 'boveda-mi-proyecto')
  })

  it('ignora .youmindag.json si el directorio no existe', () => {
    setup({
      [YOUMINDAG_JSON]: JSON.stringify({ version: '2.7.0', bovedaDir: 'boveda-fantasma' }),
    })
    // Falls through to scan
    assert.strictEqual(getBovedaDir(TMP), null)
  })

  it('fallback: scan de boveda-*', () => {
    setup({
      'boveda-seguridad-publica/': '__DIR__'
    })
    assert.strictEqual(getBovedaDir(TMP), 'boveda-seguridad-publica')
  })

  it('elige primer match de boveda-* si hay varios', () => {
    setup({
      'boveda-proyecto-a/': '__DIR__',
      'boveda-proyecto-b/': '__DIR__'
    })
    const result = getBovedaDir(TMP)
    assert.ok(result && result.startsWith('boveda-'))
  })

  it('ignora archivos boveda-* que no son directorios', () => {
    setup({
      'boveda-not-a-dir': 'not a directory',
      'boveda-real/': '__DIR__'
    })
    assert.strictEqual(getBovedaDir(TMP), 'boveda-real')
  })

  it('compatibilidad legacy: carpeta boveda (sin sufijo)', () => {
    setup({
      'boveda/': '__DIR__'
    })
    assert.strictEqual(getBovedaDir(TMP), 'boveda')
  })

  it('.youmindag.json tiene prioridad sobre boveda-* scan', () => {
    setup({
      [YOUMINDAG_JSON]: JSON.stringify({ version: '2.7.0', bovedaDir: 'boveda-json-priority' }),
      'boveda-json-priority/': '__DIR__',
      'boveda-scan/': '__DIR__'
    })
    assert.strictEqual(getBovedaDir(TMP), 'boveda-json-priority')
  })

  it('sin bóveda → null', () => {
    setup({})
    assert.strictEqual(getBovedaDir(TMP), null)
  })
})
