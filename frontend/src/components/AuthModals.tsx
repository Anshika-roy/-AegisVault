import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Shield, Loader2, CheckCircle } from 'lucide-react'
import { Modal } from '@/components/Modal'
import { supabase } from '@/lib/supabase'

/* ─── Shared input style ─── */
const inputClass = `w-full px-4 py-3 rounded-lg text-sm text-white placeholder-muted/50
  bg-[#0a0a0a] border border-[#1a1a1a] outline-none
  focus:border-primary focus:ring-1 focus:ring-primary/40 transition-all duration-200`

/* ─── Error box ─── */
function ErrorBox({ message }: { message: string }) {
  if (!message) return null
  return (
    <div className="mb-4 p-3 rounded-lg border border-red-500/40 bg-red-500/10 text-red-400 text-sm">
      {message}
    </div>
  )
}

/* ═══ LOGIN MODAL ═══ */
export function LoginModal({
  isOpen, onClose, onSwitchToRegister,
}: {
  isOpen: boolean; onClose: () => void; onSwitchToRegister: () => void
}) {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { data, error: err } = await supabase.auth.signInWithPassword({ email, password })
      if (err) throw err

      console.log('[Login] Auth success, user id:', data.user.id)

      const { data: userData, error: profileErr } = await supabase
        .from('users').select('role').eq('id', data.user.id).single()

      console.log('[Login] Fetched role from users table:', userData, 'error:', profileErr)

      const role = userData?.role
      const destination = role === 'lawyer' ? '/lawyer' : '/client'
      console.log('[Login] Redirecting to:', destination, '(role =', role, ')')

      onClose()
      navigate(destination)
    } catch (err: unknown) {
      console.error('[Login] Error:', err)
      setError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <div className="flex items-center gap-2.5 mb-1">
        <Shield className="w-6 h-6 text-primary" strokeWidth={2.2} />
        <h2 className="text-xl font-bold text-white">Welcome Back</h2>
      </div>
      <p className="text-muted text-sm mb-6">Sign in to your AegisVault account</p>

      <ErrorBox message={error} />

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <input type="email" required placeholder="your@email.com" value={email}
          onChange={e => setEmail(e.target.value)} className={inputClass} />
        <div>
          <input type="password" required placeholder="••••••••" value={password}
            onChange={e => setPassword(e.target.value)} className={inputClass} />
          <div className="text-right mt-1.5">
            <button type="button" className="text-xs text-primary hover:underline bg-transparent border-none cursor-pointer">
              Forgot password?
            </button>
          </div>
        </div>
        <button type="submit" disabled={loading}
          className="w-full py-3 rounded-lg text-sm font-semibold text-black bg-primary
            hover:bg-neutral-200 disabled:opacity-50 transition-all duration-300 flex items-center justify-center gap-2
            border-none cursor-pointer">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Sign In'}
        </button>
      </form>

      <p className="text-center text-sm text-muted mt-5">
        Don't have an account?{' '}
        <button onClick={onSwitchToRegister}
          className="text-primary font-semibold hover:underline bg-transparent border-none cursor-pointer">
          Register
        </button>
      </p>
    </Modal>
  )
}

/* ═══ REGISTER MODAL ═══ */
export function RegisterModal({
  isOpen, onClose, onSwitchToLogin,
}: {
  isOpen: boolean; onClose: () => void; onSwitchToLogin: () => void
}) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<'client' | 'lawyer'>('client')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      console.log('[Register] Signing up with role:', role)

      const { data, error: err } = await supabase.auth.signUp({
        email, password,
        options: {
          data: { full_name: name, role },
          emailRedirectTo: `${window.location.origin}/auth-callback`,
        },
      })
      if (err) throw err

      console.log('[Register] SignUp success, user:', data.user?.id)

      if (data.user) {
        // Insert row into users table with the selected role
        const { data: insertData, error: insertErr } = await supabase.from('users').upsert({
          id: data.user.id, email, full_name: name, role,
        }, { onConflict: 'id' }).select()

        console.log('[Register] Users table insert result:', insertData, 'error:', insertErr)

        if (insertErr) {
          console.error('[Register] CRITICAL: Failed to save role to users table:', insertErr)
          // Don't throw — the signup itself succeeded, just the role save failed
        }

        // Also create a lawyers table entry so they appear in the directory
        if (role === 'lawyer') {
          const { error: lawyerError } = await supabase.from('lawyers').insert({
            user_id: data.user.id,
            specialization: 'General Practice',
            bio: 'Legal professional available for consultation.',
            location: 'India',
            rating: 5.0,
            verified: true,
          })
          console.log('[Register] Lawyer profile created:', lawyerError ? lawyerError.message : 'OK')
        }
      }
      setSuccess(true)
    } catch (err: unknown) {
      console.error('[Register] Error:', err)
      setError(err instanceof Error ? err.message : 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <Modal isOpen={isOpen} onClose={onClose}>
        <div className="flex flex-col items-center text-center py-6">
          <CheckCircle className="w-14 h-14 text-accent mb-4" strokeWidth={1.5} />
          <h2 className="text-xl font-bold text-white mb-2">Check your email!</h2>
          <p className="text-muted text-sm max-w-[280px]">
            We sent a confirmation link to your email address. Click it to activate your account.
          </p>
        </div>
      </Modal>
    )
  }

  const toggleBase = 'flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 border cursor-pointer'

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <h2 className="text-xl font-bold text-white mb-1">Create Account</h2>
      <p className="text-muted text-sm mb-6">Join AegisVault — it's free</p>

      <ErrorBox message={error} />

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <input type="text" required placeholder="John Doe" value={name}
          onChange={e => setName(e.target.value)} className={inputClass} />
        <input type="email" required placeholder="your@email.com" value={email}
          onChange={e => setEmail(e.target.value)} className={inputClass} />
        <input type="password" required minLength={8} placeholder="Min 8 characters" value={password}
          onChange={e => setPassword(e.target.value)} className={inputClass} />

        {/* Role toggle */}
        <div className="flex gap-2">
          <button type="button" onClick={() => setRole('client')}
            className={`${toggleBase} ${role === 'client'
              ? 'bg-white border-white text-black'
              : 'bg-transparent border-[#1a1a1a] text-muted hover:border-muted/40'}`}>
            I need a Lawyer
          </button>
          <button type="button" onClick={() => setRole('lawyer')}
            className={`${toggleBase} ${role === 'lawyer'
              ? 'bg-white border-white text-black'
              : 'bg-transparent border-[#1a1a1a] text-muted hover:border-muted/40'}`}>
            I am a Lawyer
          </button>
        </div>

        <button type="submit" disabled={loading}
          className="w-full py-3 rounded-lg text-sm font-semibold text-black bg-primary
            hover:bg-neutral-200 disabled:opacity-50 transition-all duration-300 flex items-center justify-center gap-2
            border-none cursor-pointer">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create Account'}
        </button>
      </form>

      <p className="text-center text-sm text-muted mt-5">
        Already have an account?{' '}
        <button onClick={onSwitchToLogin}
          className="text-primary font-semibold hover:underline bg-transparent border-none cursor-pointer">
          Login
        </button>
      </p>
    </Modal>
  )
}
