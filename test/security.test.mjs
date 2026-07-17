// YouMindAG — tests de sanitización de shell (inyección de comandos)
import { describe, it, before, after } from 'node:test'
import assert from 'node:assert'
import { existsSync, rmSync, mkdirSync } from 'fs'
import { join } from 'path'

const TMP = join(process.cwd(), 'test', '__tmp_security__')
const SENTINEL = join(TMP, 'pwned')

describe('cmdArchitect — defensa contra inyección de shell', () => {
  before(() => { rmSync(TMP, { recursive: true, force: true }); mkdirSync(TMP, { recursive: true }) })
  after(() => rmSync(TMP, { recursive: true, force: true }))

  const payloads = [
    `$(touch ${SENTINEL})`,
    `\`touch ${SENTINEL}\``,
    `x; touch ${SENTINEL}`,
    `x && touch ${SENTINEL}`,
  ]

  for (const payload of payloads) {
    it(`rechaza/neutraliza: ${payload.slice(0, 20)}`, async () => {
      const { cmdArchitect } = await import('../lib/commands/architect.mjs')
      const origExit = process.exit
      const origErr = console.error
      const origLog = console.log
      process.exit = () => { throw new Error('exit') }
      console.error = () => {}
      console.log = () => {}
      try { cmdArchitect(TMP, [payload]) } catch {}
      finally { process.exit = origExit; console.error = origErr; console.log = origLog }
      assert.ok(!existsSync(SENTINEL), `el payload ejecutó un comando: ${payload}`)
    })
  }
})

describe('graphifyQueryCompact — no interpola en shell', () => {
  before(() => { rmSync(TMP, { recursive: true, force: true }); mkdirSync(TMP, { recursive: true }) })
  after(() => rmSync(TMP, { recursive: true, force: true }))

  it('un query malicioso no crea archivos', async () => {
    const { graphifyQueryCompact } = await import('../lib/graphify.mjs')
    try { graphifyQueryCompact(TMP, `$(touch ${SENTINEL})`) } catch {}
    assert.ok(!existsSync(SENTINEL), 'graphifyQueryCompact ejecutó un comando inyectado')
  })
})

describe('curateGraphNodes — filtra git y prioriza', () => {
  it('excluye nodos de git y limita el resultado', async () => {
    const { curateGraphNodes } = await import('../lib/graphify.mjs')
    const nodes = [
      { id: 'commit-abc', src: 'git', community: 1 },
      { id: 'merge xyz', src: 'git', community: 2 },
      { id: 'infracciones/repository.ts', src: 'lib/agente_infracciones/repository.ts', community: 25 },
      { id: 'infracciones/service.ts', src: 'lib/agente_infracciones/service.ts', community: 25 },
      { id: 'otro.ts', src: 'lib/otro.ts', community: 3 },
    ]
    const result = curateGraphNodes(nodes, 'infracciones', { limit: 10 })
    assert.ok(result.every(n => n.src !== 'git'), 'no debe incluir nodos git')
    assert.ok(result.some(n => String(n.id).includes('infracciones')), 'debe incluir el match')
    assert.ok(result.length <= 10, 'respeta el límite')
  })

  it('respeta el límite superior', async () => {
    const { curateGraphNodes } = await import('../lib/graphify.mjs')
    const nodes = Array.from({ length: 50 }, (_, i) => ({ id: `mod-${i}`, src: `lib/mod-${i}.ts`, community: i }))
    assert.strictEqual(curateGraphNodes(nodes, '', { limit: 10 }).length, 10)
  })
})
