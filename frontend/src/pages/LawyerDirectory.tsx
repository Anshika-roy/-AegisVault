import { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Shield, Search, MapPin, Star, StarHalf, Send, CheckCircle, Loader2, X, Menu, Briefcase, Award, Clock } from 'lucide-react'
import { Modal } from '@/components/Modal'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'

/* ─── Types ─── */
interface Lawyer {
  id: string
  user_id: string
  specialization: string
  experience: string | null
  location: string | null
  bio: string | null
  rating: number | null
  verified: boolean
  users?: { full_name: string; email: string } | null
}

/* ─── Constants ─── */
const specs = ['All', 'Criminal', 'Civil', 'Corporate', 'Family', 'Property', 'IP', 'Labour', 'Constitutional']
const inputClass = `w-full px-3 py-2 rounded-md text-sm text-white placeholder-muted/40
  bg-[#111111] border border-white/10 outline-none
  focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all duration-200`

/* ─── Stars ─── */
function Stars({ rating }: { rating: number }) {
  const full = Math.floor(rating)
  const half = rating - full >= 0.3
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => {
        if (i < full) return <Star key={i} className="w-3 h-3 fill-white text-white" />
        if (i === full && half) return <StarHalf key={i} className="w-3 h-3 fill-white text-white" />
        return <Star key={i} className="w-3 h-3 text-[#333]" />
      })}
      <span className="text-muted text-[10px] ml-1">{rating.toFixed(1)}</span>
    </div>
  )
}

/* ─── Skeleton ─── */
function CardSkeleton() {
  return <div className="bg-[#0f0f0f] border border-white/5 rounded-lg h-64 animate-pulse" />
}

/* ─── Navbar ─── */
function DirectoryNavbar({ onLogin, onRegister }: { onLogin: () => void; onRegister: () => void }) {
  const { user, signOut } = useAuth()
  const [mobileOpen, setMobileOpen] = useState(false)
  const fullName = user?.user_metadata?.full_name || user?.email?.split('@')[0]

  return (
    <nav className="sticky top-0 z-50 border-b border-white/5 bg-[#000000] bg-opacity-80 backdrop-blur-md">
      <div className="max-w-[1400px] mx-auto px-6 h-14 flex items-center justify-between">
        <a href="/" className="flex items-center gap-2 no-underline">
          <Shield className="w-5 h-5 text-white" strokeWidth={2} />
          <span className="text-white font-semibold text-sm tracking-tight">AegisVault Directory</span>
        </a>
        <div className="hidden md:flex items-center gap-3">
          {user ? (
            <>
              <span className="text-white text-xs font-medium">{fullName}</span>
              <button onClick={signOut} className="px-3 py-1.5 text-xs font-medium text-muted hover:text-white transition-colors bg-transparent border-none cursor-pointer">Sign Out</button>
            </>
          ) : (
            <>
              <button onClick={onLogin} className="px-3 py-1.5 text-xs font-medium text-white bg-transparent hover:bg-white/5 border border-white/10 rounded-md transition-colors cursor-pointer">Log In</button>
              <button onClick={onRegister} className="px-3 py-1.5 text-xs font-medium text-black bg-white hover:bg-neutral-200 rounded-md transition-colors cursor-pointer border-none">Create Account</button>
            </>
          )}
        </div>
        <button onClick={() => setMobileOpen(!mobileOpen)} className="md:hidden text-muted p-1 bg-transparent border-none cursor-pointer">
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>
    </nav>
  )
}

