import './style.css'
import { el } from './el'
import { parse_sentence } from './parser'
import { generate_truth_table, TruthTableResult } from './truth_table'
import { Sentence, letter_string, Letter, sentence_to_string_compact } from './types'
import { layoutFormula, FormulaLayout, evaluateLayout } from './formula_layout'
import { sentence_to_html, letter_to_html, token_to_html } from './sentence_to_html'
import { toPng } from 'html-to-image'

// Application state
type FormulaInput = {
  text: string
  parsed: Sentence | null
  error: string | null
  warning: string | null
}

type QuizMode = 'calculator' | 'quiz'

type AppState = {
  formulas: FormulaInput[]
  currentResult: TruthTableResult | null
  showQuasiColumns: boolean
  batchMode: boolean
  batchText: string
  highlightedRows: Set<number>
  showConnectiveRef: boolean
  connectiveRefPosition: { left: number, top: number } | null
  currentMode: QuizMode
  userAnswers: Map<string, 'T' | 'F'>
  cellStatuses: Map<string, 'correct' | 'incorrect'>
  quizChecked: boolean
  answersRevealed: boolean
  savedAnswersBeforeReveal: Map<string, 'T' | 'F'>
  savedStatusesBeforeReveal: Map<string, 'correct' | 'incorrect'>
  savedQuizCheckedBeforeReveal: boolean
}

const state: AppState = {
  formulas: [{ text: '', parsed: null, error: null, warning: null }],
  currentResult: null,
  showQuasiColumns: true,
  batchMode: false,
  batchText: '',
  highlightedRows: new Set(),
  showConnectiveRef: false,
  connectiveRefPosition: null,
  currentMode: 'calculator',
  userAnswers: new Map(),
  cellStatuses: new Map(),
  quizChecked: false,
  answersRevealed: false,
  savedAnswersBeforeReveal: new Map(),
  savedStatusesBeforeReveal: new Map(),
  savedQuizCheckedBeforeReveal: false,
}

function resetQuizState() {
  state.userAnswers.clear()
  state.cellStatuses.clear()
  state.quizChecked = false
  state.answersRevealed = false
  state.savedAnswersBeforeReveal.clear()
  state.savedStatusesBeforeReveal.clear()
  state.savedQuizCheckedBeforeReveal = false
}

// DOM references
const app = (() => {
  const el = document.getElementById('app')
  if (!el) throw new Error('Missing #app element in document')
  return el
})()

// Create assignment lookup from a row's assignment map
function makeLookup(assignment: Map<string, boolean>): (l: Letter) => boolean {
  return (l: Letter): boolean => {
    const val = assignment.get(letter_string(l))
    if (val === undefined) throw new Error(`Letter ${letter_string(l)} not found`)
    return val
  }
}

// Render the entire UI
function render() {
  // Save focus state
  const activeEl = document.activeElement
  let focusInfo:
    | { type: 'input', index: number, selStart: number | null, selEnd: number | null }
    | { type: 'select', cellId: string }
    | null = null

  if (activeEl instanceof HTMLInputElement && activeEl.closest('.formula-row')) {
    const rows = Array.from(document.querySelectorAll('.formula-row'))
    const rowIndex = rows.indexOf(activeEl.closest('.formula-row')!)
    focusInfo = {
      type: 'input',
      index: rowIndex,
      selStart: activeEl.selectionStart,
      selEnd: activeEl.selectionEnd,
    }
  } else if (activeEl instanceof HTMLSelectElement && activeEl.dataset.cellId) {
    focusInfo = { type: 'select', cellId: activeEl.dataset.cellId }
  }

  // Re-render
  app.innerHTML = ''
  app.appendChild(renderHeader())
  app.appendChild(renderInputSection())
  app.appendChild(renderOutputSection())
  if (state.showConnectiveRef) {
    app.appendChild(renderConnectiveRefModal())
  }

  // Restore focus
  if (focusInfo?.type === 'input') {
    const inputs = document.querySelectorAll('.formula-row input[type="text"]')
    const input = inputs[focusInfo.index] as HTMLInputElement | undefined
    if (input) {
      input.focus()
      if (focusInfo.selStart !== null && focusInfo.selEnd !== null) {
        input.setSelectionRange(focusInfo.selStart, focusInfo.selEnd)
      }
    }
  } else if (focusInfo?.type === 'select') {
    const select = document.querySelector(`select[data-cell-id="${focusInfo.cellId}"]`) as HTMLSelectElement | undefined
    select?.focus()
  }
}

function renderHeader(): HTMLElement {
  return el('div', { class: 'header' },
    el('h1', {}, 'Truth Table Generator'),
    el('p', {}, 'Enter LSL formulae and generate (or quiz yourself on calculating) their truth tables.')
  )
}

