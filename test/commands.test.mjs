// YouMindAG — commands regression test (Bug C: VERSION not defined)

import { describe, it, before, after } from 'node:test'
import assert from 'node:assert'
import { showHelp, cmdHelp } from '../lib/commands/misc.mjs'
import { existsSync, mkdirSync, rmSync, writeFileSync, readFileSync } from 'fs'
import { join } from 'path'

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

  it('incluye nuevos comandos (architect, doctor, guide, history)', () => {
    const logs = []
    const origLog = console.log
    console.log = (...args) => logs.push(args.join(' '))
    try {
      showHelp(TEST_VERSION)
      const output = logs.join('\n')
      assert.ok(output.includes('architect'), 'should mention architect command')
      assert.ok(output.includes('doctor'), 'should mention doctor command')
      assert.ok(output.includes('guide'), 'should mention guide command')
      assert.ok(output.includes('history'), 'should mention history command')
    } finally {
      console.log = origLog
    }
  })
})

describe('cmdHelp', () => {
  it('se ejecuta sin excepción sin argumentos', () => {
    const logs = []
    const origLog = console.log
    console.log = (...args) => logs.push(args.join(' '))
    try {
      cmdHelp(process.cwd(), [])
      const output = logs.join('\n')
      assert.ok(output.includes('YouMindAG'), 'should include project name')
      assert.ok(!output.includes('undefined'), 'should not contain undefined')
    } finally {
      console.log = origLog
    }
  })

  it('--examples muestra ejemplos', () => {
    const logs = []
    const origLog = console.log
    console.log = (...args) => logs.push(args.join(' '))
    try {
      cmdHelp(process.cwd(), ['--examples'])
      const output = logs.join('\n')
      assert.ok(output.includes('Arquitecto'), 'should include arquitecto examples')
      assert.ok(output.includes('youmindag architect'), 'should include architect command example')
    } finally {
      console.log = origLog
    }
  })

  it('help architect muestra ayuda específica', () => {
    const logs = []
    const origLog = console.log
    console.log = (...args) => logs.push(args.join(' '))
    try {
      cmdHelp(process.cwd(), ['architect'])
      const output = logs.join('\n')
      assert.ok(output.includes('Protocolo Arquitecto'), 'should include protocol')
      assert.ok(output.includes('youmindag architect'), 'should include command usage')
    } finally {
      console.log = origLog
    }
  })

  it('help doctor muestra ayuda específica', () => {
    const logs = []
    const origLog = console.log
    console.log = (...args) => logs.push(args.join(' '))
    try {
      cmdHelp(process.cwd(), ['doctor'])
      const output = logs.join('\n')
      assert.ok(output.includes('Diagnóstico'), 'should include diagnosis')
      assert.ok(output.includes('youmindag doctor'), 'should include command usage')
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
      const output = logs.join('\n')
      assert.ok(output.includes(TEST_VERSION), 'output should include version')
      assert.ok(!output.includes('undefined'), 'output should not contain undefined')
    } finally {
      console.log = origLog
    }
  })
})

