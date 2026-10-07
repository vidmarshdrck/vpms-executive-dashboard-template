import { createContext, useContext, useMemo, useState } from 'react'
import { authenticateDemoUser, getDemoUserById } from './demoAuth.js'
import { recordActivity, clearActivityLog } from '../lib/activityLog.js'

const SESSION_KEY = 'vpms-demo-session'
const AuthContext = createContext(null)

function readSession() {
  try {
    const session = sessionStorage.getItem(SESSION_KEY)
    return session ? getDemoUserById(session) : null
  } catch {
    return null
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(readSession)
  const login = (email, password) => {
    const authenticatedUser = authenticateDemoUser(email, password)
    if (!authenticatedUser) return false
    sessionStorage.setItem(SESSION_KEY, authenticatedUser.id)
    setUser(authenticatedUser)
    recordActivity({ category: 'auth', label: `Signed in as ${authenticatedUser.role}` })
    return true
  }
  const logout = () => {
    sessionStorage.removeItem(SESSION_KEY)
    setUser(null)
    clearActivityLog()
  }
  const value = useMemo(() => ({ user, login, logout }), [user])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside AuthProvider')
  return context
}