function renderInputSection(): HTMLElement {
  const section = el('div', { class: 'input-section' })

  // Header with batch mode button
  const header = el('div', { class: 'input-header' },
    el('h2', {}, 'Formulae')
  )

  const batchBtn = document.createElement('button')
  batchBtn.className = 'batch-toggle'
  batchBtn.textContent = state.batchMode ? 'Hide Batch Input' : 'Show Batch Input'
  batchBtn.addEventListener('click', () => {
    state.batchMode = !state.batchMode
    if (!state.batchMode) {
      state.batchText = ''
    }
    render()
  })
  header.appendChild(batchBtn)

  const clearBtn = document.createElement('button')
  clearBtn.className = 'batch-toggle'
  clearBtn.textContent = 'Clear'
  clearBtn.style.marginLeft = '0.5em'
  clearBtn.addEventListener('click', () => {
    state.formulas = [{ text: '', parsed: null, error: null, warning: null }]
    state.batchText = ''
    state.currentResult = null
    render()
  })
  header.appendChild(clearBtn)

  section.appendChild(header)

  if (state.batchMode) {
    // Batch mode: textarea to enter multiple formulas at once (shown above individual inputs)
    const batchContainer = el('div', { class: 'batch-container' })

    const textarea = document.createElement('textarea')
    textarea.className = 'batch-input'
    textarea.value = state.batchText
    textarea.placeholder = 'Enter one formula per line, e.g.:\nA -> B\n~A v B\nA <-> B'
    textarea.rows = 6
    textarea.addEventListener('input', (e) => {
      state.batchText = (e.target as HTMLTextAreaElement).value
    })
    batchContainer.appendChild(textarea)

    // Load button to populate individual fields
    const loadBtn = document.createElement('button')
    loadBtn.className = 'add'
    loadBtn.textContent = 'Load Formulae'
    loadBtn.style.marginTop = '0.5em'
    loadBtn.style.marginRight = '0.5em'
    loadBtn.addEventListener('click', () => {
      const lines = state.batchText.split('\n').filter(l => l.trim())
      if (lines.length > 0) {
        state.formulas = lines.map(text => ({ text, parsed: null, error: null, warning: null }))
        state.formulas.forEach((_, i) => validateFormula(i))
      }
      state.batchMode = false
      state.batchText = ''
      render()
    })
    batchContainer.appendChild(loadBtn)
    section.appendChild(batchContainer)
  }

  // Individual formula inputs (always shown)
  const inputsContainer = el('div', { class: 'formula-inputs' })

    state.formulas.forEach((formula, index) => {
      const row = el('div', { class: `formula-row${formula.error ? ' has-error' : ''}` })

      const input = document.createElement('input')
      input.type = 'text'
      input.value = formula.text
      input.placeholder = `Formula ${index + 1} (e.g., A -> B)`
      input.addEventListener('input', (e) => {
        state.formulas[index].text = (e.target as HTMLInputElement).value
        validateFormula(index)
        renderFormulaRow(row, index)
        updateGenerateButton()
        clearTruthTable()
      })

      row.appendChild(input)

      // Show parsed formula or error or warning
      if (formula.error) {
        row.appendChild(el('span', { class: 'error-msg' }, formula.error))
      } else if (formula.parsed) {
        const parsedSpan = el('span', { class: 'parsed-formula' })
        parsedSpan.appendChild(sentence_to_html(formula.parsed))
        row.appendChild(parsedSpan)
        if (formula.warning) {
          row.appendChild(el('span', { class: 'warning-msg' }, formula.warning))
        }
      }

      if (state.formulas.length > 1) {
        const removeBtn = document.createElement('button')
        removeBtn.className = 'remove'
        removeBtn.textContent = '\u00D7'
        removeBtn.title = 'Remove formula'
        removeBtn.addEventListener('click', () => {
          state.formulas.splice(index, 1)
          render()
        })
        row.appendChild(removeBtn)
      }

      inputsContainer.appendChild(row)
    })

    section.appendChild(inputsContainer)

    // Add formula button
    const addBtn = document.createElement('button')
    addBtn.className = 'add'
    addBtn.textContent = '+ Add Formula'
    addBtn.style.marginTop = '0.5em'
    addBtn.addEventListener('click', () => {
      state.formulas.push({ text: '', parsed: null, error: null, warning: null })
      render()
    })
    section.appendChild(addBtn)

    const nonEmptyTexts = state.formulas.filter(f => f.text.trim() !== '').map(f => f.text.trim())
    if (nonEmptyTexts.length > 1) {
      const copyBtn = document.createElement('button')
      copyBtn.className = 'add'
      copyBtn.textContent = 'Copy Formulae to Clipboard'
      copyBtn.style.marginTop = '0.5em'
      copyBtn.style.marginLeft = '0.5em'
      copyBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(nonEmptyTexts.join('\n')).then(() => {
          copyBtn.textContent = 'Copied!'
          setTimeout(() => { copyBtn.textContent = 'Copy Formulae to Clipboard' }, 1500)
        }).catch(() => {
          copyBtn.textContent = 'Copy failed'
          setTimeout(() => { copyBtn.textContent = 'Copy Formulae to Clipboard' }, 1500)
        })
      })
      section.appendChild(copyBtn)
    }

  // Mode toggle (Calculator / Quiz)
  const modeContainer = el('div', { class: 'mode-toggle' })

  const calculatorBtn = document.createElement('button')
  calculatorBtn.className = `mode-btn ${state.currentMode === 'calculator' ? 'active' : ''}`
  calculatorBtn.textContent = 'Calculator'
  calculatorBtn.addEventListener('click', () => {
    if (state.currentMode !== 'calculator') {
      state.currentMode = 'calculator'
      resetQuizState()
      render()
    }
  })
  modeContainer.appendChild(calculatorBtn)

  const quizBtn = document.createElement('button')
  quizBtn.className = `mode-btn ${state.currentMode === 'quiz' ? 'active' : ''}`
  quizBtn.textContent = 'Quiz'
  quizBtn.addEventListener('click', () => {
    if (state.currentMode !== 'quiz') {
      state.currentMode = 'quiz'
      resetQuizState()
      render()
    }
  })
  modeContainer.appendChild(quizBtn)

  section.appendChild(modeContainer)

  // Generate button
  const generateBtn = document.createElement('button')
  generateBtn.className = 'generate'
  generateBtn.textContent = state.currentMode === 'calculator' ? 'Calculate Truth Table(s)' : 'Start Quiz'
  const nonEmptyFormulas = state.formulas.filter(f => f.text.trim() !== '')
  const allValid = nonEmptyFormulas.length > 0 && nonEmptyFormulas.every(f => f.parsed !== null)
  generateBtn.disabled = !allValid
  generateBtn.addEventListener('click', calculateTruthTables)
  section.appendChild(generateBtn)

  // Connective definitions button
  const refBtn = document.createElement('button')
  refBtn.className = 'add'
  refBtn.textContent = 'Show Definitions of Connectives'
  refBtn.style.marginTop = '0.5em'
  refBtn.style.marginLeft = '0.5em'
  refBtn.addEventListener('click', () => {
    state.showConnectiveRef = true
    render()
  })
  section.appendChild(refBtn)

  // Syntax help
  section.appendChild(renderSyntaxHelp())

  return section
}

