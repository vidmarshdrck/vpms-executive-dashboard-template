export const THEME_KEY = 'vpms-theme'
export function storedTheme(storage = globalThis.localStorage) { try { return storage?.getItem(THEME_KEY) === 'dark' ? 'dark' : 'light' } catch { return 'light' } }
export function applyTheme(theme, root = globalThis.document?.documentElement, storage = globalThis.localStorage) {
  const t = theme === 'dark' ? 'dark' : 'light'
  root?.classList.toggle('dark', t === 'dark'); if (root) root.style.colorScheme = t
  try { storage?.setItem(THEME_KEY, t) } catch { /* storage unavailable */ }
  return t
}
