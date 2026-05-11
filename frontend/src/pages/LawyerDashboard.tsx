import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Briefcase, Users, BrainCircuit, Check, X, Loader2,
  Scale, ArrowRight, CheckCircle,
  MessageSquare, Inbox, Activity, FileText, ChevronRight, ChevronDown
} from 'lucide-react'
import { Sidebar } from '@/components/Sidebar'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'

/* ─── Helpers ─── */
function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`bg-[#1a1a1a] animate-pulse rounded-md ${className}`} />
}

function timeAgo(date: string) {
  const s = Math.floor((Date.now() - new Date(date).getTime()) / 1000)
  if (s < 60) return 'Just now'
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}

const inputClass = `w-full px-3 py-2 rounded-md text-sm text-white placeholder-muted/40
  bg-[#111111] border border-white/10 outline-none
  focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all duration-200`

const caseTypeColors: Record<string, string> = {
  Criminal: 'text-red-400 bg-red-400/10 border-red-400/20',
  Civil: 'text-blue-400 bg-blue-400/10 border-blue-400/20',
  Corporate: 'text-purple-400 bg-purple-400/10 border-purple-400/20',
  Family: 'text-pink-400 bg-pink-400/10 border-pink-400/20',
  Property: 'text-amber-400 bg-amber-400/10 border-amber-400/20',
  'Intellectual Property': 'text-cyan-400 bg-cyan-400/10 border-cyan-400/20',
  Labour: 'text-orange-400 bg-orange-400/10 border-orange-400/20',
  Constitutional: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20',
}

/* ─── Stat Card ─── */
function StatCard({ icon: Icon, label, value, loading }: {
  icon: React.ElementType; label: string; value: number; loading: boolean
}) {
  return (
    <div className="bg-[#0f0f0f] border border-white/5 rounded-lg p-4 flex flex-col justify-between">
      {loading ? (
        <><Skeleton className="w-6 h-6 mb-3" /><Skeleton className="w-12 h-6 mb-1" /><Skeleton className="w-20 h-3" /></>
      ) : (
        <>
          <div className="flex items-center justify-between mb-2">
            <p className="text-muted text-xs font-medium uppercase tracking-wider">{label}</p>
            <Icon className="w-4 h-4 text-muted" strokeWidth={2} />
          </div>
          <p className="text-2xl font-semibold text-white tracking-tight">{value}</p>
        </>
      )}
    </div>
  )
}

/* ─── Types ─── */
interface ReqRow {
  id: string; client_id: string; lawyer_id: string | null; status: string; case_description: string
  case_type: string | null; created_at: string
  users?: { full_name: string; email: string } | null
}

interface RequestClientJoin {
  full_name?: string | null
}

type RecentRequestRow = {
  id: string
  created_at: string
  status: string
  users?: RequestClientJoin | RequestClientJoin[] | null
}

interface ActivityItem {
  id: string; type: string; text: string; created_at: string
}

interface BnsResult {
  ipc_section: string
  bns_section: string
  key_changes: string[]
  strategy_shift: string
  semantic_drift_score: number
  precedent_risks: string[]
  new_strategy: string
  procedural_changes: string[]
}

/* ─── Workload Micro Chart ─── */
function WorkloadChart({ activeCases }: { activeCases: ReqRow[] }) {
  if (!activeCases || activeCases.length === 0) {
    return <div className="h-2 w-full rounded-full bg-white/5 mb-3" />
  }
  const caseCounts = activeCases.reduce((acc, req) => {
    const type = req.case_type || 'Other'
    acc[type] = (acc[type] || 0) + 1
    return acc
  }, {} as Record<string, number>)
  const total = activeCases.length
  const colors: Record<string, string> = {
    Criminal: '#ef4444', Corporate: '#a855f7', Civil: '#3b82f6',
    Family: '#f59e0b', Property: '#fbbf24', 'Intellectual Property': '#06b6d4',
    Labour: '#fb923c', Constitutional: '#34d399', Other: '#737373',
  }
  const loads = Object.entries(caseCounts).map(([label, count]) => ({
    label, value: (count / total) * 100, color: colors[label] || '#737373'
  })).sort((a, b) => b.value - a.value)
  return (
    <div className="flex h-2 w-full rounded-full overflow-hidden mb-3">
      {loads.map(l => (
        <div key={l.label} style={{ width: `${l.value}%`, backgroundColor: l.color }} title={`${l.label} (${Math.round(l.value)}%)`} />
      ))}
    </div>
  )
}

