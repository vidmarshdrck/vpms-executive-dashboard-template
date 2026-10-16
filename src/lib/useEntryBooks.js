import { useEffect, useState } from 'react'
import { readBooks, subscribeToBooks } from './entryBooks.js'
export function useEntryBooks() {
  const [, update] = useState(0)
  useEffect(() => subscribeToBooks(() => update((value) => value + 1)), [])
  try { return { ...readBooks(), error: '' } }
  catch (error) { return { entries: [], published: {}, error: error.message } }
}
