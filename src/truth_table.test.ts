import { describe, it, expect } from 'vitest'
import { evaluate, generate_truth_table, LetterSet, collect_letters } from './truth_table'
import { sentence, Letter } from './types'

const { letter, not, and, or, imp, iff, xor, nand } = sentence

// Helper to create a simple assignment function
function assign(mapping: Record<string, boolean>): (l: Letter) => boolean {
  return (l) => {
    const val = mapping[l.id]
    if (val === undefined) throw new Error(`No value for ${l.id}`)
    return val
  }
}

describe('evaluate', () => {
  const A = letter('A')
  const B = letter('B')

  it('evaluates letter', () => {
    expect(evaluate(assign({ A: true }), A)).toBe(true)
    expect(evaluate(assign({ A: false }), A)).toBe(false)
  })

  it('evaluates negation', () => {
    expect(evaluate(assign({ A: true }), not(A))).toBe(false)
    expect(evaluate(assign({ A: false }), not(A))).toBe(true)
  })

  it('evaluates conjunction', () => {
    const f = and(A, B)
    expect(evaluate(assign({ A: true, B: true }), f)).toBe(true)
    expect(evaluate(assign({ A: true, B: false }), f)).toBe(false)
    expect(evaluate(assign({ A: false, B: true }), f)).toBe(false)
    expect(evaluate(assign({ A: false, B: false }), f)).toBe(false)
  })

  it('evaluates disjunction', () => {
    const f = or(A, B)
    expect(evaluate(assign({ A: true, B: true }), f)).toBe(true)
    expect(evaluate(assign({ A: true, B: false }), f)).toBe(true)
    expect(evaluate(assign({ A: false, B: true }), f)).toBe(true)
    expect(evaluate(assign({ A: false, B: false }), f)).toBe(false)
  })

  it('evaluates conditional', () => {
    const f = imp(A, B)
    expect(evaluate(assign({ A: true, B: true }), f)).toBe(true)
    expect(evaluate(assign({ A: true, B: false }), f)).toBe(false)
    expect(evaluate(assign({ A: false, B: true }), f)).toBe(true)
    expect(evaluate(assign({ A: false, B: false }), f)).toBe(true)
  })

  it('evaluates biconditional', () => {
    const f = iff(A, B)
    expect(evaluate(assign({ A: true, B: true }), f)).toBe(true)
    expect(evaluate(assign({ A: true, B: false }), f)).toBe(false)
    expect(evaluate(assign({ A: false, B: true }), f)).toBe(false)
    expect(evaluate(assign({ A: false, B: false }), f)).toBe(true)
  })

  it('evaluates XOR', () => {
    const f = xor(A, B)
    expect(evaluate(assign({ A: true, B: true }), f)).toBe(false)
    expect(evaluate(assign({ A: true, B: false }), f)).toBe(true)
    expect(evaluate(assign({ A: false, B: true }), f)).toBe(true)
    expect(evaluate(assign({ A: false, B: false }), f)).toBe(false)
  })

  it('evaluates NAND', () => {
    const f = nand(A, B)
    expect(evaluate(assign({ A: true, B: true }), f)).toBe(false)
    expect(evaluate(assign({ A: true, B: false }), f)).toBe(true)
    expect(evaluate(assign({ A: false, B: true }), f)).toBe(true)
    expect(evaluate(assign({ A: false, B: false }), f)).toBe(true)
  })

  it('evaluates value literal', () => {
    expect(evaluate(assign({}), sentence.val(true))).toBe(true)
    expect(evaluate(assign({}), sentence.val(false))).toBe(false)
  })
})

describe('LetterSet', () => {
  it('adds unique letters', () => {
    const set = new LetterSet()
    expect(set.add(letter('A'))).toBe(true)
    expect(set.add(letter('B'))).toBe(true)
    expect(set.size()).toBe(2)
  })

  it('rejects duplicates', () => {
    const set = new LetterSet()
    expect(set.add(letter('A'))).toBe(true)
    expect(set.add(letter('A'))).toBe(false)
    expect(set.size()).toBe(1)
  })

  it('maintains sorted order', () => {
    const set = new LetterSet()
    set.add(letter('C'))
    set.add(letter('A'))
    set.add(letter('B'))
    const arr = set.toArray()
    expect(arr.map(l => l.id)).toEqual(['A', 'B', 'C'])
  })

  it('sorts by index within same letter', () => {
    const set = new LetterSet()
    set.add(letter('A', 2))
    set.add(letter('A', 0))
    set.add(letter('A', 1))
    const arr = set.toArray()
    expect(arr.map(l => l.index)).toEqual([0, 1, 2])
  })

  it('is iterable', () => {
    const set = new LetterSet()
    set.add(letter('B'))
    set.add(letter('A'))
    const ids = [...set].map(l => l.id)
    expect(ids).toEqual(['A', 'B'])
  })

  it('has() works correctly', () => {
    const set = new LetterSet()
    set.add(letter('A'))
    expect(set.has(letter('A'))).toBe(true)
    expect(set.has(letter('B'))).toBe(false)
  })
})

describe('collect_letters', () => {
  it('collects from simple formula', () => {
    const f = and(letter('A'), letter('B'))
    const letters = collect_letters(f)
    expect(letters.size()).toBe(2)
  })

  it('deduplicates', () => {
    const A = letter('A')
    const f = and(A, A)
    const letters = collect_letters(f)
    expect(letters.size()).toBe(1)
  })

  it('collects from nested formula', () => {
    const f = imp(and(letter('A'), letter('B')), or(letter('C'), letter('A')))
    const letters = collect_letters(f)
    expect(letters.size()).toBe(3)
  })
})

describe('generate_truth_table', () => {
  it('generates correct number of rows', () => {
    const f = and(letter('A'), letter('B'))
    const result = generate_truth_table([f])
    expect(result.rows.length).toBe(4) // 2^2
  })

  it('generates 1 row for no variables', () => {
    const f = sentence.val(true)
    const result = generate_truth_table([f])
    expect(result.rows.length).toBe(1)
  })

  it('has correct values for conjunction', () => {
    const A = letter('A')
    const B = letter('B')
    const f = and(A, B)
    const result = generate_truth_table([f])
    // First row: A=T, B=T → T&T = T
    expect(result.rows[0].values[0]).toBe(true)
    // Second row: A=T, B=F → T&F = F
    expect(result.rows[1].values[0]).toBe(false)
    // Third row: A=F, B=T → F&T = F
    expect(result.rows[2].values[0]).toBe(false)
    // Fourth row: A=F, B=F → F&F = F
    expect(result.rows[3].values[0]).toBe(false)
  })

  it('handles multiple formulas', () => {
    const A = letter('A')
    const B = letter('B')
    const result = generate_truth_table([and(A, B), or(A, B)])
    expect(result.formulas.length).toBe(2)
    expect(result.rows[0].values.length).toBe(2)
  })

  it('sorts letters alphabetically', () => {
    const C = letter('C')
    const A = letter('A')
    const f = and(C, A)
    const result = generate_truth_table([f])
    expect(result.letters.map(l => l.id)).toEqual(['A', 'C'])
  })

  it('generates correct number of rows for 3 variables', () => {
    const f = imp(and(letter('A'), letter('B')), letter('C'))
    const result = generate_truth_table([f])
    expect(result.rows.length).toBe(8) // 2^3
  })
})
