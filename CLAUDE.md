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
```

Deploy by uploading the `truthtable/` directory to a static hosting server.

## Architecture

**Parser (`src/parser.ts`)**: Parsimmon-based parser for propositional logic. Atoms are single capital letters A-Z. Connectives: `~` (not), `&` (and), `v` (or), `->` (conditional), `<->` (biconditional), `+` (XOR), `|` (NAND). Explicit grouping with parentheses is required for chained binary connectives (no precedence/associativity assumptions).

**Types (`src/types.ts`)**: Sentence AST with tagged union type (`letter`, `negation`, `conjunction`, `disjunction`, `conditional`, `biconditional`, `xor`, `nand`). Includes builders in `sentence` object and string conversion functions.

**Truth Table (`src/truth_table.ts`)**: Generates truth tables by evaluating formulas across all variable assignments.

**Formula Layout (`src/formula_layout.ts`)**: Token-based layout system for "quasi-columns" showing intermediate sub-formula values. Each token is either text (parens, connective symbols) or a value (evaluation point).

**MathML Rendering (`src/sentence_to_html.ts`)**: Converts sentences to MathML elements for proper mathematical typography.

**UI (`src/main.ts`)**: Full UI re-renders on state change via `render()` function. Key state: `formulas` (parsed inputs), `currentResult` (generated table), `currentMode` ('calculator' | 'quiz'), `userAnswers` (quiz answers), `cellStatuses` (validation results).

**DOM Helpers (`src/el.ts`)**: `el()` for HTML elements, `math_el()` for MathML elements.

## Quiz Mode Dependencies

In quiz mode, cells are locked (show "?") until prerequisite sub-formulas are filled. Dependency tracking uses `sentence_to_string_compact()` to identify sub-formulas.