const WORKFLOW_STATES = [
  'Awaiting counterparty filing',
  'Pending affidavit review',
  'Drafting interim injunction',
  'Evidence gathering phase',
  'Ready for next hearing'
]

export default function LawyerDashboard() {
  const navigate = useNavigate()
  const { user } = useAuth()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [pending, setPending] = useState<ReqRow[]>([])
  const [active, setActive] = useState<ReqRow[]>([])
  const [stats, setStats] = useState({ pending: 0, active: 0, clients: 0, bns: 0 })
  const [activities, setActivities] = useState<ActivityItem[]>([])

  const [actionLoading, setActionLoading] = useState<Record<string, string>>({})
  const [expandedReqId, setExpandedReqId] = useState<string | null>(null)

  const [ipcSection, setIpcSection] = useState('')
  const [strategy, setStrategy] = useState('')
  const [bnsLoading, setBnsLoading] = useState(false)
  const [bnsError, setBnsError] = useState('')
  const [bnsResult, setBnsResult] = useState<BnsResult | null>(null)

  const [profileLoaded, setProfileLoaded] = useState(false)
  const [needsProfile, setNeedsProfile] = useState(false)
  const [profSpec, setProfSpec] = useState('Criminal')
  const [profLocation, setProfLocation] = useState('')
  const [profBio, setProfBio] = useState('')
  const [profSaving, setProfSaving] = useState(false)
  const [profSaved, setProfSaved] = useState(false)

  const fetchData = useCallback(async () => {
    if (!user) return
    setLoading(true)
    setError('')
    try {
      const [pendingRes, activeRes, bnsRes, bnsRecentRes, recentReqsRes, profileRes] = await Promise.all([
        supabase.from('requests').select('*, users!client_id(full_name, email)')
          .eq('status', 'pending').or(`lawyer_id.eq.${user.id},lawyer_id.is.null`).order('created_at', { ascending: false }),
        supabase.from('requests').select('*, users!client_id(full_name, email)')
          .eq('lawyer_id', user.id).eq('status', 'accepted').order('created_at', { ascending: false }),
        supabase.from('bns_queries').select('id').eq('user_id', user.id),
        supabase.from('bns_queries').select('id, created_at, ipc_section').eq('user_id', user.id).order('created_at', { ascending: false }).limit(5),
        supabase.from('requests').select('id, created_at, status, users!client_id(full_name)').eq('lawyer_id', user.id).in('status', ['accepted', 'pending']).order('created_at', { ascending: false }).limit(5),
        supabase.from('lawyers').select('*').eq('user_id', user.id).single(),
      ])

      if (pendingRes.error) throw pendingRes.error
      if (activeRes.error) throw activeRes.error

      const pData = (pendingRes.data || []) as unknown as ReqRow[]
      const aData = (activeRes.data || []) as unknown as ReqRow[]

      const uniquePending = Array.from(new Map(pData.map(item => [item.id, item])).values())
      setPending(uniquePending)
      setActive(aData)

      const allClients = new Set([...pData, ...aData].map(r => r.client_id))

      setStats({
        pending: pData.length,
        active: aData.length,
        clients: allClients.size,
        bns: bnsRes.data?.length || 0,
      })

      // Combine and sort activities
      const acts: ActivityItem[] = []
      if (bnsRecentRes.data) {
        bnsRecentRes.data.forEach(b => {
          acts.push({ id: b.id, type: 'analysis', text: `Analyzed BNS for ${b.ipc_section}`, created_at: b.created_at })
        })
      }
      if (recentReqsRes.data) {
        ;(recentReqsRes.data as RecentRequestRow[]).forEach(r => {
          const joinedUser = Array.isArray(r.users) ? r.users[0] : r.users
          const cName = joinedUser?.full_name || 'Client'
          acts.push({ id: r.id, type: 'document', text: `Request ${r.status} for ${cName}`, created_at: r.created_at })
        })
      }
      acts.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      setActivities(acts.slice(0, 5))

      if (profileRes.data) {
        const p = profileRes.data
        if (!p.bio || p.bio === 'Legal professional available for consultation.' || p.specialization === 'General Practice') {
          setNeedsProfile(true)
          setProfSpec(p.specialization === 'General Practice' ? 'Criminal' : p.specialization)
          setProfLocation(p.location || '')
          setProfBio(p.bio === 'Legal professional available for consultation.' ? '' : (p.bio || ''))
        }
      }
      setProfileLoaded(true)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load data')
    } finally {
      setLoading(false)
    }
  }, [user])

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { fetchData() }, [fetchData])

  const handleSaveProfile = async () => {
    if (!user) return
    setProfSaving(true)
    try {
      const { error: err } = await supabase.from('lawyers').update({
        specialization: profSpec,
        location: profLocation.trim() || 'India',
        bio: profBio.trim() || 'Legal professional available for consultation.',
      }).eq('user_id', user.id)
      if (err) throw err
      setNeedsProfile(false)
      setProfSaved(true)
      setTimeout(() => setProfSaved(false), 4000)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save profile')
    } finally {
      setProfSaving(false)
    }
  }

  const handleAction = async (id: string, newStatus: 'accepted' | 'rejected') => {
    setActionLoading(prev => ({ ...prev, [id]: newStatus }))
    try {
      const updateData = newStatus === 'accepted' ? { status: newStatus, lawyer_id: user?.id } : { status: newStatus }
      const { error: err } = await supabase.from('requests').update(updateData).eq('id', id)
      if (err) throw err
      await fetchData()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Action failed')
    } finally {
      setActionLoading(prev => { const n = { ...prev }; delete n[id]; return n })
    }
  }

  const handleBns = async () => {
    if (!ipcSection.trim() || !strategy.trim()) return
    setBnsLoading(true)
    setBnsError('')
    setBnsResult(null)
    try {
      const { data, error: err } = await supabase.functions.invoke('bns-transposer', {
        body: { ipc_section: ipcSection.trim(), case_strategy: strategy.trim() },
      })
      if (err) throw err
      setBnsResult(data as BnsResult)
    } catch (err: unknown) {
      setBnsError(err instanceof Error ? err.message : 'Analysis failed')
    } finally {
      setBnsLoading(false)
    }
  }

  const normalizeDrift = (s: number) => (s <= 1 ? Math.round(s * 100) : Math.round(s))
  const specOptions = ['Criminal', 'Civil', 'Corporate', 'Family', 'Property', 'IP', 'Labour', 'Constitutional']

  return (
    <div className="min-h-screen bg-background text-white flex">
      <Sidebar role="lawyer" />

      <main className="ml-60 flex-1 p-8 max-w-[1400px]">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-semibold tracking-tight text-white">Overview</h1>
        </div>

        {error && (
          <div className="mb-6 p-3 rounded-md border border-red-500/20 bg-red-500/10 text-red-400 text-sm">{error}</div>
        )}

        {profSaved && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
            className="mb-6 p-3 rounded-md border border-green-500/20 bg-green-500/10 text-green-400 text-sm flex items-center gap-2">
            <CheckCircle className="w-4 h-4" /> Directory profile updated.
          </motion.div>
        )}

        {/* ── Complete Profile ── */}
        {profileLoaded && needsProfile && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            className="bg-[#0f0f0f] border border-white/10 rounded-lg p-5 mb-8">
            <div className="flex items-center gap-2 mb-4">
              <Users className="w-4 h-4 text-primary" />
              <h2 className="text-sm font-semibold text-white">Complete Profile Setup</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div>
                <label className="text-muted text-xs mb-1.5 block">Specialization</label>
                <select value={profSpec} onChange={e => setProfSpec(e.target.value)} className={inputClass}>
                  {specOptions.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="text-muted text-xs mb-1.5 block">Location</label>
                <input type="text" value={profLocation} onChange={e => setProfLocation(e.target.value)}
                  placeholder="Mumbai, Maharashtra" className={inputClass} />
              </div>
              <div>
                <label className="text-muted text-xs mb-1.5 block">Bio</label>
                <textarea rows={2} value={profBio} onChange={e => setProfBio(e.target.value)}
                  placeholder="Brief expertise summary..." className={`${inputClass} resize-none`} />
              </div>
            </div>
            <button onClick={handleSaveProfile} disabled={profSaving}
              className="px-4 py-2 rounded-md text-xs font-medium text-black bg-white hover:bg-neutral-200 disabled:opacity-50 transition-colors flex items-center gap-2 border-none cursor-pointer">
              {profSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Save Profile'}
            </button>
          </motion.div>
        )}

        {/* ── Stats & Workload Strip ── */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 mb-8">
          <div className="lg:col-span-3 grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard icon={Inbox} label="Pending Reviews" value={stats.pending} loading={loading} />
            <StatCard icon={Briefcase} label="Active Matters" value={stats.active} loading={loading} />
            <StatCard icon={Users} label="Total Clients" value={stats.clients} loading={loading} />
            <StatCard icon={BrainCircuit} label="BNS Queries" value={stats.bns} loading={loading} />
          </div>
          <div className="bg-[#0f0f0f] border border-white/5 rounded-lg p-4 flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
              <p className="text-muted text-[10px] font-semibold uppercase tracking-wider">Workload Distribution</p>
              <Activity className="w-3.5 h-3.5 text-muted" />
            </div>
            <WorkloadChart activeCases={active} />
            {active.length > 0 ? (
              <div className="flex flex-wrap gap-x-3 text-[10px] text-muted">
                {Object.entries(active.reduce((acc, r) => { const t = r.case_type || 'Other'; acc[t] = (acc[t] || 0) + 1; return acc }, {} as Record<string, number>))
                  .sort(([,a],[,b]) => b - a).slice(0, 4)
                  .map(([type, count]) => <span key={type}>{type}: {Math.round((count / active.length) * 100)}%</span>)}
              </div>
            ) : (
              <p className="text-[10px] text-muted">No active cases</p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Main Column */}
          <div className="lg:col-span-2 space-y-8">
            
            {/* Incoming Requests */}
            <div>
              <div className="flex items-center justify-between mb-4 border-b border-white/5 pb-2">
                <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                  <Inbox className="w-4 h-4 text-muted" /> Incoming Requests
                </h2>
                <span className="text-xs text-muted font-medium">{pending.length} pending</span>
              </div>

              {loading ? (
                <div className="space-y-3">{[1, 2].map(i => <Skeleton key={i} className="h-20 w-full" />)}</div>
              ) : pending.length === 0 ? (
                <div className="py-8 text-center bg-[#0a0a0a] border border-white/5 rounded-lg border-dashed">
                  <p className="text-muted text-sm">No pending requests.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {pending.map(req => {
                    const isExpanded = expandedReqId === req.id
                    return (
                      <div
                        key={req.id}
                        className="bg-[#0f0f0f] border border-white/5 rounded-lg flex flex-col overflow-hidden"
                      >
                        <div 
                          className="p-4 flex items-center justify-between gap-4 cursor-pointer hover:bg-white/5 transition-colors"
                          onClick={() => setExpandedReqId(isExpanded ? null : req.id)}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1.5">
                              <p className="text-white text-sm font-medium truncate">{req.users?.full_name || 'Unknown Client'}</p>
                              {req.case_type && (
                                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${caseTypeColors[req.case_type] || 'text-muted border-white/10'}`}>
                                  {req.case_type}
                                </span>
                              )}
                              <span className="text-[10px] text-muted ml-2">{timeAgo(req.created_at)}</span>
                            </div>
                            <p className="text-muted text-xs truncate">
                              {req.case_description}
                            </p>
                          </div>
                          <motion.div
                            animate={{ rotate: isExpanded ? 180 : 0 }}
                            transition={{ duration: 0.2 }}
                            className="shrink-0"
                          >
                            <ChevronDown className="w-4 h-4 text-muted" />
                          </motion.div>
                        </div>
                        
                        <motion.div
                          initial={false}
                          animate={{ height: isExpanded ? 'auto' : 0, opacity: isExpanded ? 1 : 0 }}
                          className="px-4"
                        >
                          <div className="pt-2 pb-4 border-t border-white/5">
                            <p className="text-sm text-neutral-300 leading-relaxed mb-4 whitespace-pre-wrap">
                              {req.case_description}
                            </p>
                            <div className="flex items-center gap-2">
                              <button onClick={(e) => { e.stopPropagation(); handleAction(req.id, 'accepted'); }} disabled={!!actionLoading[req.id]}
                                className="px-3 py-1.5 rounded-md text-xs font-medium text-black bg-white hover:bg-neutral-200 disabled:opacity-50 transition-colors border-none cursor-pointer flex items-center gap-1.5">
                                {actionLoading[req.id] === 'accepted' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />} Accept
                              </button>
                              <button onClick={(e) => { e.stopPropagation(); handleAction(req.id, 'rejected'); }} disabled={!!actionLoading[req.id]}
                                className="px-3 py-1.5 rounded-md text-xs font-medium text-white bg-transparent hover:bg-white/5 border border-white/10 disabled:opacity-50 transition-colors cursor-pointer flex items-center gap-1.5">
                                {actionLoading[req.id] === 'rejected' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5 text-muted" />} Decline
                              </button>
                            </div>
                          </div>
                        </motion.div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Active Cases */}
            <div>
              <div className="flex items-center justify-between mb-4 border-b border-white/5 pb-2">
                <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                  <Briefcase className="w-4 h-4 text-muted" /> Active Cases
                </h2>
              </div>

              {loading ? (
                <div className="space-y-3">{[1, 2].map(i => <Skeleton key={i} className="h-16 w-full" />)}</div>
              ) : active.length === 0 ? (
                <div className="py-8 text-center bg-[#0a0a0a] border border-white/5 rounded-lg border-dashed">
                  <p className="text-muted text-sm">No active cases.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {active.map((req, i) => {
                    const statusText = WORKFLOW_STATES[i % WORKFLOW_STATES.length]
                    return (
                      <div key={req.id} onClick={() => navigate(`/chat/${req.id}`)}
                        className="group bg-[#0f0f0f] border border-white/5 hover:border-white/20 hover:bg-[#121212] rounded-md p-4 flex items-center justify-between cursor-pointer transition-colors">
                        <div className="flex items-center gap-4 min-w-0">
                          <div className="w-8 h-8 rounded bg-[#1a1a1a] border border-white/10 flex items-center justify-center text-muted font-medium text-xs shrink-0">
                            {(req.users?.full_name || 'U').charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0 flex flex-col justify-center">
                            <div className="flex items-center gap-2 mb-1">
                              <p className="text-white text-sm font-semibold truncate leading-none">{req.users?.full_name || 'Unknown'}</p>
                              <span className="text-[10px] text-muted font-mono bg-white/5 px-1.5 py-0.5 rounded">
                                ID-{req.id.slice(0, 6).toUpperCase()}
                              </span>
                            </div>
                            <p className="text-muted text-[10px] uppercase tracking-wider font-medium truncate flex items-center gap-1.5">
                              {req.case_type && <span className="text-white/60">{req.case_type}</span>}
                              <span className="w-1 h-1 rounded-full bg-white/20" />
                              <span className="text-amber-500/80">{statusText}</span>
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-[10px] text-muted font-mono">{timeAgo(req.created_at)}</span>
                          <ChevronRight className="w-4 h-4 text-muted group-hover:text-white transition-colors" />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* BNS Transposer */}
            <div className="bg-[#0f0f0f] border border-white/5 rounded-lg p-6">
              <div className="flex items-center gap-2 mb-4">
                <Scale className="w-4 h-4 text-muted" />
                <h2 className="text-sm font-semibold text-white">BNS Strategic Transposer</h2>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-[1fr_2fr] gap-4 mb-4">
                <div>
                  <input type="text" placeholder="e.g. IPC 420" value={ipcSection}
                    onChange={e => setIpcSection(e.target.value)} className={inputClass} />
                </div>
                <div>
                  <input type="text" placeholder="Describe current strategy..."
                    value={strategy} onChange={e => setStrategy(e.target.value)} className={inputClass} />
                </div>
              </div>

              <button onClick={handleBns} disabled={bnsLoading || !ipcSection.trim() || !strategy.trim()}
                className="w-full py-2 rounded-md text-xs font-medium text-black bg-white hover:bg-neutral-200 disabled:opacity-50 transition-colors flex items-center justify-center gap-2 border-none cursor-pointer">
                {bnsLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Analyze BNS Impact'}
              </button>

              {bnsError && <div className="mt-4 p-3 rounded-md bg-red-500/10 text-red-400 text-xs border border-red-500/20">{bnsError}</div>}

              {bnsResult && (
                <div className="mt-5 pt-5 border-t border-white/5">
                  <div className="grid grid-cols-2 gap-6 mb-4">
                    <div>
                      <p className="text-[10px] text-muted font-medium uppercase tracking-wider mb-1">Mapping</p>
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-muted">{ipcSection}</span>
                        <ArrowRight className="w-3.5 h-3.5 text-muted/50" />
                        <span className="text-white font-medium">{bnsResult.bns_section}</span>
                      </div>
                    </div>
                    <div>
                      <p className="text-[10px] text-muted font-medium uppercase tracking-wider mb-1">Precedent Drift</p>
                      <span className="text-sm font-medium text-white">{normalizeDrift(bnsResult.semantic_drift_score)}% Deviation</span>
                    </div>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted font-medium uppercase tracking-wider mb-1">Strategy Shift</p>
                    <p className="text-xs text-white/80 leading-relaxed">{bnsResult.new_strategy || bnsResult.strategy_shift}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Activity Feed */}
          <div>
            <div className="flex items-center justify-between mb-4 border-b border-white/5 pb-2">
              <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                <Activity className="w-4 h-4 text-muted" /> Recent Activity
              </h2>
            </div>
            
            <div className="relative before:absolute before:inset-0 before:ml-[11px] before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-px before:bg-white/5">
              {activities.length === 0 ? (
                <div className="text-center p-4">
                  <p className="text-xs text-muted">No recent activity found.</p>
                </div>
              ) : (
                activities.map((act) => (
                  <div key={act.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group mb-6 last:mb-0">
                    <div className="flex items-center justify-center w-6 h-6 rounded bg-[#111] border border-white/10 shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 shadow-sm z-10">
                      {act.type === 'document' ? <FileText className="w-3 h-3 text-muted" /> :
                       act.type === 'message' ? <MessageSquare className="w-3 h-3 text-muted" /> :
                       act.type === 'analysis' ? <BrainCircuit className="w-3 h-3 text-muted" /> :
                       <Briefcase className="w-3 h-3 text-muted" />}
                    </div>
                    <div className="w-[calc(100%-2rem)] md:w-[calc(50%-1.5rem)] bg-[#0f0f0f] p-3 rounded-md border border-white/5 shadow-sm">
                      <p className="text-xs text-white/90 font-medium mb-1.5">{act.text}</p>
                      <p className="text-[10px] text-muted font-mono">{timeAgo(act.created_at)}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>
      </main>
    </div>
  )
}
