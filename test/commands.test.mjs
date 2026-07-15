// YouMindAG — commands regression test (Bug C: VERSION not defined)

import { describe, it } from 'node:test'
import assert from 'node:assert'
import { showHelp } from '../lib/commands/misc.mjs'

const TEST_VERSION = '9.9.9-test'

describe('showHelp', () => {
  it('se ejecuta sin excepción y contiene la versión', () => {
    const logs = []
    const origLog = console.log
    console.log = (...args) => logs.push(args.join(' '))
    try {
      showHelp(TEST_VERSION)
      const output = logs.join('\n')
      assert.ok(output.includes(TEST_VERSION), 'output should include version string')
      assert.ok(!output.includes('undefined'), 'output should not contain undefined')
      assert.ok(output.includes('YouMindAG'), 'output should contain project name')
    } finally {
      console.log = origLog
    }
  })
})

describe('cmdStatus (dry-run style)', () => {
  it('se ejecuta sin excepción en proyecto sin boveda', async () => {
    const { cmdStatus } = await import('../lib/commands/misc.mjs')
    const logs = []
    const origLog = console.log
    console.log = (...args) => logs.push(args.join(' '))
    try {
      // Use current project dir — won't modify anything since status is read-only
      const cwd = process.cwd()
      cmdStatus(cwd, TEST_VERSION)
      const output = logs.join('\n')
      assert.ok(output.includes(TEST_VERSION), 'output should include version')
      assert.ok(!output.includes('undefined'), 'output should not contain undefined')
    } finally {
      console.log = origLog
    }
  })
})

describe('cmdUninstall (sin confirmación)', () => {
  it('no lanza excepción al mostrar targets', async () => {
    const { cmdUninstall } = await import('../lib/commands/misc.mjs')
    const logs = []
    const origLog = console.log
    console.log = (...args) => logs.push(args.join(' '))
    try {
      const cwd = process.cwd()
      cmdUninstall(cwd, TEST_VERSION)
      // Uninstall asks for confirmation via readline — it won't actually delete anything
      // because the test exits before answering. Just verify no ReferenceError.
      const output = logs.join('\n')
      assert.ok(output.includes(TEST_VERSION), 'output should include version')
      assert.ok(!output.includes('undefined'), 'output should not contain undefined')
    } finally {
      console.log = origLog
    }
  })
})
