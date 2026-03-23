import { describe, it, expect } from 'vitest'
import { sentence, sentence_to_string, sentence_to_string_compact, letter_string } from './types'

const { letter, not, and, or, imp, iff, xor, nand, val } = sentence

describe('letter_string', () => {
  it('converts simple letter', () => {
    expect(letter_string(letter('A'))).toBe('A')
  })

  it('includes index when > 0', () => {
    expect(letter_string(letter('A', 2))).toBe('A2')
  })

  it('omits index when 0', () => {
    expect(letter_string(letter('A', 0))).toBe('A')
  })
})

describe('sentence_to_string', () => {
  it('converts letter', () => {
    expect(sentence_to_string(letter('A'))).toBe('A')
  })

  it('converts negation', () => {
    expect(sentence_to_string(not(letter('A')))).toBe('~A')
  })

  it('converts conjunction', () => {
    expect(sentence_to_string(and(letter('A'), letter('B')))).toBe('A & B')
  })

  it('converts disjunction', () => {
    expect(sentence_to_string(or(letter('A'), letter('B')))).toBe('A \u2228 B')
  })

  it('converts conditional', () => {
    expect(sentence_to_string(imp(letter('A'), letter('B')))).toBe('A \u2192 B')
  })

  it('converts biconditional', () => {
    expect(sentence_to_string(iff(letter('A'), letter('B')))).toBe('A \u2194 B')
  })

  it('converts XOR', () => {
    expect(sentence_to_string(xor(letter('A'), letter('B')))).toBe('A \u2295 B')
  })

  it('converts NAND', () => {
    expect(sentence_to_string(nand(letter('A'), letter('B')))).toBe('A | B')
  })

  it('converts nested formula with sub-formula parens', () => {
    const f = imp(and(letter('A'), letter('B')), letter('C'))
    expect(sentence_to_string(f)).toBe('(A & B) \u2192 C')
  })

  it('converts value literals', () => {
    expect(sentence_to_string(val(true))).toBe('\u22A4')
    expect(sentence_to_string(val(false))).toBe('\u22A5')
  })

  it('does not wrap negation in parens', () => {
    expect(sentence_to_string(not(not(letter('A'))))).toBe('~~A')
  })
})

describe('sentence_to_string_compact', () => {
  it('top-level binary has no parens', () => {
    expect(sentence_to_string_compact(and(letter('A'), letter('B')))).toBe('A&B')
  })

  it('nested binary gets parens', () => {
    const f = imp(and(letter('A'), letter('B')), letter('C'))
    expect(sentence_to_string_compact(f)).toBe('(A&B)\u2192C')
  })

  it('converts value literals compactly', () => {
    expect(sentence_to_string_compact(val(true))).toBe('T')
    expect(sentence_to_string_compact(val(false))).toBe('F')
  })

  it('handles negation', () => {
    expect(sentence_to_string_compact(not(letter('A')))).toBe('~A')
  })

  it('handles deeply nested', () => {
    const f = or(imp(letter('A'), letter('B')), and(letter('C'), letter('D')))
    expect(sentence_to_string_compact(f)).toBe('(A\u2192B)\u2228(C&D)')
  })
})
