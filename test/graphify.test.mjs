// YouMindAG — graphify regression test (Bug A: RESET not defined)

import { describe, it, after } from 'node:test'
import assert from 'node:assert'
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'fs'
import { join } from 'path'

const TMP = join(process.cwd(), 'test', '__tmp_graphify__')

function setup(pkgContent) {
  if (existsSync(TMP)) rmSync(TMP, { recursive: true, force: true })
  mkdirSync(TMP, { recursive: true })
  if (pkgContent) writeFileSync(join(TMP, 'package.json'), pkgContent)
}

function cleanup() {
  if (existsSync(TMP)) rmSync(TMP, { recursive: true, force: true })
}

describe('installGraphify', () => {
  after(cleanup)

  it('no lanza excepción con pkg existente', async () => {
    setup(JSON.stringify({ name: 'test', dependencies: {} }))
    const { installGraphify } = await import('../lib/graphify.mjs')
    const logs = []
    const origLog = console.log
    console.log = (...args) => logs.push(args.join(' '))
    try {
      await installGraphify(TMP, true)
      // Should not throw, output may contain warning about npm failing
      const output = logs.join(' ')
      assert.ok(!output.includes('undefined'), 'output should not contain undefined')
    } finally {
      console.log = origLog
    }
  })

  it('no lanza excepción sin package.json (pkg=false)', async () => {
    setup()
    const { installGraphify } = await import('../lib/graphify.mjs')
    const logs = []
    const origLog = console.log
    console.log = (...args) => logs.push(args.join(' '))
    try {
      const version = await installGraphify(TMP, false)
      // No package.json, should skip install, version might be null
      const output = logs.join(' ')
      assert.ok(!output.includes('undefined'), 'output should not contain undefined')
    } finally {
      console.log = origLog
    }
  })

  it('getGraphifyVersion no lanza excepción', async () => {
    setup()
    const { getGraphifyVersion } = await import('../lib/graphify.mjs')
    const v = getGraphifyVersion(TMP)
    assert.strictEqual(v, null)
  })
})
