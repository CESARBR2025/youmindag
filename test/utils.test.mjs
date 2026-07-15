// YouMindAG — util tests (kebabCase, pascalCase)

import { describe, it } from 'node:test'
import assert from 'node:assert'
import { kebabCase, pascalCase } from '../lib/utils.mjs'

describe('kebabCase', () => {
  it('convierte nombre normal a kebab-case', () => {
    assert.strictEqual(kebabCase('Mi Proyecto'), 'mi-proyecto')
  })

  it('convierte camelCase a kebab-case', () => {
    assert.strictEqual(kebabCase('seguridadPublica'), 'seguridadpublica')
  })

  it('maneja guiones y underscores', () => {
    assert.strictEqual(kebabCase('mi_proyecto_final'), 'mi-proyecto-final')
  })

  it('maneja espacios múltiples', () => {
    assert.strictEqual(kebabCase('mi   proyecto'), 'mi-proyecto')
  })

  // ── Bug 2 regression: empty/non-latin input must return fallback ──
  it('Bug 2: input vacío → fallback "proyecto"', () => {
    assert.strictEqual(kebabCase(''), 'proyecto')
  })

  it('Bug 2: solo emojis → fallback "proyecto"', () => {
    assert.strictEqual(kebabCase('🚀🔥'), 'proyecto')
  })

  it('Bug 2: solo caracteres chinos → fallback "proyecto"', () => {
    assert.strictEqual(kebabCase('项目名称'), 'proyecto')
  })

  it('Bug 2: solo signos de puntuación → fallback "proyecto"', () => {
    assert.strictEqual(kebabCase('!@#$%'), 'proyecto')
  })

  it('elimina guiones al inicio y final', () => {
    assert.strictEqual(kebabCase('-proyecto-'), 'proyecto')
  })

  it('colapsa guiones múltiples', () => {
    assert.strictEqual(kebabCase('mi--proyecto'), 'mi-proyecto')
  })
})

describe('pascalCase', () => {
  it('convierte kebab-case a PascalCase', () => {
    assert.strictEqual(pascalCase('mi-proyecto'), 'MiProyecto')
  })

  it('convierte snake_case a PascalCase', () => {
    assert.strictEqual(pascalCase('mi_proyecto'), 'MiProyecto')
  })

  it('convierte espacios a PascalCase', () => {
    assert.strictEqual(pascalCase('mi proyecto'), 'MiProyecto')
  })
})
