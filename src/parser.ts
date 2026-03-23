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

type BinaryBuilder = (left: Sentence, right: Sentence) => Sentence

const SentenceLang = P.createLanguage({
  Sentence: (r) => P.alt(r.Binary, r.Factor),

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

  BinaryOp: () => P.alt(
    alt_strings(connectives.biconditional).result(iff as BinaryBuilder),
    alt_strings(connectives.conditional).result(imp as BinaryBuilder),
    alt_strings(connectives.disjunction).result(or as BinaryBuilder),
    alt_strings(connectives.conjunction).result(and as BinaryBuilder),
    alt_strings(connectives.xor).result(xor as BinaryBuilder),
    alt_strings(connectives.nand).result(nand as BinaryBuilder),
  ),

  Binary: (r) => r.Factor.chain((first: Sentence) =>
    P.seq(P.optWhitespace, r.BinaryOp, P.optWhitespace, r.Factor)
      .atLeast(1)
      .assert((pairs) => pairs.length === 1, 'Explicit grouping required (use parentheses)')
      .map(([[_1, builder, _2, second]]) => builder(first, second))
  ),
})


function diagnoseError(parseResult: P.Result<Sentence>): string {
  if (parseResult.status) return ''
  return 'Syntax error (not a wff).'
}

export const parse_sentence = (input: string): Res<Sentence, string> => {
  const trimmed = input.trim()
  const parsed = SentenceLang.Sentence.parse(trimmed)
  if (!parsed.status) {
    return [false, diagnoseError(parsed)]
  } else {
    return [true, parsed.value]
  }
}
