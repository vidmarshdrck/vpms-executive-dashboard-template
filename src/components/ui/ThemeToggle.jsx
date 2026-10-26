import { useState } from 'react'
import { Moon, Sun } from 'lucide-react'
import { applyTheme, storedTheme } from '../../lib/theme.js'
export default function ThemeToggle() {
  const [theme, setTheme] = useState(storedTheme)
  const next = theme === 'dark' ? 'light' : 'dark'
  return <button type="button" onClick={() => setTheme(applyTheme(next))} aria-label={`Switch to ${next} mode`} title={`Switch to ${next} mode`} aria-pressed={theme === 'dark'}
    className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50">{theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}</button>
}