describe('cmdHistory', () => {
  const tmpDir = join(process.cwd(), 'test', '__tmp_history__')

  before(() => {
    rmSync(tmpDir, { recursive: true, force: true })
    mkdirSync(join(tmpDir, '.youmindag', 'boveda'), { recursive: true })
    writeFileSync(join(tmpDir, '.youmindag', 'session.jsonl'), '')
    writeFileSync(join(tmpDir, '.youmindag', 'decisions.jsonl'), '')
  })

  after(() => {
    rmSync(tmpDir, { recursive: true, force: true })
  })

  it('sin datos no lanza excepción', async () => {
    const { cmdHistory } = await import('../lib/commands/history.mjs')
    const logs = []
    const origLog = console.log
    console.log = (...args) => logs.push(args.join(' '))
    try {
      cmdHistory(tmpDir, [])
      const output = logs.join('\n')
      assert.ok(!output.includes('undefined'), 'should not contain undefined')
    } finally {
      console.log = origLog
    }
  })

  it('con session.jsonl poblado muestra eventos', async () => {
    const ymdir = join(tmpDir, '.youmindag')
    writeFileSync(join(ymdir, 'session.jsonl'),
      JSON.stringify({ timestamp: new Date().toISOString(), key: 'investigacion', text: 'Test session event' }) + '\n')

    const { cmdHistory } = await import('../lib/commands/history.mjs')
    const logs = []
    const origLog = console.log
    console.log = (...args) => logs.push(args.join(' '))
    try {
      cmdHistory(tmpDir, [])
      const output = logs.join('\n')
      assert.ok(output.includes('Test session event'), 'should include session event text')
    } finally {
      console.log = origLog
    }
  })

  it('con decisions.jsonl poblado muestra ADRs', async () => {
    const ymdir = join(tmpDir, '.youmindag')
    writeFileSync(join(ymdir, 'decisions.jsonl'),
      JSON.stringify({ timestamp: new Date().toISOString(), decision: 'Usar PostgreSQL', rationale: 'Mejor rendimiento' }) + '\n')

    const { cmdHistory } = await import('../lib/commands/history.mjs')
    const logs = []
    const origLog = console.log
    console.log = (...args) => logs.push(args.join(' '))
    try {
      cmdHistory(tmpDir, ['--decisions'])
      const output = logs.join('\n')
      assert.ok(output.includes('Usar PostgreSQL'), 'should include decision text')
    } finally {
      console.log = origLog
    }
  })

  it('--filter filtra resultados', async () => {
    const { cmdHistory } = await import('../lib/commands/history.mjs')
    const logs = []
    const origLog = console.log
    console.log = (...args) => logs.push(args.join(' '))
    try {
      cmdHistory(tmpDir, ['--filter', 'PostgreSQL'])
      const output = logs.join('\n')
      assert.ok(output.includes('Usar PostgreSQL'), 'should include filtered decision')
    } finally {
      console.log = origLog
    }
  })
})

describe('cmdArchitect', () => {
  it('--guide muestra guía del protocolo', async () => {
    const { cmdArchitect } = await import('../lib/commands/architect.mjs')
    const logs = []
    const origLog = console.log
    console.log = (...args) => logs.push(args.join(' '))
    try {
      cmdArchitect(process.cwd(), ['--guide'])
      const output = logs.join('\n')
      assert.ok(output.includes('Protocolo Arquitecto'), 'should include protocol title')
      assert.ok(output.includes('Bóveda'), 'should mention boveda')
      assert.ok(!output.includes('undefined'), 'should not contain undefined')
    } finally {
      console.log = origLog
    }
  })

  it('sin argumentos lista módulos disponibles', async () => {
    const { cmdArchitect } = await import('../lib/commands/architect.mjs')
    const logs = []
    const origLog = console.log
    console.log = (...args) => logs.push(args.join(' '))
    try {
      cmdArchitect(process.cwd(), [])
      const output = logs.join('\n')
      assert.ok(output.includes('Arquitecto'), 'should include arquitecto')
      assert.ok(!output.includes('undefined'), 'should not contain undefined')
    } finally {
      console.log = origLog
    }
  })
})

describe('cmdDoctor', () => {
  it('se ejecuta sin excepción sin argumentos', async () => {
    const { cmdDoctor } = await import('../lib/commands/doctor.mjs')
    const logs = []
    const origLog = console.log
    console.log = (...args) => logs.push(args.join(' '))
    try {
      cmdDoctor(process.cwd(), [])
      const output = logs.join('\n')
      assert.ok(!output.includes('undefined'), 'should not contain undefined')
    } finally {
      console.log = origLog
    }
  })

  it('--json produce JSON parseable', async () => {
    const { cmdDoctor } = await import('../lib/commands/doctor.mjs')
    const writes = []
    const origWrite = process.stdout.write
    process.stdout.write = (data) => { writes.push(data); return true }
    try {
      cmdDoctor(process.cwd(), ['--json'])
      const output = writes.join('')
      const parsed = JSON.parse(output)
      assert.ok(typeof parsed.version === 'string' || parsed.version === null, 'version should be string or null')
      assert.ok(typeof parsed.installed === 'boolean', 'installed should be boolean')
    } finally {
      process.stdout.write = origWrite
    }
  })
})

