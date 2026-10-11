# TTG — Truth Table Generator

A web-based truth table generator for propositional logic, designed for educational use in logic courses. Live at [fitelson.org/truthtable](https://fitelson.org/truthtable/).

## Features

- **Calculator mode** — enter formulas, see computed truth values
- **Quiz mode** — students fill in truth values with validation and dependency tracking (Carnap-inspired)
- **Quasi-columns** — toggle display of intermediate sub-formula values
- **MathML rendering** — proper mathematical typography for connectives
- **PNG export** — save truth tables as images
- **Connective reference** — floating panel with definitions

## Syntax

- **Atoms:** single uppercase letters `A`–`Z`
- **Negation:** `~P`
- **Conjunction:** `P & Q`
- **Disjunction:** `P v Q`
- **Conditional:** `P -> Q`
- **Biconditional:** `P <-> Q`
- **XOR:** `P + Q`
- **NAND:** `P | Q`
- **Grouping:** `()`, `[]`, or `{}`

Chained binary connectives require explicit grouping (e.g., `(P v Q) v R`, not `P v Q v R`).

## Build

Requires Node.js `^22.22.2`, `^24.15.0`, or `>=26.0.0`; the repository records npm 12.2.0 as its package manager.

```bash
npm install
npm run dev       # development server
npm run build     # production build (outputs to truthtable/)
npm run test      # run tests
npm audit         # audit production and development dependencies
```

The Vitest suite includes DOM-level regression coverage through jsdom for formula replacement/removal and quiz dependency state transitions.

## Deployment

```bash
npm run build
scp -r truthtable/* fitelson.org:/home/fitelson/www/www/truthtable/
```

## Tech Stack

TypeScript, Vite, Parsimmon (parser), html-to-image (PNG export). No framework — vanilla TypeScript/DOM.

## Acknowledgments

Quiz mode is inspired by [Carnap](https://carnap.io), a free and open-source framework for formal logic education created by Graham Leach-Krouse, licensed under [GPL v3](https://www.gnu.org/licenses/gpl-3.0.html).

## License

[GPL v3](LICENSE)
