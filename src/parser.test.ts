import { describe, it, expect } from 'vitest'
import { parse_sentence } from './parser'

describe('parse_sentence', () => {
  // Valid simple formulas
  it('parses single letter', () => {
    const [ok, result] = parse_sentence('A')
    expect(ok).toBe(true)
    if (ok) expect(result.tag).toBe('letter')
  })

  it('parses negation', () => {
    const [ok, result] = parse_sentence('~A')
    expect(ok).toBe(true)
    if (ok) {
      expect(result.tag).toBe('negation')
      if (result.tag === 'negation') expect(result.sentence.tag).toBe('letter')
    }
  })

  // All binary connectives
  it('parses conjunction', () => {
    const [ok, result] = parse_sentence('A & B')
    expect(ok).toBe(true)
    if (ok) expect(result.tag).toBe('conjunction')
  })

  it('parses disjunction', () => {
    const [ok, result] = parse_sentence('A v B')
    expect(ok).toBe(true)
    if (ok) expect(result.tag).toBe('disjunction')
  })

  it('parses conditional', () => {
    const [ok, result] = parse_sentence('A -> B')
    expect(ok).toBe(true)
    if (ok) expect(result.tag).toBe('conditional')
  })

  it('parses biconditional', () => {
    const [ok, result] = parse_sentence('A <-> B')
    expect(ok).toBe(true)
    if (ok) expect(result.tag).toBe('biconditional')
  })

  it('parses XOR', () => {
    const [ok, result] = parse_sentence('A + B')
    expect(ok).toBe(true)
    if (ok) expect(result.tag).toBe('xor')
  })

  it('parses NAND', () => {
    const [ok, result] = parse_sentence('A | B')
    expect(ok).toBe(true)
    if (ok) expect(result.tag).toBe('nand')
  })

  // Grouping
  it('parses parenthesized formula', () => {
    const [ok, result] = parse_sentence('(A & B) -> C')
    expect(ok).toBe(true)
    if (ok) expect(result.tag).toBe('conditional')
  })

  it('parses square brackets', () => {
    const [ok, result] = parse_sentence('[A & B] -> C')
    expect(ok).toBe(true)
    if (ok) expect(result.tag).toBe('conditional')
  })

  it('parses curly braces', () => {
    const [ok, result] = parse_sentence('{A & B} -> C')
    expect(ok).toBe(true)
    if (ok) expect(result.tag).toBe('conditional')
  })

  // Nested
  it('parses nested formulas', () => {
    const [ok, result] = parse_sentence('(A & B) -> (C v D)')
    expect(ok).toBe(true)
    if (ok) expect(result.tag).toBe('conditional')
  })

  it('parses negation of grouped formula', () => {
    const [ok, result] = parse_sentence('~(A v B)')
    expect(ok).toBe(true)
    if (ok) expect(result.tag).toBe('negation')
  })

  it('parses double negation', () => {
    const [ok, result] = parse_sentence('~~A')
    expect(ok).toBe(true)
    if (ok) {
      expect(result.tag).toBe('negation')
      if (result.tag === 'negation') expect(result.sentence.tag).toBe('negation')
    }
  })

  // Whitespace handling
  it('handles extra whitespace', () => {
    const [ok] = parse_sentence('  A  &  B  ')
    expect(ok).toBe(true)
  })

  it('handles no whitespace', () => {
    const [ok] = parse_sentence('A&B')
    expect(ok).toBe(true)
  })

  // Invalid formulas
  it('rejects chained binary without grouping', () => {
    const [ok] = parse_sentence('A & B & C')
    expect(ok).toBe(false)
  })

  it('rejects empty input', () => {
    const [ok] = parse_sentence('')
    expect(ok).toBe(false)
  })

  it('rejects lowercase letters as atoms', () => {
    const [ok] = parse_sentence('a & b')
    expect(ok).toBe(false)
  })

  it('rejects parenthesized atom', () => {
    const [ok] = parse_sentence('(A)')
    expect(ok).toBe(false)
  })

  it('rejects parenthesized negation', () => {
    const [ok] = parse_sentence('(~A)')
    expect(ok).toBe(false)
  })

  // Biconditional vs conditional disambiguation
  it('parses <-> before ->', () => {
    const [ok, result] = parse_sentence('A <-> B')
    expect(ok).toBe(true)
    if (ok) expect(result.tag).toBe('biconditional')
  })

  // Mixed connectives with grouping
  it('parses mixed connectives with proper grouping', () => {
    const [ok, result] = parse_sentence('(A & B) v (C -> D)')
    expect(ok).toBe(true)
    if (ok) expect(result.tag).toBe('disjunction')
  })

  it('rejects mixed chained connectives', () => {
    const [ok] = parse_sentence('A & B v C')
    expect(ok).toBe(false)
  })
})