function renderFormulaRow(row: HTMLElement, index: number) {
  const formula = state.formulas[index]
  row.className = `formula-row${formula.error ? ' has-error' : ''}${formula.warning ? ' has-warning' : ''}`

  // Remove existing error/parsed/warning display
  const existingError = row.querySelector('.error-msg')
  const existingParsed = row.querySelector('.parsed-formula')
  const existingWarning = row.querySelector('.warning-msg')
  existingError?.remove()
  existingParsed?.remove()
  existingWarning?.remove()

  const input = row.querySelector('input')!

  // Show parsed formula or error after input
  if (formula.error) {
    const errorSpan = el('span', { class: 'error-msg' }, formula.error)
    input.after(errorSpan)
  } else if (formula.parsed) {
    const parsedSpan = el('span', { class: 'parsed-formula' })
    parsedSpan.appendChild(sentence_to_html(formula.parsed))
    input.after(parsedSpan)
    if (formula.warning) {
      const warningSpan = el('span', { class: 'warning-msg' }, formula.warning)
      parsedSpan.after(warningSpan)
    }
  }
}

function renderSyntaxHelp(): HTMLElement {
  const container = el('div', { class: 'syntax-help' },
    el('strong', {}, 'Syntax: '),
    'Atoms: ', el('code', {}, 'A'), ', ', el('code', {}, 'B'), ', ', el('code', {}, 'C'), ', etc. ',
    'Not: ', el('code', {}, '~'), '. ',
    'And: ', el('code', {}, '&'), '. ',
    'Or: ', el('code', {}, 'v'), '. ',
    'If: ', el('code', {}, '->'), '. ',
    'Iff: ', el('code', {}, '<->'), '. ',
    'XOR: ', el('code', {}, '+'), '. ',
    'NAND: ', el('code', {}, '|'), '. ',
    'Grouping: ', el('code', {}, '()'), ', ', el('code', {}, '[]'), ', or ', el('code', {}, '{}'),
  )

  return container
}

