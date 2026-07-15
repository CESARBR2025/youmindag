// YouMindAG — populate regression test (Bug B: RESET not defined)

import { describe, it, after } from 'node:test'
import assert from 'node:assert'
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'fs'
import { join } from 'path'

const TMP = join(process.cwd(), 'test', '__tmp_populate__')

function setup(pkgContent) {
  if (existsSync(TMP)) rmSync(TMP, { recursive: true, force: true })
  mkdirSync(TMP, { recursive: true })
  // Create minimal package.json
  writeFileSync(join(TMP, 'package.json'), pkgContent || JSON.stringify({ name: 'test' }))
  // Create boveda directory so getBovedaDir doesn't return null
  mkdirSync(join(TMP, 'boveda'))
  mkdirSync(join(TMP, 'boveda', '🛠 Stack'), { recursive: true })
}

function cleanup() {
  if (existsSync(TMP)) rmSync(TMP, { recursive: true, force: true })
}

describe('populateVaultFiles', () => {
  after(cleanup)

  it('no lanza excepción con package.json básico', async () => {
    setup(JSON.stringify({ name: 'test' }))
    const { populateVaultFiles } = await import('../lib/populate.mjs')
    const logs = []
    const origLog = console.log
    console.log = (...args) => logs.push(args.join(' '))
    try {
      populateVaultFiles(TMP)
      const output = logs.join(' ')
      assert.ok(!output.includes('undefined'), 'output should not contain undefined')
    } finally {
      console.log = origLog
    }
  })

  it('no lanza excepción con package.json con scripts y dependencias', async () => {
    setup(JSON.stringify({
      name: 'test',
      scripts: { dev: 'next dev', build: 'next build' },
      dependencies: { next: '14.0.0', react: '18.2.0', pg: '8.11.0' }
    }))
    const { populateVaultFiles } = await import('../lib/populate.mjs')
    const logs = []
    const origLog = console.log
    console.log = (...args) => logs.push(args.join(' '))
    try {
      populateVaultFiles(TMP)
      const output = logs.join(' ')
      assert.ok(!output.includes('undefined'), 'output should not contain undefined')
      // Should have populated at least Comandos and Librerias
      assert.ok(output.includes('Comandos') || output.includes('Librerías') || output.includes('Bóveda auto-poblada'))
    } finally {
      console.log = origLog
    }
  })
})
