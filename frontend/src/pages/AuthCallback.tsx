import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Shield, Loader2, AlertCircle } from 'lucide-react'
import { supabase } from '@/lib/supabase'

export default function AuthCallback() {
  const navigate = useNavigate()
  const [status, setStatus] = useState<'loading' | 'error'>('loading')
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Supabase automatically picks up the token from the URL hash
        const { data: { session }, error } = await supabase.auth.getSession()

        if (error) throw error
        if (!session) throw new Error('No session found — link may have expired.')

        console.log('[AuthCallback] Session confirmed, user id:', session.user.id)

        // Fetch user role
        const { data: userData, error: profileErr } = await supabase
          .from('users')
          .select('role')
          .eq('id', session.user.id)
          .single()

        console.log('[AuthCallback] Fetched role:', userData, 'error:', profileErr)

        // Redirect based on role
        const dest = userData?.role === 'lawyer' ? '/lawyer' : '/client'
        console.log('[AuthCallback] Redirecting to:', dest)
        navigate(dest, { replace: true })
      } catch (err: unknown) {
        console.error('[AuthCallback] Error:', err)
        setErrorMsg(err instanceof Error ? err.message : 'Authentication failed')
        setStatus('error')
      }
    }

    // Small delay to let Supabase process the hash
    const timer = setTimeout(handleCallback, 500)
    return () => clearTimeout(timer)
  }, [navigate])

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-6">
      <div className="flex flex-col items-center text-center max-w-sm">
        <Shield className="w-10 h-10 text-primary mb-6" strokeWidth={2} />

        {status === 'loading' && (
          <>
            <Loader2 className="w-8 h-8 text-primary animate-spin mb-4" />
            <h1 className="text-xl font-bold text-white mb-2">Confirming your account...</h1>
            <p className="text-muted text-sm">Please wait while we verify your email.</p>
          </>
        )}

        {status === 'error' && (
          <>
            <AlertCircle className="w-10 h-10 text-red-400 mb-4" />
            <h1 className="text-xl font-bold text-white mb-2">Link expired or invalid</h1>
            <p className="text-muted text-sm mb-6">{errorMsg}</p>
            <a
              href="/"
              className="px-6 py-2.5 rounded-lg text-sm font-semibold text-black bg-white
                         hover:bg-neutral-200 transition-all duration-300 no-underline"
            >
              Go to Homepage
            </a>
          </>
        )}
      </div>
    </div>
  )
}
