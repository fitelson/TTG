import { Sentence, Letter, letter_string } from './types'
import { assert_exists } from './utils'

// A set of letters that handles id+index pairs properly
export class LetterSet {
  private readonly map = new Map<string, Set<number>>()
  private readonly all: Letter[] = []

  constructor(letters: Letter[] = []) {
    for (const l of letters) this.add(l)
  }

  [Symbol.iterator]() { return this.all[Symbol.iterator]() }

  has(letter: Letter): boolean {
    return this.map.get(letter.id)?.has(letter.index) ?? false
  }

  add(l: Letter): boolean {
    const set = this.map.get(l.id)
    if (set === undefined) {
      this.map.set(l.id, new Set([l.index]))
      this.all.push(l)
      return true
    } else if (!set.has(l.index)) {
      set.add(l.index)
      this.all.push(l)
      return true
    }
    return false
  }

  size(): number { return this.all.length }

  toArray(): Letter[] { return [...this.all] }
}

// Compare letters for sorting (alphabetical, then by index)
const comp_letters = (a: Letter, b: Letter): number => {
  const cmp = a.id.localeCompare(b.id)
  return cmp === 0 ? a.index - b.index : cmp
}

// Collect all letters from a sentence
export const collect_letters = (s: Sentence): LetterSet => {
  const letters = new LetterSet()
  const rec = (s: Sentence): void => {
    switch (s.tag) {
      case 'value': break
      case 'letter': letters.add(s); break
      case 'negation': rec(s.sentence); break
      case 'conjunction':
      case 'disjunction':
      case 'conditional':
      case 'biconditional':
      case 'xor':
      case 'nand':
        rec(s.left)
        rec(s.right)
        break
    }
  }
  rec(s)
  return letters
}

// Evaluate a sentence given an assignment
export const evaluate = (assignment: (l: Letter) => boolean, s: Sentence): boolean => {
  switch (s.tag) {
    case 'value': return s.value
    case 'letter': return assignment(s)
    case 'negation': return !evaluate(assignment, s.sentence)
    case 'conjunction': return evaluate(assignment, s.left) && evaluate(assignment, s.right)
    case 'disjunction': return evaluate(assignment, s.left) || evaluate(assignment, s.right)
    case 'conditional': return !evaluate(assignment, s.left) || evaluate(assignment, s.right)
    case 'biconditional': return evaluate(assignment, s.left) === evaluate(assignment, s.right)
    case 'xor': return evaluate(assignment, s.left) !== evaluate(assignment, s.right)
    case 'nand': return !(evaluate(assignment, s.left) && evaluate(assignment, s.right))
  }
}

// Convert state index to binary string for assignments
const to_bin_str = (n: number, width: number): string =>
  (n >>> 0).toString(2).padStart(width, '0')

export type TruthTableRow = {
  assignment: Map<string, boolean>  // letter_string -> value
  values: boolean[]                  // value for each formula
}

export type TruthTableResult = {
  letters: Letter[]
  formulas: Sentence[]
  rows: TruthTableRow[]
}

// Generate truth table for multiple formulas
export const generate_truth_table = (formulas: Sentence[]): TruthTableResult => {
  // Collect all unique letters across all formulas
  const allLetters = new LetterSet()
  for (const f of formulas) {
    for (const l of collect_letters(f)) {
      allLetters.add(l)
    }
  }

  const letters = allLetters.toArray().sort(comp_letters)
  const n_states = letters.length === 0 ? 1 : Math.pow(2, letters.length)
  const rows: TruthTableRow[] = []

  for (let state = 0; state < n_states; state++) {
    const bin = to_bin_str(state, letters.length)

    // Build assignment map
    const assignment = new Map<string, boolean>()
    for (let i = 0; i < letters.length; i++) {
      const letter = assert_exists(letters[i])
      // 0 = true, 1 = false (standard truth table ordering)
      assignment.set(letter_string(letter), bin[i] === '0')
    }

    // Create lookup function
    const lookup = (l: Letter): boolean => {
      const key = letter_string(l)
      const val = assignment.get(key)
      if (val === undefined) {
        throw new Error(`Letter ${key} not found in assignment`)
      }
      return val
    }

    // Evaluate each formula
    const values = formulas.map(f => evaluate(lookup, f))

    rows.push({ assignment, values })
  }

  return { letters, formulas, rows }
}
