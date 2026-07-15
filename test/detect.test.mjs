// YouMindAG — detection tests (detectLang, hasPostgres, detectDBEngine)

import { describe, it, before, after } from 'node:test'
import assert from 'node:assert'
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'fs'
import { join } from 'path'
import { detectLang, hasPostgres, detectDBEngine } from '../lib/detect.mjs'

const TMP = join(process.cwd(), 'test', '__tmp_detect__')

function setup(files) {
  if (existsSync(TMP)) rmSync(TMP, { recursive: true, force: true })
  mkdirSync(TMP, { recursive: true })
  for (const [name, content] of Object.entries(files)) {
    const p = join(TMP, name)
    mkdirSync(join(p, '..'), { recursive: true })
    writeFileSync(p, content || '')
  }
}

function cleanup() {
  if (existsSync(TMP)) rmSync(TMP, { recursive: true, force: true })
}

describe('detectLang', () => {
  after(cleanup)

  it('detecta proyecto Node.js (package.json)', () => {
    setup({ 'package.json': '{}' })
    const result = detectLang(TMP)
    assert.strictEqual(result.lang, 'TypeScript / JavaScript')
    assert.strictEqual(result.framework, 'Node.js')
  })

  it('detecta proyecto TypeScript (tsconfig.json)', () => {
    setup({ 'tsconfig.json': '' })
    const result = detectLang(TMP)
    assert.strictEqual(result.framework, 'Node.js / Next.js')
  })

  it('detecta proyecto Python (pyproject.toml)', () => {
    setup({ 'pyproject.toml': '' })
    const result = detectLang(TMP)
    assert.strictEqual(result.lang, 'Python')
  })

  it('detecta proyecto Python (requirements.txt)', () => {
    setup({ 'requirements.txt': '' })
    const result = detectLang(TMP)
    assert.strictEqual(result.lang, 'Python')
  })

  it('detecta proyecto Go (go.mod)', () => {
    setup({ 'go.mod': '' })
    const result = detectLang(TMP)
    assert.strictEqual(result.lang, 'Go')
  })

  it('directorio vacío → Unknown', () => {
    setup({})
    const result = detectLang(TMP)
    assert.strictEqual(result.lang, 'Unknown')
  })
})

describe('hasPostgres', () => {
  after(cleanup)

  it('detecta pg en dependencies', () => {
    setup({ 'package.json': JSON.stringify({ dependencies: { pg: '^8.0.0' } }) })
    assert.strictEqual(hasPostgres(TMP), true)
  })

  it('detecta pg en devDependencies', () => {
    setup({ 'package.json': JSON.stringify({ devDependencies: { pg: '^8.0.0' } }) })
    assert.strictEqual(hasPostgres(TMP), true)
  })

  it('detecta @neondatabase/serverless', () => {
    setup({ 'package.json': JSON.stringify({ dependencies: { '@neondatabase/serverless': '^0.5.0' } }) })
    assert.strictEqual(hasPostgres(TMP), true)
  })

  it('sin dependencias pg → false', () => {
    setup({ 'package.json': JSON.stringify({ dependencies: { express: '^4.0.0' } }) })
    assert.strictEqual(hasPostgres(TMP), false)
  })

  it('sin package.json → false', () => {
    setup({})
    assert.strictEqual(hasPostgres(TMP), false)
  })
})

describe('detectDBEngine', () => {
  after(cleanup)

  it('detecta Supabase', () => {
    setup({ 'package.json': JSON.stringify({ dependencies: { '@supabase/supabase-js': '^2.0.0' } }) })
    assert.strictEqual(detectDBEngine(TMP), 'supabase')
  })

  it('detecta PostgreSQL', () => {
    setup({ 'package.json': JSON.stringify({ dependencies: { pg: '^8.0.0' } }) })
    assert.strictEqual(detectDBEngine(TMP), 'postgres')
  })

  it('detecta MySQL', () => {
    setup({ 'package.json': JSON.stringify({ dependencies: { mysql2: '^3.0.0' } }) })
    assert.strictEqual(detectDBEngine(TMP), 'mysql')
  })

  it('detecta Prisma', () => {
    setup({ 'package.json': JSON.stringify({ dependencies: { '@prisma/client': '^5.0.0' } }) })
    assert.strictEqual(detectDBEngine(TMP), 'prisma')
  })

  it('detecta Drizzle', () => {
    setup({ 'package.json': JSON.stringify({ dependencies: { 'drizzle-orm': '^0.30.0' } }) })
    assert.strictEqual(detectDBEngine(TMP), 'drizzle')
  })

  it('sin package.json → null', () => {
    setup({})
    assert.strictEqual(detectDBEngine(TMP), null)
  })
})
