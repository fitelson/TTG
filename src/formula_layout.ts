import { Sentence, Letter, letter_string } from './types'
import { evaluate } from './truth_table'

// A token in the formula display
export type FormulaToken =
  | { type: 'text', text: string }  // Just display text (parens, spaces)
  | { type: 'value', text: string, subformula: Sentence, isMain: boolean }  // Needs a truth value

export type FormulaLayout = {
  tokens: FormulaToken[]
}

// Generate layout tokens for a sentence
export function layoutFormula(s: Sentence): FormulaLayout {
  const tokens: FormulaToken[] = []

  function emit(token: FormulaToken) {
    tokens.push(token)
  }

  function emitText(text: string) {
    emit({ type: 'text', text })
  }

  function emitValue(text: string, subformula: Sentence, isMainConn: boolean) {
    emit({ type: 'value', text, subformula, isMain: isMainConn })
  }

  function layout(s: Sentence, isMainConnective: boolean, isTopLevel: boolean): void {
    switch (s.tag) {
      case 'value':
        emitValue(s.value ? '\u22A4' : '\u22A5', s, isMainConnective)
        break

      case 'letter':
        emitValue(letter_string(s), s, isMainConnective)
        break

      case 'negation':
        emitValue('~', s, isMainConnective)
        layout(s.sentence, false, false)
        break

      case 'conjunction':
        if (!isTopLevel) emitText('(')
        layout(s.left, false, false)
        emitValue('&', s, isMainConnective)
        layout(s.right, false, false)
        if (!isTopLevel) emitText(')')
        break

      case 'disjunction':
        if (!isTopLevel) emitText('(')
        layout(s.left, false, false)
        emitValue('\u2228', s, isMainConnective)
        layout(s.right, false, false)
        if (!isTopLevel) emitText(')')
        break

      case 'conditional':
        if (!isTopLevel) emitText('(')
        layout(s.left, false, false)
        emitValue(' \u2192 ', s, isMainConnective)
        layout(s.right, false, false)
        if (!isTopLevel) emitText(')')
        break

      case 'biconditional':
        if (!isTopLevel) emitText('(')
        layout(s.left, false, false)
        emitValue(' \u2194 ', s, isMainConnective)
        layout(s.right, false, false)
        if (!isTopLevel) emitText(')')
        break

      case 'xor':
        if (!isTopLevel) emitText('(')
        layout(s.left, false, false)
        emitValue('\u2295', s, isMainConnective)
        layout(s.right, false, false)
        if (!isTopLevel) emitText(')')
        break

      case 'nand':
        if (!isTopLevel) emitText('(')
        layout(s.left, false, false)
        emitValue('|', s, isMainConnective)
        layout(s.right, false, false)
        if (!isTopLevel) emitText(')')
        break
    }
  }

  layout(s, true, true)
  return { tokens }
}

// Evaluate all value tokens for a given assignment
export function evaluateLayout(
  layout: FormulaLayout,
  assignment: (l: Letter) => boolean
): { text: string, value: boolean, isMain: boolean }[] {
  return layout.tokens
    .filter((t): t is Extract<FormulaToken, { type: 'value' }> => t.type === 'value')
    .map(t => ({
      text: t.text,
      value: evaluate(assignment, t.subformula),
      isMain: t.isMain
    }))
}