function renderConnectiveRefModal(): HTMLElement {
  const modal = el('div', { class: 'floating-panel' })

  // Apply saved position if available
  if (state.connectiveRefPosition) {
    modal.style.left = `${state.connectiveRefPosition.left}px`
    modal.style.top = `${state.connectiveRefPosition.top}px`
    modal.style.right = 'auto'
  }

  // Header (draggable)
  const header = el('div', { class: 'modal-header' },
    el('h3', {}, 'Connective Definitions')
  )

  const closeBtn = document.createElement('button')
  closeBtn.className = 'modal-close'
  closeBtn.innerHTML = '&times;'
  closeBtn.addEventListener('click', () => {
    state.showConnectiveRef = false
    state.connectiveRefPosition = null
    render()
  })
  header.appendChild(closeBtn)

  // Make modal draggable — listeners added only during drag to avoid leaks
  header.addEventListener('mousedown', (e) => {
    const rect = modal.getBoundingClientRect()
    const offsetX = e.clientX - rect.left
    const offsetY = e.clientY - rect.top
    modal.style.left = `${rect.left}px`
    modal.style.top = `${rect.top}px`
    modal.style.right = 'auto'

    const onMouseMove = (ev: MouseEvent) => {
      const newLeft = ev.clientX - offsetX
      const newTop = ev.clientY - offsetY
      modal.style.left = `${newLeft}px`
      modal.style.top = `${newTop}px`
      state.connectiveRefPosition = { left: newLeft, top: newTop }
    }

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
    }

    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
  })

  modal.appendChild(header)

  // Body with connective tables
  const body = el('div', { class: 'modal-body' })

  // Row 1: Negation, Conjunction, Disjunction
  const row1 = el('div', { class: 'connective-row' })
  row1.appendChild(renderConnectiveCard('Negation (~)', ['P', '~P'], [
    ['⊤', '⊥'],
    ['⊥', '⊤']
  ]))
  row1.appendChild(renderConnectiveCard('Conjunction (&)', ['P', 'Q', 'P & Q'], [
    ['⊤', '⊤', '⊤'],
    ['⊤', '⊥', '⊥'],
    ['⊥', '⊤', '⊥'],
    ['⊥', '⊥', '⊥']
  ]))
  row1.appendChild(renderConnectiveCard('Disjunction (v)', ['P', 'Q', 'P v Q'], [
    ['⊤', '⊤', '⊤'],
    ['⊤', '⊥', '⊤'],
    ['⊥', '⊤', '⊤'],
    ['⊥', '⊥', '⊥']
  ]))
  body.appendChild(row1)

  // Row 2: Conditional, Biconditional (centered)
  const row2 = el('div', { class: 'connective-row centered' })
  row2.appendChild(renderConnectiveCard('Conditional (->)', ['P', 'Q', 'P -> Q'], [
    ['⊤', '⊤', '⊤'],
    ['⊤', '⊥', '⊥'],
    ['⊥', '⊤', '⊤'],
    ['⊥', '⊥', '⊤']
  ]))
  row2.appendChild(renderConnectiveCard('Biconditional (<->)', ['P', 'Q', 'P <-> Q'], [
    ['⊤', '⊤', '⊤'],
    ['⊤', '⊥', '⊥'],
    ['⊥', '⊤', '⊥'],
    ['⊥', '⊥', '⊤']
  ]))
  body.appendChild(row2)

  // Divider
  body.appendChild(el('div', { class: 'connective-divider' }))

  // Row 3: XOR, NAND (centered)
  const row3 = el('div', { class: 'connective-row centered' })
  row3.appendChild(renderConnectiveCard('XOR (+)', ['P', 'Q', 'P + Q'], [
    ['⊤', '⊤', '⊥'],
    ['⊤', '⊥', '⊤'],
    ['⊥', '⊤', '⊤'],
    ['⊥', '⊥', '⊥']
  ]))
  row3.appendChild(renderConnectiveCard('NAND (|)', ['P', 'Q', 'P | Q'], [
    ['⊤', '⊤', '⊥'],
    ['⊤', '⊥', '⊤'],
    ['⊥', '⊤', '⊤'],
    ['⊥', '⊥', '⊤']
  ]))
  body.appendChild(row3)
  modal.appendChild(body)

  return modal
}

function renderConnectiveCard(title: string, headers: string[], rows: string[][]): HTMLElement {
  const card = el('div', { class: 'connective-card' })
  card.appendChild(el('h4', {}, title))

  const table = document.createElement('table')
  const thead = document.createElement('thead')
  const headerRow = document.createElement('tr')
  headers.forEach(h => {
    const th = document.createElement('th')
    th.textContent = h
    headerRow.appendChild(th)
  })
  thead.appendChild(headerRow)
  table.appendChild(thead)

  const tbody = document.createElement('tbody')
  rows.forEach(row => {
    const tr = document.createElement('tr')
    row.forEach(cell => {
      const td = document.createElement('td')
      td.textContent = cell
      tr.appendChild(td)
    })
    tbody.appendChild(tr)
  })
  table.appendChild(tbody)

  card.appendChild(table)
  return card
}

// Export functions
async function downloadAsImage() {
  const table = document.querySelector('table.truth-table') as HTMLElement
  if (!table) return

  // Create a wrapper div with padding to ensure full capture
  const wrapper = document.createElement('div')
  wrapper.style.display = 'inline-block'
  wrapper.style.padding = '16px'
  wrapper.style.backgroundColor = '#ffffff'
  wrapper.style.position = 'fixed'
  wrapper.style.left = '0'
  wrapper.style.top = '0'
  wrapper.style.zIndex = '9999'

  // Clone the table into the wrapper
  const tableClone = table.cloneNode(true) as HTMLElement
  wrapper.appendChild(tableClone)

  // Add wrapper to body
  document.body.appendChild(wrapper)

  try {
    // Force reflow
    await new Promise(resolve => setTimeout(resolve, 50))

    const dataUrl = await toPng(wrapper, {
      backgroundColor: '#ffffff',
      pixelRatio: 2
    })

    const link = document.createElement('a')
    link.download = 'truth-table.png'
    link.href = dataUrl
    link.click()
  } catch (error) {
    console.error('Failed to generate image:', error)
    alert('Failed to generate image. Please try the PDF option instead.')
  } finally {
    // Remove the wrapper
    document.body.removeChild(wrapper)
  }
}

