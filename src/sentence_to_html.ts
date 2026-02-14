import { math_el } from "./el"
import { Sentence, Letter, letter_string } from "./types"

// Display connectives
const connectives: Record<string, string> = {
  negation: '~',
  conjunction: '&',
  disjunction: '∨',
  conditional: '→',
  biconditional: '↔',
  xor: '⊕',
  nand: '|',
}

// Convert a sentence to MathML, optionally wrapped in a <math> element
export const sentence_to_html = (s: Sentence, wrap_in_math_element: boolean = true): MathMLElement => {
  const sub = (s: Sentence): MathMLElement => sentence_to_html(s, false)

  const wrap = (s: Sentence, exclude: Sentence['tag'][]): MathMLElement => {
    if (!exclude.includes(s.tag)) {
      const lp = math_el('mo', {}, '(')
      const rp = math_el('mo', {}, ')')
      return math_el('mrow', {}, lp, sub(s), rp)
    } else {
      return sub(s)
    }
  }

  const result = ((): MathMLElement => {
    if (s.tag === 'value') {
      const text = s.value ? '⊤' : '⊥'
      return math_el('mi', {}, text)
    } else if (s.tag === 'letter') {
      const id = letter_string(s)
      return math_el('mi', { mathvariant: 'normal' }, id)
    } else if (s.tag === 'negation') {
      const op = math_el('mo', {}, connectives.negation)
      return math_el('mrow', {}, op, wrap(s.sentence, ['negation', 'letter', 'value']))
    } else {
      const op = math_el('mo', {}, connectives[s.tag])
      // Always wrap binary subformulas in parens (only atoms and negations are excluded)
      return math_el('mrow', {},
        wrap(s.left, ['negation', 'letter', 'value']),
        op,
        wrap(s.right, ['negation', 'letter', 'value'])
      )
    }
  })()

  if (wrap_in_math_element) {
    return math_el('math', {}, result)
  } else {
    return result
  }
}

// Convert a letter to MathML (for variable column headers)
export const letter_to_html = (l: Letter, wrap_in_math_element: boolean = true): MathMLElement => {
  const mi = math_el('mi', { mathvariant: 'normal' }, letter_string(l))
  if (wrap_in_math_element) {
    return math_el('math', {}, mi)
  }
  return mi
}

// Convert a single token (connective, letter, etc.) to MathML for table headers
export const token_to_html = (text: string, wrap_in_math_element: boolean = true): MathMLElement => {
  // Determine if it's an operator or identifier
  const isOperator = ['~', '∧', '∨', '→', '↔', '(', ')', '⊤', '⊥', '&', '⊕', '|'].includes(text.trim())
  const element = isOperator
    ? math_el('mo', {}, text)
    : math_el('mi', { mathvariant: 'normal' }, text)

  if (wrap_in_math_element) {
    return math_el('math', {}, element)
  }
  return element
}
