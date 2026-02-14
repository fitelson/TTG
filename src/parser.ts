import P from 'parsimmon'
import { Sentence, sentence } from './types'
import { Res } from './utils'

const { letter, not, and, or, imp, iff, xor, nand } = sentence

// Connective symbols that users can type
const connectives = {
  negation: ['~'],
  conjunction: ['&'],
  disjunction: ['v'],
  conditional: ['->'],
  biconditional: ['<->'],
  xor: ['+'],
  nand: ['|'],
}

const alt_strings = (strs: string[]): P.Parser<string> =>
  P.alt(...strs.map(s => P.string(s)))

const SentenceLang = P.createLanguage({
  Sentence: (r) => P.alt(r.Iff, r.Imp, r.Or, r.And, r.Xor, r.Nand, r.Factor),

  Factor: (r) => P.alt(
    r.Not,
    r.Wrapped,
    r.Letter
  ),

  Wrapped: (r) => P.alt(
    P.seq(P.string('('), P.optWhitespace, r.Sentence, P.optWhitespace, P.string(')')),
    P.seq(P.string('['), P.optWhitespace, r.Sentence, P.optWhitespace, P.string(']')),
    P.seq(P.string('{'), P.optWhitespace, r.Sentence, P.optWhitespace, P.string('}'))
  ).map(([_l, _lp, s, _rp, _r]) => s)
   .assert(s => s.tag !== 'negation' && s.tag !== 'letter', 'Parentheses only allowed around binary connectives'),

  Letter: () => P.regexp(/[A-Z]/)
    .map((id) => letter(id, 0)),

  Not: (r) => P.seq(alt_strings(connectives.negation), P.optWhitespace, r.Factor)
    .map(([_1, _2, s]) => not(s)),

  And: (r) => r.Factor.sepBy(P.seq(P.optWhitespace, alt_strings(connectives.conjunction), P.optWhitespace))
    .assert((operands) => operands.length === 2, 'Explicit grouping required (use parentheses)')
    .map(([left, right]) => and(left, right)),

  Or: (r) => r.Factor.sepBy(P.seq(P.optWhitespace, alt_strings(connectives.disjunction), P.optWhitespace))
    .assert((operands) => operands.length === 2, 'Explicit grouping required (use parentheses)')
    .map(([left, right]) => or(left, right)),

  Imp: (r) => r.Factor.sepBy(P.seq(P.optWhitespace, alt_strings(connectives.conditional), P.optWhitespace))
    .assert((operands) => operands.length === 2, 'Explicit grouping required (use parentheses)')
    .map(([left, right]) => imp(left, right)),

  Iff: (r) => r.Factor.sepBy(P.seq(P.optWhitespace, alt_strings(connectives.biconditional), P.optWhitespace))
    .assert((operands) => operands.length === 2, 'Explicit grouping required (use parentheses)')
    .map(([left, right]) => iff(left, right)),

  Xor: (r) => r.Factor.sepBy(P.seq(P.optWhitespace, alt_strings(connectives.xor), P.optWhitespace))
    .assert((operands) => operands.length === 2, 'Explicit grouping required (use parentheses)')
    .map(([left, right]) => xor(left, right)),

  Nand: (r) => r.Factor.sepBy(P.seq(P.optWhitespace, alt_strings(connectives.nand), P.optWhitespace))
    .assert((operands) => operands.length === 2, 'Explicit grouping required (use parentheses)')
    .map(([left, right]) => nand(left, right)),
})


function diagnoseError(_input: string, parseResult: P.Result<Sentence>): string {
  if (parseResult.status) return ''
  return 'Syntax error (not a wff).'
}

export const parse_sentence = (input: string): Res<Sentence, string> => {
  const trimmed = input.trim()
  const parsed = SentenceLang.Sentence.parse(trimmed)
  if (!parsed.status) {
    return [false, diagnoseError(input, parsed)]
  } else {
    return [true, parsed.value]
  }
}
