import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import type { Session, User } from '@supabase/supabase-js'

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [role, setRole] = useState<'client' | 'lawyer' | null>(null)
  const [loading, setLoading] = useState(true)

  // Track which user ID we already fetched the role for
  const fetchedRoleFor = useRef<string | null>(null)

  useEffect(() => {
    let cancelled = false

    // Fetch role from users table — only once per unique user ID
    const fetchRole = async (userId: string, fallbackMeta?: Record<string, unknown>) => {
      if (fetchedRoleFor.current === userId) return // Already fetched
      fetchedRoleFor.current = userId

      const { data, error } = await supabase
        .from('users')
        .select('role')
        .eq('id', userId)
        .single()

      if (cancelled) return

      console.log('[useAuth] Fetched role for', userId, ':', data?.role, 'error:', error?.message || null)

      if (data?.role === 'lawyer' || data?.role === 'client') {
        setRole(data.role)
      } else {
        // Fallback: check auth metadata
        const metaRole = fallbackMeta?.role
        setRole(metaRole === 'lawyer' ? 'lawyer' : 'client')
      }
    }

    // Get initial session
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      if (cancelled) return
      setSession(s)
      setUser(s?.user ?? null)
      if (s?.user) {
        fetchRole(s.user.id, s.user.user_metadata)
      }
      setLoading(false)
    })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, s) => {
        if (cancelled) return
        setSession(s)
        setUser(s?.user ?? null)
        if (s?.user) {
          fetchRole(s.user.id, s.user.user_metadata)
        } else {
          setRole(null)
          fetchedRoleFor.current = null
        }
        setLoading(false)
      }
    )

    return () => {
      cancelled = true
      subscription.unsubscribe()
    }
  }, [])

  const signOut = async () => {
    fetchedRoleFor.current = null
    await supabase.auth.signOut()
    setSession(null)
    setUser(null)
    setRole(null)
  }

  return { session, user, role, loading, signOut }
}
