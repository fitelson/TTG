// Sentence types for propositional logic
export type Sentence =
  | { tag: 'value', value: boolean }
  | { tag: 'letter', id: string, index: number }
  | { tag: 'negation', sentence: Sentence }
  | { tag: 'disjunction', left: Sentence, right: Sentence }
  | { tag: 'conjunction', left: Sentence, right: Sentence }
  | { tag: 'conditional', left: Sentence, right: Sentence }
  | { tag: 'biconditional', left: Sentence, right: Sentence }
  | { tag: 'xor', left: Sentence, right: Sentence }
  | { tag: 'nand', left: Sentence, right: Sentence }

export type Letter = Extract<Sentence, { tag: 'letter' }>

// Sentence builders
export const sentence = {
  val: (v: boolean): Sentence => ({ tag: 'value', value: v }),
  letter: (id: string, index?: number): Letter => ({ tag: 'letter', id, index: index ?? 0 }),
  not: (s: Sentence): Sentence => ({ tag: 'negation', sentence: s }),
  and: (left: Sentence, right: Sentence): Sentence => ({ tag: 'conjunction', left, right }),
  or: (left: Sentence, right: Sentence): Sentence => ({ tag: 'disjunction', left, right }),
  imp: (left: Sentence, right: Sentence): Sentence => ({ tag: 'conditional', left, right }),
  iff: (left: Sentence, right: Sentence): Sentence => ({ tag: 'biconditional', left, right }),
  xor: (left: Sentence, right: Sentence): Sentence => ({ tag: 'xor', left, right }),
  nand: (left: Sentence, right: Sentence): Sentence => ({ tag: 'nand', left, right }),
}

// Display a letter as a string (e.g., "A", "B1", "C2")
export const letter_string = (l: Letter): string =>
  `${l.id}${l.index > 0 ? l.index : ''}`

// Display a sentence as a string (with spaces)
export const sentence_to_string = (s: Sentence): string => {
  switch (s.tag) {
    case 'value': return s.value ? '\u22A4' : '\u22A5'
    case 'letter': return letter_string(s)
    case 'negation': return `~${wrap_if_needed(s.sentence)}`
    case 'conjunction': return `${wrap_if_needed(s.left)} & ${wrap_if_needed(s.right)}`
    case 'disjunction': return `${wrap_if_needed(s.left)} \u2228 ${wrap_if_needed(s.right)}`
    case 'conditional': return `${wrap_if_needed(s.left)} \u2192 ${wrap_if_needed(s.right)}`
    case 'biconditional': return `${wrap_if_needed(s.left)} \u2194 ${wrap_if_needed(s.right)}`
    case 'xor': return `${wrap_if_needed(s.left)} \u2295 ${wrap_if_needed(s.right)}`
    case 'nand': return `${wrap_if_needed(s.left)} | ${wrap_if_needed(s.right)}`
  }
}

const wrap_if_needed = (s: Sentence): string => {
  if (s.tag === 'value' || s.tag === 'letter' || s.tag === 'negation') {
    return sentence_to_string(s)
  }
  return `(${sentence_to_string(s)})`
}

// Display a sentence as a compact string (no spaces, for table headers)
export const sentence_to_string_compact = (s: Sentence, isTopLevel: boolean = true): string => {
  switch (s.tag) {
    case 'value': return s.value ? 'T' : 'F'
    case 'letter': return letter_string(s)
    case 'negation': return `~${sentence_to_string_compact(s.sentence, false)}`
    case 'conjunction': return wrap_compact(s.left, s.right, '&', isTopLevel)
    case 'disjunction': return wrap_compact(s.left, s.right, '\u2228', isTopLevel)
    case 'conditional': return wrap_compact(s.left, s.right, '\u2192', isTopLevel)
    case 'biconditional': return wrap_compact(s.left, s.right, '\u2194', isTopLevel)
    case 'xor': return wrap_compact(s.left, s.right, '\u2295', isTopLevel)
    case 'nand': return wrap_compact(s.left, s.right, '|', isTopLevel)
  }
}

const wrap_compact = (left: Sentence, right: Sentence, op: string, isTopLevel: boolean): string => {
  const inner = `${sentence_to_string_compact(left, false)}${op}${sentence_to_string_compact(right, false)}`
  return isTopLevel ? inner : `(${inner})`
}
