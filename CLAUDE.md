# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

TTG (Truth Table Generator) is a web-based truth table generator for propositional logic (LSL), built with TypeScript and Vite. It has two modes: Calculator (computes values) and Quiz (students fill in values with validation).

## Build Commands

```bash
npm install          # Install dependencies
npm run dev          # Development server with hot reload
npm run build        # Production build (outputs to truthtable/)
npm run preview      # Preview production build locally
npm run test         # Run test suite (vitest)
```

Deploy to production:

```bash
npm run build
scp -r truthtable/* fitelson.org:/home/fitelson/www/www/truthtable/
```

## Architecture

**Parser (`src/parser.ts`)**: Parsimmon-based parser for propositional logic. Atoms are single capital letters A-Z. Connectives: `~` (not), `&` (and), `v` (or), `->` (conditional), `<->` (biconditional), `+` (XOR), `|` (NAND). Explicit grouping with parentheses is required for chained binary connectives (no precedence/associativity assumptions). Uses a single `Binary` rule with a `BinaryOp` sub-rule for all binary connectives.

**Types (`src/types.ts`)**: Sentence AST with tagged union type (`letter`, `negation`, `conjunction`, `disjunction`, `conditional`, `biconditional`, `xor`, `nand`). Includes builders in `sentence` object and string conversion functions.

**Truth Table (`src/truth_table.ts`)**: Generates truth tables by evaluating formulas across all variable assignments. `LetterSet` maintains sorted order internally. Browser-facing generation is capped at 12 variables via `MAX_TRUTH_TABLE_VARIABLES`; the UI catches the error and displays it in the output section.

**Formula Layout (`src/formula_layout.ts`)**: Token-based layout system for "quasi-columns" showing intermediate sub-formula values. Each token is either text (parens, connective symbols) or a value (evaluation point). Binary connective symbols use a shared `binarySymbols` lookup table. Quasi-column numbering is continuous across multiple formulas (counter is shared, not per-formula). Quiz dependency maps are built from actual subformula object occurrences within each formula, not global string keys, so duplicate subformulas in other formulas do not collide.

**MathML Rendering (`src/sentence_to_html.ts`)**: Converts sentences to MathML elements for proper mathematical typography.

**UI (`src/main.ts`)**: Full UI re-renders on state change via `render()` function with focus preservation. All application state is consolidated in a single typed `AppState` object. Key state fields: `formulas` (parsed inputs), `currentResult` (generated table), `currentMode` ('calculator' | 'quiz'), `userAnswers` (quiz answers), `cellStatuses` (validation results). Includes a "Copy Formulae to Clipboard" button that appears when 2+ formulas have text entered.

**DOM Helpers (`src/el.ts`)**: `el()` for HTML elements, `math_el()` for MathML elements.

## Testing

Tests use vitest and live alongside source files (`src/*.test.ts`). Test suites cover the parser, evaluator, types, and formula layout modules.

## Quiz Mode Dependencies

In quiz mode, cells are locked (show "?") until prerequisite sub-formulas are filled. Dependency tracking is built by `buildCellDependencies(layouts)` in `src/formula_layout.ts` and returns dependency cell keys in `"formulaIdx-tokenIdx"` form. Quiz state should be reset whenever generating a new table or clearing the current table to avoid stale answer/status maps reusing old cell IDs.

## Recent Fixes

- 2026-10-11: upgraded every direct dependency to its current npm release: TypeScript 7.0.2, Vite 8.3.4, Vitest 5.0.3, jsdom 30.1.2, `@types/parsimmon` 1.10.9, `html-to-image` 1.11.13, and Parsimmon 1.18.1. Added explicit Node/npm requirements and approved only the current `fsevents` watcher install script. Verified with 85 tests, a production build, an empty top-level `npm outdated` report, and a zero-vulnerability audit.
- 2026-07-11: commit `93857d3` fixed stale truth-table output after removing or batch-replacing formulas, made quiz prerequisite changes clear all transitive dependent answers/statuses, corrected the PNG-export error message, added DOM regression tests, and upgraded the audited Vite toolchain. It is pushed to `origin/main` and deployed to `fitelson.org/truthtable`; verification passed with 84 tests, a production build, a zero-vulnerability `npm audit`, and exact local/live HTML, JavaScript, and CSS hash matches.
- 2026-06-10: commit `038cc71` fixed large-table freezes, stale quiz state across recalculation, and duplicate-subformula dependency collisions. Verified with `npm test`, `npm run build`, and browser checks for the 13-atom guard plus `(A & B) -> C` / `A & B` quiz dependency behavior; deployed to `fitelson.org/truthtable`.
