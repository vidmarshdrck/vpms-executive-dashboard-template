export function panelAccessibility(active) {
  return active
    ? { role: 'tabpanel', 'aria-hidden': false }
    : { role: 'tabpanel', 'aria-hidden': true, inert: true }
}
