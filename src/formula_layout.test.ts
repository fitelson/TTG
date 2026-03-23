import { describe, it, expect } from 'vitest'
import { layoutFormula, evaluateLayout } from './formula_layout'
import { sentence, Letter } from './types'

const { letter, not, and, or, imp } = sentence

describe('layoutFormula', () => {
  it('generates tokens for letter', () => {
    const layout = layoutFormula(letter('A'))
    expect(layout.tokens.length).toBe(1)
    expect(layout.tokens[0].type).toBe('value')
  })

  it('generates tokens for negation', () => {
    const layout = layoutFormula(not(letter('A')))
    // ~A: two value tokens (~ and A)
    const valueTokens = layout.tokens.filter(t => t.type === 'value')
    expect(valueTokens.length).toBe(2)
  })

  it('generates tokens for conjunction at top level (no parens)', () => {
    const layout = layoutFormula(and(letter('A'), letter('B')))
    // A & B at top level: A, &, B (no parens)
    const valueTokens = layout.tokens.filter(t => t.type === 'value')
    expect(valueTokens.length).toBe(3)
    const textTokens = layout.tokens.filter(t => t.type === 'text')
    expect(textTokens.length).toBe(0)
  })

  it('adds parens for nested binary', () => {
    const f = imp(and(letter('A'), letter('B')), letter('C'))
    const layout = layoutFormula(f)
    const textTokens = layout.tokens.filter(t => t.type === 'text')
    expect(textTokens.length).toBe(2) // ( and )
  })

  it('marks main connective', () => {
    const f = and(letter('A'), letter('B'))
    const layout = layoutFormula(f)
    const mainTokens = layout.tokens.filter(
      t => t.type === 'value' && t.isMain
    )
    expect(mainTokens.length).toBe(1)
    if (mainTokens[0].type === 'value') {
      expect(mainTokens[0].text).toBe('&')
    }
  })

  it('marks only one main connective for nested formula', () => {
    const f = imp(and(letter('A'), letter('B')), or(letter('C'), letter('D')))
    const layout = layoutFormula(f)
    const mainTokens = layout.tokens.filter(
      t => t.type === 'value' && t.isMain
    )
    expect(mainTokens.length).toBe(1)
    if (mainTokens[0].type === 'value') {
      expect(mainTokens[0].text).toBe('\u2192')
    }
  })

  it('uses consistent symbol format (no spaces)', () => {
    const condLayout = layoutFormula(imp(letter('A'), letter('B')))
    const condToken = condLayout.tokens.find(t => t.type === 'value' && t.isMain)
    expect(condToken?.type === 'value' && condToken.text).toBe('\u2192')

    const bicondLayout = layoutFormula(sentence.iff(letter('A'), letter('B')))
    const bicondToken = bicondLayout.tokens.find(t => t.type === 'value' && t.isMain)
    expect(bicondToken?.type === 'value' && bicondToken.text).toBe('\u2194')
  })
})

describe('evaluateLayout', () => {
  it('evaluates conjunction correctly', () => {
    const A = letter('A')
    const B = letter('B')
    const f = and(A, B)
    const layout = layoutFormula(f)
    const assign = (l: Letter) => l.id === 'A' ? true : false
    const values = evaluateLayout(layout, assign)
    // A=T, &=F (T&F=F), B=F
    expect(values.find(v => v.isMain)?.value).toBe(false)
  })

  it('evaluates all true correctly', () => {
    const A = letter('A')
    const B = letter('B')
    const f = and(A, B)
    const layout = layoutFormula(f)
    const assign = (_l: Letter) => true
    const values = evaluateLayout(layout, assign)
    expect(values.find(v => v.isMain)?.value).toBe(true)
  })

  it('returns correct number of value results', () => {
    const f = imp(and(letter('A'), letter('B')), letter('C'))
    const layout = layoutFormula(f)
    const assign = (_l: Letter) => true
    const values = evaluateLayout(layout, assign)
    // A, &(A&B), B, ->(main), C = 5 value tokens
    expect(values.length).toBe(5)
  })
})
