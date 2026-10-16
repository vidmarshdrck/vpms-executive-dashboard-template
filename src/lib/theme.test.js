import test from 'node:test'
import assert from 'node:assert/strict'
import { applyTheme, storedTheme, THEME_KEY } from './theme.js'
const mem = () => { const m = new Map(); return { getItem: k => m.get(k) ?? null, setItem: (k, v) => m.set(k, v) } }
test('theme persists in storage and toggles the root class', () => {
  const s = mem(), cls = new Set(), root = { classList: { toggle: (c, on) => on ? cls.add(c) : cls.delete(c) }, style: {} }
  assert.equal(storedTheme(s), 'light')
  assert.equal(applyTheme('dark', root, s), 'dark'); assert.ok(cls.has('dark')); assert.equal(s.getItem(THEME_KEY), 'dark'); assert.equal(storedTheme(s), 'dark')
  applyTheme('light', root, s); assert.ok(!cls.has('dark')); assert.equal(root.style.colorScheme, 'light')
  assert.equal(applyTheme('weird', root, s), 'light'); assert.equal(storedTheme({ getItem: () => { throw Error('x') } }), 'light')
})