function renderOutputSection(): HTMLElement {
  const section = el('div', { class: 'output-section' })

  // Header with title and download button
  const header = el('div', { class: 'output-header' },
    el('h2', {}, 'Truth Table(s)')
  )

  if (state.currentResult) {
    // Download button on the right
    const imageBtn = document.createElement('button')
    imageBtn.className = 'download-btn'
    imageBtn.textContent = 'Save as Image'
    imageBtn.title = 'Download as PNG image'
    imageBtn.addEventListener('click', downloadAsImage)
    header.appendChild(imageBtn)
  }

  section.appendChild(header)

  if (!state.currentResult) {
    section.appendChild(el('div', { class: 'placeholder' },
      'Enter formulae above and click "Calculate Truth Table(s)" to see the results.',
      el('br', {}),
      'Or click "Start Quiz" to generate a Truth Table Self-Quiz for those formulae.'
    ))
    return section
  }

  // Centered toggle for quasi-columns (only in calculator mode)
  if (state.currentMode === 'calculator') {
    const toggleContainer = el('div', { class: 'toggle-container' })
    const toggleLabel = el('label', { class: 'toggle-label' })
    const checkbox = document.createElement('input')
    checkbox.type = 'checkbox'
    checkbox.checked = state.showQuasiColumns
    checkbox.addEventListener('change', () => {
      state.showQuasiColumns = checkbox.checked
      render()
    })
    toggleLabel.appendChild(checkbox)
    toggleLabel.appendChild(document.createTextNode(' Show Quasi-Columns'))
    toggleContainer.appendChild(toggleLabel)
    section.appendChild(toggleContainer)
  }

  // Quiz controls (only in quiz mode with a result)
  if (state.currentMode === 'quiz') {
    section.appendChild(renderQuizControls())
  }

  section.appendChild(renderTruthTable(state.currentResult))
  return section
}

function getQuizStats(): { total: number, filled: number, correct: number, incorrect: number } {
  if (!state.currentResult) return { total: 0, filled: 0, correct: 0, incorrect: 0 }

  const layouts = state.currentResult.formulas.map(f => layoutFormula(f))
  let total = 0
  let filled = 0
  let correct = 0
  let incorrect = 0

  state.currentResult.rows.forEach((_row, rowIdx) => {
    // Skip rows not selected for quiz

    layouts.forEach((layout, formulaIdx) => {
      layout.tokens.forEach((token, tokenIdx) => {
        if (token.type !== 'value') return
        const isMain = token.isMain
        // In quiz mode, always show quasi-columns
        const effectiveShowQuasi = state.currentMode === 'quiz' ? true : state.showQuasiColumns
        const showValue = effectiveShowQuasi || isMain
        if (!showValue) return

        // Check configuration options
        const isAtomicLetter = token.subformula.tag === 'letter'
        if (isAtomicLetter) return  // Always auto-fill atomics

        const cellId = `${rowIdx}-${formulaIdx}-${tokenIdx}`
        total++
        if (state.userAnswers.has(cellId)) filled++
        const cellStatus = state.cellStatuses.get(cellId)
        if (cellStatus === 'correct') correct++
        else if (cellStatus === 'incorrect') incorrect++
      })
    })
  })

  return { total, filled, correct, incorrect }
}

function renderQuizControls(): HTMLElement {
  const controls = el('div', { class: 'quiz-controls' })

  // Action buttons
  const actions = el('div', { class: 'quiz-actions' })

  const checkBtn = document.createElement('button')
  checkBtn.className = 'quiz-btn check'
  checkBtn.textContent = 'Check Answers'
  checkBtn.addEventListener('click', checkAnswers)
  actions.appendChild(checkBtn)

  const revealBtn = document.createElement('button')
  revealBtn.className = `quiz-btn reveal ${state.answersRevealed ? 'active' : ''}`
  revealBtn.textContent = state.answersRevealed ? 'Hide Answers' : 'Reveal Answers'
  revealBtn.addEventListener('click', toggleRevealAnswers)
  actions.appendChild(revealBtn)

  const resetBtn = document.createElement('button')
  resetBtn.className = 'quiz-btn reset'
  resetBtn.textContent = 'Reset Quiz'
  resetBtn.addEventListener('click', () => {
    resetQuizState()
    render()
  })
  actions.appendChild(resetBtn)

  controls.appendChild(actions)

  // Statistics
  const stats = getQuizStats()
  const statsDiv = el('div', { class: 'quiz-stats' })

  const progressSpan = el('span', { class: 'quiz-stat' },
    `Progress: `,
    el('span', { class: 'quiz-stat-value' }, `${stats.filled}/${stats.total}`)
  )
  statsDiv.appendChild(progressSpan)

  if (state.quizChecked) {
    const scoreSpan = el('span', { class: 'quiz-stat' },
      ` | Score: `,
      el('span', { class: 'quiz-stat-value quiz-stat-correct' }, `${stats.correct}`),
      ` correct, `,
      el('span', { class: 'quiz-stat-value quiz-stat-incorrect' }, `${stats.incorrect}`),
      ` incorrect`
    )
    statsDiv.appendChild(scoreSpan)
  }

  controls.appendChild(statsDiv)

  return controls
}

