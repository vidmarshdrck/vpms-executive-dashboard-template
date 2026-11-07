import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { panelAccessibility } from './slideTabs.js'

test('hidden tab panels are not keyboard-focusable', () => {
  const hidden = panelAccessibility(false)
  const shown = panelAccessibility(true)
  assert.equal(hidden.inert, true)
  assert.equal(hidden['aria-hidden'], true)
  assert.equal(hidden.role, 'tabpanel')
  assert.equal(shown.inert, undefined)
  assert.equal(shown['aria-hidden'], false)
  const source = readFileSync(new URL('./SlideTabs.jsx', import.meta.url), 'utf8')
  assert.match(source, /panelAccessibility\(childIndex === index\)/)
  assert.equal(source.includes('tabIndex="0"'), false)
})