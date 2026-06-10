import { Sentence, Letter, letter_string } from './types'
import { evaluate } from './truth_table'

// A token in the formula display
export type FormulaToken =
  | { type: 'text', text: string }  // Just display text (parens, spaces)
  | { type: 'value', text: string, subformula: Sentence, isMain: boolean }  // Needs a truth value

export type FormulaLayout = {
  tokens: FormulaToken[]
}

export type CellDependencyMap = Map<string, string[]>

const binarySymbols: Record<string, string> = {
  conjunction: '&',
  disjunction: '\u2228',
  conditional: '\u2192',
  biconditional: '\u2194',
  xor: '\u2295',
  nand: '|',
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
      case 'disjunction':
      case 'conditional':
      case 'biconditional':
      case 'xor':
      case 'nand': {
        const symbol = binarySymbols[s.tag]
        if (!isTopLevel) emitText('(')
        layout(s.left, false, false)
        emitValue(symbol, s, isMainConnective)
        layout(s.right, false, false)
        if (!isTopLevel) emitText(')')
        break
      }
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

// Get the direct non-atomic sub-formulas that a connective depends on.
export function getSubformulaDependencies(s: Sentence): Sentence[] {
  switch (s.tag) {
    case 'value':
    case 'letter':
      return []
    case 'negation':
      return s.sentence.tag === 'letter' || s.sentence.tag === 'value' ? [] : [s.sentence]
    default: {
      const deps: Sentence[] = []
      if (s.left.tag !== 'letter' && s.left.tag !== 'value') deps.push(s.left)
      if (s.right.tag !== 'letter' && s.right.tag !== 'value') deps.push(s.right)
      return deps
    }
  }
}

// Build dependencies using actual subformula occurrences within each formula.
// This avoids collisions when the same compact formula appears elsewhere.
export function buildCellDependencies(layouts: FormulaLayout[]): CellDependencyMap {
  const dependencies: CellDependencyMap = new Map()

  layouts.forEach((layout, formulaIdx) => {
    layout.tokens.forEach((token, tokenIdx) => {
      if (token.type !== 'value' || token.subformula.tag === 'letter' || token.subformula.tag === 'value') {
        return
      }

      const deps = getSubformulaDependencies(token.subformula)
      const depCellKeys: string[] = []

      for (const dep of deps) {
        layout.tokens.forEach((candidate, candidateIdx) => {
          if (candidate.type === 'value' && candidate.subformula === dep) {
            depCellKeys.push(`${formulaIdx}-${candidateIdx}`)
          }
        })
      }

      dependencies.set(`${formulaIdx}-${tokenIdx}`, depCellKeys)
    })
  })

  return dependencies
}