function checkAnswers() {
  if (!state.currentResult) return

  state.cellStatuses.clear()
  const layouts = state.currentResult.formulas.map(f => layoutFormula(f))

  state.currentResult.rows.forEach((row, rowIdx) => {
    // Skip rows not selected for quiz

    const lookup = makeLookup(row.assignment)

    layouts.forEach((layout, formulaIdx) => {
      const evaluatedValues = evaluateLayout(layout, lookup)
      let valueIdx = 0

      layout.tokens.forEach((token, tokenIdx) => {
        if (token.type !== 'value') return

        const evalResult = evaluatedValues[valueIdx++]
        // In quiz mode, always show quasi-columns
        const effectiveShowQuasi = state.currentMode === 'quiz' ? true : state.showQuasiColumns
        const showValue = effectiveShowQuasi || evalResult.isMain
        if (!showValue) return

        // Check configuration options
        const isAtomicLetter = token.subformula.tag === 'letter'
        if (isAtomicLetter) return  // Always auto-fill atomics

        const cellId = `${rowIdx}-${formulaIdx}-${tokenIdx}`
        const userAnswer = state.userAnswers.get(cellId)

        if (userAnswer === undefined) {
          // Not filled - don't mark as correct or incorrect
          return
        }

        const correctAnswer = evalResult.value
        const isCorrect = (userAnswer === 'T') === correctAnswer
        state.cellStatuses.set(cellId, isCorrect ? 'correct' : 'incorrect')
      })
    })
  })

  state.quizChecked = true
  render()
}

function toggleRevealAnswers() {
  if (!state.currentResult) return

  if (state.answersRevealed) {
    // Hide answers - restore saved state
    state.userAnswers = new Map(state.savedAnswersBeforeReveal)
    state.cellStatuses = new Map(state.savedStatusesBeforeReveal)
    state.quizChecked = state.savedQuizCheckedBeforeReveal
    state.answersRevealed = false
    render()
    return
  }

  // Reveal answers - save current state first
  state.savedAnswersBeforeReveal = new Map(state.userAnswers)
  state.savedStatusesBeforeReveal = new Map(state.cellStatuses)
  state.savedQuizCheckedBeforeReveal = state.quizChecked

  const layouts = state.currentResult.formulas.map(f => layoutFormula(f))

  state.currentResult.rows.forEach((row, rowIdx) => {
    const lookup = makeLookup(row.assignment)

    layouts.forEach((layout, formulaIdx) => {
      const evaluatedValues = evaluateLayout(layout, lookup)
      let valueIdx = 0

      layout.tokens.forEach((token, tokenIdx) => {
        if (token.type !== 'value') return

        const evalResult = evaluatedValues[valueIdx++]
        // In quiz mode, always show quasi-columns
        const effectiveShowQuasi = state.currentMode === 'quiz' ? true : state.showQuasiColumns
        const showValue = effectiveShowQuasi || evalResult.isMain
        if (!showValue) return

        const isAtomicLetter = token.subformula.tag === 'letter'
        if (isAtomicLetter) return  // Always auto-fill atomics

        const cellId = `${rowIdx}-${formulaIdx}-${tokenIdx}`
        state.userAnswers.set(cellId, evalResult.value ? 'T' : 'F')
        state.cellStatuses.set(cellId, 'correct')
      })
    })
  })

  state.answersRevealed = true
  state.quizChecked = true
  render()
}

function renderQuizCell(
  cellId: string,
  evalResult: { value: boolean, isMain: boolean },
  classes: string[]
): HTMLElement {
  const td = el('td', { class: classes.join(' ') })
  const cellStatus = state.cellStatuses.get(cellId)
  const userAnswer = state.userAnswers.get(cellId)

  // Create dropdown
  const select = document.createElement('select')
  const selectClasses = ['quiz-select']
  if (cellStatus) selectClasses.push(cellStatus)
  if (evalResult.isMain) selectClasses.push('quiz-main')
  select.className = selectClasses.join(' ')
  select.dataset.cellId = cellId

  // Options: blank, T, F
  const options = [
    { value: '', text: '-' },
    { value: 'T', text: '\u22A4' },
    { value: 'F', text: '\u22A5' }
  ]

  options.forEach(opt => {
    const option = document.createElement('option')
    option.value = opt.value
    option.textContent = opt.text
    if ((opt.value === 'T' && userAnswer === 'T') ||
        (opt.value === 'F' && userAnswer === 'F') ||
        (opt.value === '' && userAnswer === undefined)) {
      option.selected = true
    }
    select.appendChild(option)
  })

  select.addEventListener('change', (e) => {
    const val = (e.target as HTMLSelectElement).value
    if (val === 'T') state.userAnswers.set(cellId, 'T')
    else if (val === 'F') state.userAnswers.set(cellId, 'F')
    else state.userAnswers.delete(cellId)

    // Clear status if answer changed after checking
    if (state.quizChecked) {
      state.cellStatuses.delete(cellId)
    }

    // Re-render to unlock dependent cells
    render()
  })

  td.appendChild(select)
  return td
}

function renderLockedCell(
  evalResult: { value: boolean, isMain: boolean },
  classes: string[]
): HTMLElement {
  const td = el('td', { class: classes.join(' ') })
  const span = document.createElement('span')
  span.className = `quiz-locked ${evalResult.isMain ? 'quiz-main' : ''}`
  span.textContent = '?'
  td.appendChild(span)
  return td
}

// Get the direct sub-formulas that a connective depends on
function getSubformulaDependencies(s: Sentence): Sentence[] {
  switch (s.tag) {
    case 'value':
    case 'letter':
      return []
    case 'negation':
      return s.sentence.tag === 'letter' || s.sentence.tag === 'value' ? [] : [s.sentence]
    default:
      // Binary connectives
      const deps: Sentence[] = []
      if (s.left.tag !== 'letter' && s.left.tag !== 'value') deps.push(s.left)
      if (s.right.tag !== 'letter' && s.right.tag !== 'value') deps.push(s.right)
      return deps
  }
}