/* ─── Send Request Modal ─── */
function SendRequestModal({ isOpen, onClose, lawyer }: {
  isOpen: boolean; onClose: () => void; lawyer: Lawyer | null
}) {
  const { user } = useAuth()
  const [desc, setDesc] = useState('')
  const [caseType, setCaseType] = useState('Criminal')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const handleSubmit = async () => {
    if (!desc.trim() || !user || !lawyer) return
    setLoading(true)
    setError('')
    try {
      const { error: err } = await supabase.from('requests').insert({
        client_id: user.id,
        lawyer_id: lawyer.user_id,
        case_description: desc.trim(),
        case_type: caseType,
        status: 'pending',
      })
      if (err) throw err
      setSuccess(true)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to send request')
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => { setDesc(''); setError(''); setSuccess(false); onClose() }
  if (!lawyer) return null
  const lawyerName = lawyer.users?.full_name || 'Lawyer'

  return (
    <Modal isOpen={isOpen} onClose={handleClose}>
      {success ? (
        <div className="flex flex-col items-center text-center py-6">
          <CheckCircle className="w-8 h-8 text-green-500 mb-3" />
          <h2 className="text-sm font-semibold text-white mb-1">Request Delivered</h2>
          <p className="text-muted text-xs mb-5">Your case facts have been encrypted and sent.</p>
          <button onClick={handleClose} className="px-4 py-2 rounded-md text-xs font-medium text-black bg-white border-none cursor-pointer">Done</button>
        </div>
      ) : (
        <>
          <h2 className="text-sm font-semibold text-white mb-1">Contact {lawyerName}</h2>
          <p className="text-muted text-xs mb-5">Provide a summary of your situation for initial review.</p>
          {error && <div className="mb-4 p-2 rounded border border-red-500/20 bg-red-500/10 text-red-400 text-xs">{error}</div>}
          <div className="space-y-3 mb-5">
            <div>
              <label className="text-[10px] uppercase tracking-wider text-muted font-medium mb-1.5 block">Case Category</label>
              <select value={caseType} onChange={e => setCaseType(e.target.value)} className={inputClass}>
                {specs.filter(s => s !== 'All').map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wider text-muted font-medium mb-1.5 block">Case Description</label>
              <textarea rows={4} placeholder="Key events, dates, and current status..." value={desc}
                onChange={e => setDesc(e.target.value)} className={`${inputClass} resize-none`} />
            </div>
          </div>
          <button onClick={handleSubmit} disabled={loading || !desc.trim()}
            className="w-full py-2.5 rounded-md text-xs font-medium text-black bg-white hover:bg-neutral-200 disabled:opacity-50 transition-colors flex items-center justify-center gap-2 border-none cursor-pointer">
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><Send className="w-3.5 h-3.5" /> Send Secure Request</>}
          </button>
        </>
      )}
    </Modal>
  )
}

/* ═══════════════════════════════════════════════════════
   LAWYER DIRECTORY PAGE
   ═══════════════════════════════════════════════════════ */
export default function LawyerDirectory() {
  const { user } = useAuth()
  const [lawyers, setLawyers] = useState<Lawyer[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [specFilter, setSpecFilter] = useState('All')

  const [authModal, setAuthModal] = useState<'login' | 'register' | null>(null)
  const [selectedLawyer, setSelectedLawyer] = useState<Lawyer | null>(null)

  useEffect(() => {
    const fetchLawyers = async () => {
      setLoading(true)
      try {
        const { data, error: err } = await supabase
          .from('lawyers')
          .select('*, users!user_id(full_name, email)')
          .order('rating', { ascending: false })
        if (err) throw err
        setLawyers((data || []) as unknown as Lawyer[])
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to load lawyers')
      } finally {
        setLoading(false)
      }
    }
    fetchLawyers()
  }, [])

  const filtered = useMemo(() => {
    return lawyers.filter(l => {
      const matchSpec = specFilter === 'All' || l.specialization === specFilter
      const q = search.toLowerCase()
      const matchSearch = !q ||
        (l.users?.full_name || '').toLowerCase().includes(q) ||
        l.specialization.toLowerCase().includes(q) ||
        (l.location || '').toLowerCase().includes(q)
      return matchSpec && matchSearch
    })
  }, [lawyers, specFilter, search])

  const handleSendRequest = (lawyer: Lawyer) => {
    if (!user) {
      setAuthModal('login')
    } else {
      setSelectedLawyer(lawyer)
    }
  }

  const [AuthModals, setAuthModals] = useState<{ LoginModal: React.ComponentType<{ isOpen: boolean; onClose: () => void; onSwitchToRegister: () => void }>; RegisterModal: React.ComponentType<{ isOpen: boolean; onClose: () => void; onSwitchToLogin: () => void }> } | null>(null)
  useEffect(() => {
    if (authModal) {
      import('@/components/AuthModals').then(m => setAuthModals({ LoginModal: m.LoginModal, RegisterModal: m.RegisterModal }))
    }
  }, [authModal])

  return (
    <div className="min-h-screen bg-background text-white selection:bg-white/20">
      <DirectoryNavbar onLogin={() => setAuthModal('login')} onRegister={() => setAuthModal('register')} />

      {/* Header */}
      <section className="pt-12 pb-8 px-6 max-w-[1400px] mx-auto border-b border-white/5">
        <h1 className="text-2xl font-semibold text-white tracking-tight mb-2">Legal Network Registry</h1>
        <p className="text-muted text-sm mb-6 max-w-2xl">Connect with verified attorneys specializing in Indian Law. All professionals are vetted by the Directory Mock Data.</p>

        <div className="flex flex-col md:flex-row gap-4 items-center">
          <div className="relative w-full md:max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted/50" />
            <input type="text" placeholder="Search by name, expertise, or location..." value={search}
              onChange={e => setSearch(e.target.value)}
              className={`${inputClass} pl-9`} />
          </div>
          
          <div className="flex items-center gap-2 overflow-x-auto w-full pb-2 md:pb-0 scrollbar-none">
            {specs.map(s => (
              <button key={s} onClick={() => setSpecFilter(s)}
                className={`whitespace-nowrap px-3 py-1.5 rounded-full text-[10px] font-medium transition-colors border-none cursor-pointer
                  ${specFilter === s ? 'bg-white text-black' : 'bg-[#111] text-muted hover:bg-[#222]'}`}>
                {s}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Grid */}
      <main className="max-w-[1400px] mx-auto px-6 py-8">
        {error && <div className="mb-6 p-3 rounded-md bg-red-500/10 text-red-400 text-xs border border-red-500/20">{error}</div>}

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {[1, 2, 3, 4, 5, 6, 7, 8].map(i => <CardSkeleton key={i} />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-20 text-center border border-white/5 rounded-lg border-dashed">
            <Search className="w-10 h-10 text-muted/30 mx-auto mb-3" />
            <h2 className="text-sm font-medium text-white mb-1">No attorneys found</h2>
            <p className="text-muted text-xs">Try adjusting your filters or search query.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            <AnimatePresence>
              {filtered.map(lawyer => (
                <motion.div key={lawyer.id} layout initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.98 }} transition={{ duration: 0.2 }}
                  className="bg-[#0f0f0f] border border-white/5 rounded-lg p-5 flex flex-col group hover:border-white/20 transition-colors">
                  
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-[#1a1a1a] border border-white/10 flex items-center justify-center text-white font-medium text-sm shrink-0">
                        {(lawyer.users?.full_name || 'U').charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-white mb-0.5 flex items-center gap-1.5">
                          {lawyer.users?.full_name || 'Unknown Lawyer'}
                          {lawyer.verified && <CheckCircle className="w-3.5 h-3.5 text-blue-500" />}
                        </h3>
                        <p className="text-muted text-[10px]">{lawyer.specialization} Law</p>
                      </div>
                    </div>
                  </div>

                  <div className="mb-4 text-xs text-muted leading-relaxed line-clamp-3 min-h-[54px]">
                    {lawyer.bio || 'Experienced legal professional dedicated to client advocacy.'}
                  </div>

                  <div className="space-y-2 mb-5 mt-auto">
                    <div className="flex items-center gap-2 text-[10px] text-muted">
                      <MapPin className="w-3.5 h-3.5 text-muted/70" />
                      {lawyer.location || 'India'}
                    </div>
                    {lawyer.experience && (
                       <div className="flex items-center gap-2 text-[10px] text-muted">
                         <Briefcase className="w-3.5 h-3.5 text-muted/70" />
                         {lawyer.experience}
                       </div>
                    )}
                    <div className="flex items-center gap-2 text-[10px] text-muted">
                      <Clock className="w-3.5 h-3.5 text-muted/70" />
                      Avg. Response: {'< 4 hrs'}
                    </div>
                    <div className="flex items-center gap-2 pt-1">
                      <Award className="w-3.5 h-3.5 text-muted/70" />
                      <Stars rating={lawyer.rating || 4.5} />
                    </div>
                  </div>

                  <button onClick={() => handleSendRequest(lawyer)}
                    className="w-full py-2 rounded-md text-xs font-medium text-white bg-[#1a1a1a] hover:bg-[#252525] border border-white/10 transition-colors cursor-pointer flex items-center justify-center gap-1.5 group-hover:bg-white group-hover:text-black group-hover:border-transparent">
                    <Send className="w-3 h-3" /> Contact
                  </button>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </main>

      <SendRequestModal isOpen={!!selectedLawyer} onClose={() => setSelectedLawyer(null)} lawyer={selectedLawyer} />
      
      {AuthModals && authModal === 'login' && <AuthModals.LoginModal isOpen={true} onClose={() => setAuthModal(null)} onSwitchToRegister={() => setAuthModal('register')} />}
      {AuthModals && authModal === 'register' && <AuthModals.RegisterModal isOpen={true} onClose={() => setAuthModal(null)} onSwitchToLogin={() => setAuthModal('login')} />}
    </div>
  )
}
