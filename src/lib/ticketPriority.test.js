import assert from 'node:assert/strict'
import test from 'node:test'
import { ISSUE_CATEGORIES, TICKET_DEPARTMENTS, PRIORITY_MATRIX, PRIORITY_EXPLANATIONS, priorityFor } from './ticketPriority.js'

const expected = [
  ['Medium', 'Medium', 'Medium', 'Medium', 'Medium', 'Low', 'High'],
  ['High', 'High', 'Critical', 'High', 'High', 'Medium', 'Critical'],
  ['Medium', 'Medium', 'High', 'High', 'High', 'Low', 'Critical'],
  ['High', 'High', 'Critical', 'Critical', 'High', 'Low', 'Critical'],
  ['High', 'High', 'Critical', 'High', 'High', 'Medium', 'Critical'],
  ['High', 'High', 'High', 'Medium', 'Medium', 'Medium', 'Critical'],
  ['Critical', 'Critical', 'Critical', 'Critical', 'High', 'Medium', 'Critical'],
  ['High', 'High', 'Critical', 'High', 'High', 'Medium', 'Critical'],
  ['Critical', 'Critical', 'Critical', 'Critical', 'High', 'High', 'Critical'],
]

test('all 63 department/category combinations match the supplied priority matrix', () => {
  assert.equal(TICKET_DEPARTMENTS.length, 9)
  assert.equal(ISSUE_CATEGORIES.length, 7)
  TICKET_DEPARTMENTS.forEach((department, departmentIndex) => {
    assert.deepEqual(PRIORITY_MATRIX[department], expected[departmentIndex])
    ISSUE_CATEGORIES.forEach((category, categoryIndex) => {
      const actual = priorityFor(department, category)
      assert.equal(actual, expected[departmentIndex][categoryIndex], `${department} + ${category}`)
      assert.ok(PRIORITY_EXPLANATIONS[actual])
    })
  })
})

test('priority updates from both inputs and stays unset until both are valid', () => {
  assert.equal(priorityFor('Dispatch', 'Hardware'), 'Critical')
  assert.equal(priorityFor('Dispatch', 'Printer Issues'), 'High')
  assert.equal(priorityFor('Administration', 'Printer Issues'), 'Low')
  assert.equal(priorityFor('Finance', 'Printer Issues'), 'Medium')
  assert.equal(priorityFor('', 'Hardware'), null)
  assert.equal(priorityFor('Finance', ''), null)
  assert.equal(priorityFor('ICT', 'Hardware'), null)
  assert.equal(priorityFor('Finance', 'Unknown'), null)
})

test('established alternate names resolve without changing their stored values', () => {
  assert.equal(priorityFor('Human Resources', 'Hardware'), 'Medium')
  assert.equal(priorityFor('Boomgate', 'Hardware'), 'Critical')
})