function renderTruthTable(result: TruthTableResult): HTMLElement {
  // In quiz mode, always show quasi-columns
  const effectiveShowQuasi = state.currentMode === 'quiz' ? true : state.showQuasiColumns

  const classes = ['truth-table']
  if (effectiveShowQuasi) classes.push('show-quasi')
  if (result.formulas.length > 1) classes.push('multi-formula')
  const table = el('table', { class: classes.join(' ') })

  // Pre-compute layouts for all formulas
  const layouts: FormulaLayout[] = result.formulas.map(f => layoutFormula(f))

  // Build a map from subformula key to cell location (for dependency tracking)
  // Key: sentence_to_string_compact of subformula
  // Value: { formulaIdx, tokenIdx }
  const subformulaToCell = new Map<string, { formulaIdx: number, tokenIdx: number }>()
  layouts.forEach((layout, formulaIdx) => {
    layout.tokens.forEach((token, tokenIdx) => {
      if (token.type === 'value' && token.subformula.tag !== 'letter' && token.subformula.tag !== 'value') {
        const key = sentence_to_string_compact(token.subformula)
        subformulaToCell.set(key, { formulaIdx, tokenIdx })
      }
    })
  })

  // Build dependency map: cellKey -> array of cellKeys it depends on
  const cellDependencies = new Map<string, string[]>()
  layouts.forEach((layout, formulaIdx) => {
    layout.tokens.forEach((token, tokenIdx) => {
      if (token.type === 'value' && token.subformula.tag !== 'letter' && token.subformula.tag !== 'value') {
        const deps = getSubformulaDependencies(token.subformula)
        const depCellKeys: string[] = []
        for (const dep of deps) {
          const depKey = sentence_to_string_compact(dep)
          const depCell = subformulaToCell.get(depKey)
          if (depCell) {
            // Dependency cell key format: "formulaIdx-tokenIdx" (row will be added when checking)
            depCellKeys.push(`${depCell.formulaIdx}-${depCell.tokenIdx}`)
          }
        }
        const cellKey = `${formulaIdx}-${tokenIdx}`
        cellDependencies.set(cellKey, depCellKeys)
      }
    })
  })

  // Header rows
  const thead = el('thead', {})

  // Number row (above formula headers) - only when quasi-columns are shown
  if (effectiveShowQuasi) {
    const numberRow = el('tr', { class: 'quasi-number-row' })

    // Empty cells for variable columns
    result.letters.forEach((_, i) => {
      const isLast = i === result.letters.length - 1
      numberRow.appendChild(el('th', isLast ? { class: 'separator' } : {}))
    })

    // Numbered cells for formula quasi-columns
    let valueNum = 1
    layouts.forEach((layout, formulaIdx) => {
      const isLastFormula = formulaIdx === layouts.length - 1
      layout.tokens.forEach((token, tokenIdx) => {
        const isLastToken = tokenIdx === layout.tokens.length - 1
        const tokenClasses: string[] = ['quasi']
        if (!isLastFormula && isLastToken) tokenClasses.push('separator')
        if (token.type === 'value') {
          numberRow.appendChild(el('th', { class: tokenClasses.join(' ') }, String(valueNum++)))
        } else {
          numberRow.appendChild(el('th', { class: tokenClasses.join(' ') }))
        }
      })
    })

    thead.appendChild(numberRow)
  }

  // Formula header row
  const headerRow = el('tr', {})

  // Variable columns
  result.letters.forEach((letter, i) => {
    const isLast = i === result.letters.length - 1
    const th = el('th', isLast ? { class: 'separator' } : {})
    th.appendChild(letter_to_html(letter))
    headerRow.appendChild(th)
  })

  // Formula columns - always use quasi-column layout for header
  layouts.forEach((layout, formulaIdx) => {
    const isLastFormula = formulaIdx === layouts.length - 1
    layout.tokens.forEach((token, tokenIdx) => {
      const isLastToken = tokenIdx === layout.tokens.length - 1
      const tokenClasses: string[] = ['quasi']
      if (!isLastFormula && isLastToken) tokenClasses.push('separator')
      const th = el('th', { class: tokenClasses.join(' ') })
      th.appendChild(token_to_html(token.text))
      headerRow.appendChild(th)
    })
  })

  thead.appendChild(headerRow)
  table.appendChild(thead)

  // Data rows
  const tbody = el('tbody', {})
  result.rows.forEach((row, rowIdx) => {
    // Row highlighting only in calculator mode
    const tr = el('tr', state.currentMode === 'calculator' && state.highlightedRows.has(rowIdx) ? { class: 'highlighted' } : {})

    // Row click for highlighting only in calculator mode
    if (state.currentMode === 'calculator') {
      tr.style.cursor = 'pointer'
      tr.addEventListener('click', () => {
        if (state.highlightedRows.has(rowIdx)) {
          state.highlightedRows.delete(rowIdx)
        } else {
          state.highlightedRows.add(rowIdx)
        }
        render()
      })
    }

    // Create assignment lookup function
    const lookup = makeLookup(row.assignment)

    // Variable values
    result.letters.forEach((letter, i) => {
      const isLast = i === result.letters.length - 1
      const val = row.assignment.get(letter_string(letter))!
      tr.appendChild(el('td', isLast ? { class: 'separator' } : {},
        el('span', {}, val ? '\u22A4' : '\u22A5')
      ))
    })

    // Formula values - always use quasi-column layout for cells
    layouts.forEach((layout, formulaIdx) => {
      const isLastFormula = formulaIdx === layouts.length - 1
      const evaluatedValues = evaluateLayout(layout, lookup)
      let valueIdx = 0

      layout.tokens.forEach((token, tokenIdx) => {
        const isLastToken = tokenIdx === layout.tokens.length - 1
        const cellClasses: string[] = ['quasi']
        if (!isLastFormula && isLastToken) cellClasses.push('separator')

        if (token.type === 'text') {
          // Empty cell for non-value tokens (parens, spaces)
          tr.appendChild(el('td', { class: cellClasses.join(' ') }, ''))
        } else {
          // Value cell
          const evalResult = evaluatedValues[valueIdx++]
          // Only show value if it's the main connective OR quasi-columns is on
          const showValue = effectiveShowQuasi || evalResult.isMain
          const cellId = `${rowIdx}-${formulaIdx}-${tokenIdx}`

          // Determine if this cell should be quizzable
          const isQuizMode = state.currentMode === 'quiz'
          const isAtomicLetter = token.type === 'value' && token.subformula.tag === 'letter'
          const shouldQuiz = isQuizMode && showValue && !isAtomicLetter

          // Check if dependencies are met (all prerequisite cells filled)
          const cellKey = `${formulaIdx}-${tokenIdx}`
          const deps = cellDependencies.get(cellKey) || []
          const depsAreFilled = deps.every(depKey => {
            const depCellId = `${rowIdx}-${depKey}`
            return state.userAnswers.has(depCellId)
          })

          if (!shouldQuiz) {
            // Calculator mode or non-quizzable cell: show computed value
            const valueClass = evalResult.isMain ? 'val-main' : ''
            tr.appendChild(el('td', { class: cellClasses.join(' ') },
              showValue ? el('span', valueClass ? { class: valueClass } : {}, evalResult.value ? '\u22A4' : '\u22A5') : ''
            ))
          } else if (!depsAreFilled) {
            // Quiz mode but dependencies not met: show locked cell
            tr.appendChild(renderLockedCell(evalResult, cellClasses))
          } else {
            // Quiz mode with dependencies met: show dropdown
            tr.appendChild(renderQuizCell(cellId, evalResult, cellClasses))
          }
        }
      })
    })

    tbody.appendChild(tr)
  })

  table.appendChild(tbody)
  return table
}