describe('cmdGuide', () => {
  it('sin argumentos muestra guía completa', async () => {
    const { cmdGuide } = await import('../lib/commands/guide.mjs')
    const logs = []
    const origLog = console.log
    console.log = (...args) => logs.push(args.join(' '))
    try {
      cmdGuide(process.cwd(), [])
      const output = logs.join('\n')
      assert.ok(output.includes('BOVEDA'), 'should include boveda section')
      assert.ok(output.includes('GRAPHIFY'), 'should include graphify section')
      assert.ok(output.includes('YOUMINDAG'), 'should include youmindag section')
      assert.ok(!output.includes('undefined'), 'should not contain undefined')
    } finally {
      console.log = origLog
    }
  })

  it('guide boveda muestra solo bóveda', async () => {
    const { cmdGuide } = await import('../lib/commands/guide.mjs')
    const logs = []
    const origLog = console.log
    console.log = (...args) => logs.push(args.join(' '))
    try {
      cmdGuide(process.cwd(), ['boveda'])
      const output = logs.join('\n')
      assert.ok(output.includes('Bóveda de Conocimiento'), 'should include boveda title')
    } finally {
      console.log = origLog
    }
  })

  it('guide graphify muestra solo grafo', async () => {
    const { cmdGuide } = await import('../lib/commands/guide.mjs')
    const logs = []
    const origLog = console.log
    console.log = (...args) => logs.push(args.join(' '))
    try {
      cmdGuide(process.cwd(), ['graphify'])
      const output = logs.join('\n')
      assert.ok(output.includes('Graphify'), 'should include graphify title')
    } finally {
      console.log = origLog
    }
  })
})

describe('Vault session/decisions', () => {
  const tmpDir = join(process.cwd(), 'test', '__tmp_vault_ext__')

  before(() => {
    rmSync(tmpDir, { recursive: true, force: true })
    mkdirSync(join(tmpDir, '.youmindag'), { recursive: true })
  })

  after(() => {
    rmSync(tmpDir, { recursive: true, force: true })
  })

  it('appendSessionEvent y readSessionHistory roundtrip', async () => {
    const { appendSessionEvent, readSessionHistory } = await import('../lib/vault.mjs')
    appendSessionEvent(tmpDir, 'test-key', 'test text value')
    const sessions = readSessionHistory(tmpDir)
    assert.strictEqual(sessions.length, 1, 'should have 1 session event')
    assert.strictEqual(sessions[0].key, 'test-key')
    assert.strictEqual(sessions[0].text, 'test text value')
    assert.ok(sessions[0].timestamp, 'should have timestamp')
  })

  it('appendDecision y readDecisions roundtrip', async () => {
    const { appendDecision, readDecisions } = await import('../lib/vault.mjs')
    appendDecision(tmpDir, 'Decision A', 'Rationale for A')
    const decisions = readDecisions(tmpDir)
    assert.strictEqual(decisions.length, 1, 'should have 1 decision')
    assert.strictEqual(decisions[0].decision, 'Decision A')
    assert.strictEqual(decisions[0].rationale, 'Rationale for A')
    assert.ok(decisions[0].timestamp, 'should have timestamp')
  })

  it('readSessionHistory en directorio sin .youmindag devuelve []', async () => {
    const { readSessionHistory } = await import('../lib/vault.mjs')
    const sessions = readSessionHistory(join(tmpDir, 'nonexistent'))
    assert.deepStrictEqual(sessions, [])
  })

  it('readDecisions en directorio sin .youmindag devuelve []', async () => {
    const { readDecisions } = await import('../lib/vault.mjs')
    const decisions = readDecisions(join(tmpDir, 'nonexistent'))
    assert.deepStrictEqual(decisions, [])
  })

  it('appendSessionEvent múltiples entradas preserva todas', async () => {
    const { appendSessionEvent, readSessionHistory } = await import('../lib/vault.mjs')
    appendSessionEvent(tmpDir, 'key1', 'value1')
    appendSessionEvent(tmpDir, 'key2', 'value2')
    const sessions = readSessionHistory(tmpDir)
    assert.ok(sessions.length >= 2, 'should have at least 2 session events')
    assert.ok(sessions.some(s => s.key === 'key2'), 'should contain second event')
  })
})

describe('graphifyQueryCompact', () => {
  it('no lanza excepción sin graphify instalado', async () => {
    const { graphifyQueryCompact } = await import('../lib/graphify.mjs')
    const result = graphifyQueryCompact(process.cwd(), 'test-query')
    assert.ok(Array.isArray(result.modules), 'modules should be array')
    assert.ok(Array.isArray(result.dependencies), 'dependencies should be array')
    assert.ok(Array.isArray(result.warnings), 'warnings should be array')
  })

  it('getGraphMeta funciona', async () => {
    const { getGraphMeta } = await import('../lib/graphify.mjs')
    const cwd = process.cwd()
    const meta = getGraphMeta(cwd)
    if (existsSync(join(cwd, '.graphify', 'graph.json'))) {
      assert.ok(meta, 'should return meta when graph exists')
      assert.ok(typeof meta.nodes === 'number', 'nodes should be number')
    }
  })
})
