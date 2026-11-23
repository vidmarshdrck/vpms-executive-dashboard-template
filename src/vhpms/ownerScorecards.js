export function emptyOwnerScorecards() {
  return { version: 1, cards: [] }
}

export function parseOwnerScorecards(raw) {
  try {
    const data = JSON.parse(raw)
    if (data?.version !== 1 || !Array.isArray(data.cards)) return emptyOwnerScorecards()
    return { version: 1, cards: data.cards.map(normalizeCard).filter(Boolean) }
  } catch {
    return emptyOwnerScorecards()
  }
}

export function saveOwnerScorecard(state, input, id) {
  const card = buildCard(input, id || crypto.randomUUID())
  const current = state?.version === 1 && Array.isArray(state.cards) ? state.cards : []
  const cards = current.some((item) => item.id === card.id)
    ? current.map((item) => (item.id === card.id ? card : item))
    : [...current, card]
  return { version: 1, cards }
}

function buildCard(input, id) {
  const name = String(input?.name || '').trim()
  const subjectType = input?.subjectType === 'user' || input?.subjectType === 'department' ? input.subjectType : ''
  const subjectId = String(input?.subjectId || '').trim()
  if (!name) throw new Error('Enter a name for the scorecard.')
  if (!subjectType || !subjectId) throw new Error('Choose a department or a user.')
  const metrics = (Array.isArray(input?.metrics) ? input.metrics : []).map((metric) => ({
    id: String(metric?.id || crypto.randomUUID()),
    name: String(metric?.name || '').trim(),
    target: String(metric?.target ?? '').trim(),
  })).filter((metric) => metric.name || metric.target)
  if (!metrics.length) throw new Error('Add at least one metric.')
  if (metrics.some((metric) => !metric.name || !metric.target)) throw new Error('Each metric needs a name and a target.')
  return { id: String(id), name, subjectType, subjectId, metrics }
}

function normalizeCard(card) {
  try {
    return buildCard(card, card?.id || crypto.randomUUID())
  } catch {
    return null
  }
}
