import test from 'node:test'
import assert from 'node:assert/strict'
import { emptyBooks, activeBusinesses, addEntry, slicesBy, parseBooks, setBusinessActive, statusSlices, BLUE_PALETTE } from './books.js'

test('business books start empty and charts use entered amounts only', () => {
  const books = emptyBooks()
  assert.equal(books.entries.length, 0)
  assert.equal(activeBusinesses(books).length, 7)
  assert.equal(activeBusinesses(books).some((business) => business.name.includes('Digital Products')), true)
  let next = addEntry(books, { businessId: 've', kind: 'expense', title: 'Fuel', group: 'Transport', amount: 75, status: 'Paid', date: '2026-11-01' })
  next = addEntry(next, { businessId: 've', kind: 'expense', title: 'Rent', group: 'Premises', amount: 25, status: 'Overdue', date: '2026-11-02' })
  const slices = slicesBy(next.entries, 'group')
  assert.deepEqual(slices.map((slice) => slice.name), ['Transport', 'Premises'])
  assert.equal(slices[0].color, BLUE_PALETTE[0])
  assert.deepEqual(statusSlices(next.entries).map((slice) => slice.name), ['Paid', 'Overdue'])
  assert.equal(statusSlices(next.entries)[1].color, '#B91C1C')
  const hidden = setBusinessActive(next, 've', false)
  assert.equal(activeBusinesses(hidden).some((business) => business.id === 've'), false)
  assert.equal(parseBooks('nope').entries.length, 0)
  assert.throws(() => addEntry(books, { businessId: 've', kind: 'expense', title: 'Fuel', group: 'Transport', amount: 0 }))
})
