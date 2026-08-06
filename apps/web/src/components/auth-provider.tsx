'use client'

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { fetchCurrentUser, logoutRequest, type AuthUser } from '@/lib/auth-token'

interface AuthState {
  user: AuthUser | null
  loading: boolean
  isAuthenticated: boolean
  refresh: () => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)
  const mounted = useRef(false)

  useEffect(() => {
    if (mounted.current) return
    mounted.current = true
    fetchCurrentUser().then((u) => {
      setUser(u)
      setLoading(false)
    })
  }, [])

  const refresh = useCallback(async () => {
    const u = await fetchCurrentUser()
    setUser(u)
  }, [])

  const logout = useCallback(async () => {
    await logoutRequest()
    setUser(null)
    router.push('/login')
  }, [router])

  return (
    <AuthContext value={{ user, loading, isAuthenticated: !!user, refresh, logout }}>
      {children}
    </AuthContext>
  )
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