function updateGenerateButton() {
  const btn = document.querySelector('button.generate') as HTMLButtonElement | null
  if (btn) {
    const nonEmptyFormulas = state.formulas.filter(f => f.text.trim() !== '')
    const allValid = nonEmptyFormulas.length > 0 && nonEmptyFormulas.every(f => f.parsed !== null)
    btn.disabled = !allValid
  }
}

function clearTruthTable() {
  if (state.currentResult !== null) {
    state.currentResult = null
    const outputSection = document.querySelector('.output-section')
    if (outputSection) {
      outputSection.replaceWith(renderOutputSection())
    }
  }
}

// Check if input has unnecessary outer parentheses
function hasUnnecessaryOuterParens(text: string, parsed: Sentence): boolean {
  const trimmed = text.trim()
  // Check for matching outer brackets
  const bracketPairs = [['(', ')'], ['[', ']'], ['{', '}']]
  for (const [open, close] of bracketPairs) {
    if (trimmed.startsWith(open) && trimmed.endsWith(close)) {
      // Verify the brackets match (not like "(A) & (B)")
      let depth = 0
      for (let i = 0; i < trimmed.length - 1; i++) {
        if (trimmed[i] === open) depth++
        else if (trimmed[i] === close) depth--
        if (depth === 0) return false // Closed before the end
      }
      // The outer parens wrap the whole formula
      // Only warn if it's a binary connective (those are the only valid wrapped formulas)
      return parsed.tag !== 'letter' && parsed.tag !== 'negation' && parsed.tag !== 'value'
    }
  }
  return false
}

function validateFormula(index: number) {
  const formula = state.formulas[index]
  formula.warning = null

  if (formula.text.trim() === '') {
    formula.parsed = null
    formula.error = null
    return
  }

  const result = parse_sentence(formula.text)
  if (result[0]) {
    formula.parsed = result[1]
    formula.error = null
    // Check for unnecessary outer parentheses
    if (hasUnnecessaryOuterParens(formula.text, result[1])) {
      formula.warning = 'Outer parentheses not required.'
    }
  } else {
    formula.parsed = null
    formula.error = result[1]
  }
}

function calculateTruthTables() {
  // Clear highlighted rows
  state.highlightedRows.clear()

  // Validate all formulas
  state.formulas.forEach((_, i) => validateFormula(i))

  // Filter to valid, non-empty formulas
  const validFormulas = state.formulas
    .filter(f => f.parsed !== null)
    .map(f => f.parsed!)

  if (validFormulas.length === 0) {
    state.currentResult = null
    render()
    return
  }

  state.currentResult = generate_truth_table(validFormulas)
  render()
}

// Initial render
render()
