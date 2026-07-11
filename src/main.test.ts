// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest'

const setInputValue = (input: HTMLInputElement | HTMLTextAreaElement, value: string) => {
  input.value = value
  input.dispatchEvent(new Event('input', { bubbles: true }))
}

const clickButton = (label: string) => {
  const button = [...document.querySelectorAll('button')]
    .find(candidate => candidate.textContent === label) as HTMLButtonElement | undefined
  expect(button, `button labelled "${label}"`).toBeDefined()
  button!.click()
}

describe('application state transitions', () => {
  beforeEach(async () => {
    vi.resetModules()
    document.body.innerHTML = '<div id="app"></div>'
    await import('./main')
  })

  it('clears a generated table when a formula is removed', () => {
    const firstInput = document.querySelector('.formula-row input') as HTMLInputElement
    setInputValue(firstInput, 'A')
    clickButton('+ Add Formula')

    const inputs = document.querySelectorAll('.formula-row input')
    setInputValue(inputs[1] as HTMLInputElement, 'B')
    clickButton('Calculate Truth Table(s)')
    expect(document.querySelector('table.truth-table')).not.toBeNull()

    const removeButtons = document.querySelectorAll('button.remove')
    ;(removeButtons[1] as HTMLButtonElement).click()

    expect(document.querySelector('table.truth-table')).toBeNull()
    expect(document.querySelector('.output-section .placeholder')).not.toBeNull()
  })

  it('clears a generated table when batch input replaces the formulas', () => {
    const input = document.querySelector('.formula-row input') as HTMLInputElement
    setInputValue(input, 'A')
    clickButton('Calculate Truth Table(s)')
    expect(document.querySelector('table.truth-table')).not.toBeNull()

    clickButton('Show Batch Input')
    const textarea = document.querySelector('textarea.batch-input') as HTMLTextAreaElement
    setInputValue(textarea, 'B')
    clickButton('Load Formulae')

    expect(document.querySelector('table.truth-table')).toBeNull()
    expect(document.querySelector('.output-section .placeholder')).not.toBeNull()
  })

  it('clears downstream quiz answers when a prerequisite changes', () => {
    const input = document.querySelector('.formula-row input') as HTMLInputElement
    setInputValue(input, '(A & B) -> C')
    clickButton('Quiz')
    clickButton('Start Quiz')

    let prerequisite = document.querySelector('select[data-cell-id="0-0-2"]') as HTMLSelectElement
    prerequisite.value = 'T'
    prerequisite.dispatchEvent(new Event('change', { bubbles: true }))

    const dependent = document.querySelector('select[data-cell-id="0-0-5"]') as HTMLSelectElement
    expect(dependent).not.toBeNull()
    dependent.value = 'T'
    dependent.dispatchEvent(new Event('change', { bubbles: true }))
    expect(document.querySelector('.quiz-stats')?.textContent).toContain('2/16')

    prerequisite = document.querySelector('select[data-cell-id="0-0-2"]') as HTMLSelectElement
    prerequisite.value = ''
    prerequisite.dispatchEvent(new Event('change', { bubbles: true }))

    expect(document.querySelector('select[data-cell-id="0-0-5"]')).toBeNull()
    expect(document.querySelector('.quiz-stats')?.textContent).toContain('0/16')

    prerequisite = document.querySelector('select[data-cell-id="0-0-2"]') as HTMLSelectElement
    prerequisite.value = 'T'
    prerequisite.dispatchEvent(new Event('change', { bubbles: true }))
    expect((document.querySelector('select[data-cell-id="0-0-5"]') as HTMLSelectElement).value).toBe('')
  })
})
