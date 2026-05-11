import { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import {
  Map as MapIcon, Clock, Gavel, Zap, BrainCircuit, Loader2,
  GitCompare, X, Activity, Server, Database
} from 'lucide-react'
import { Sidebar } from '@/components/Sidebar'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'

/* ─── Types ─── */
interface CourtData {
  court_name: string
  state: string
  velocity_score: number
  injunction_rate: number
  pendency_days: number
}

interface CourtRecommendation {
  rank: number
  court_name: string
  state: string
  viability_score: number
  reasoning: string
  disposal_time: number
  injunction_rate: number
  velocity_score: number
  pendency_days: number
  pros: string[]
  cons: string[]
  estimated_timeline: string
  badge: string
}

/* ─── Fallback Data ─── */
const FALLBACK_COURTS: CourtData[] = [
  { court_name: 'Delhi High Court', state: 'Delhi', velocity_score: 82, injunction_rate: 71, pendency_days: 340 },
  { court_name: 'Bombay High Court', state: 'Maharashtra', velocity_score: 78, injunction_rate: 68, pendency_days: 410 },
  { court_name: 'Karnataka High Court', state: 'Karnataka', velocity_score: 75, injunction_rate: 62, pendency_days: 380 },
  { court_name: 'Kerala High Court', state: 'Kerala', velocity_score: 72, injunction_rate: 64, pendency_days: 370 },
  { court_name: 'Gujarat High Court', state: 'Gujarat', velocity_score: 71, injunction_rate: 60, pendency_days: 420 },
  { court_name: 'Madras High Court', state: 'Tamil Nadu', velocity_score: 65, injunction_rate: 55, pendency_days: 520 },
  { court_name: 'Punjab & Haryana HC', state: 'Punjab', velocity_score: 63, injunction_rate: 52, pendency_days: 490 },
  { court_name: 'Calcutta High Court', state: 'West Bengal', velocity_score: 58, injunction_rate: 45, pendency_days: 650 },
  { court_name: 'Rajasthan High Court', state: 'Rajasthan', velocity_score: 55, injunction_rate: 42, pendency_days: 580 },
  { court_name: 'Allahabad High Court', state: 'Uttar Pradesh', velocity_score: 42, injunction_rate: 38, pendency_days: 890 },
]

/* ─── Helpers ─── */
const normalizeScore = (val: number) => val <= 1 ? Math.round(val * 100) : Math.round(val)
const formatTextPercents = (text: string) => {
  if (!text) return text
  return text.replace(/\b0\.(\d+)\b/g, (_, p1) => `${p1.length === 1 ? p1 + "0" : p1.slice(0, 2)}%`)
}
const velColor = (v: number) => v >= 70 ? 'text-green-500' : v >= 40 ? 'text-amber-500' : 'text-red-500'
const pendColor = (d: number) => d <= 200 ? 'text-green-500' : d <= 350 ? 'text-amber-500' : 'text-red-500'

/* ─── Sparkline Component ─── */
function Sparkline({ data, color }: { data: number[], color: string }) {
  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1
  const points = data.map((d, i) => `${(i / (data.length - 1)) * 40},${15 - ((d - min) / range) * 15}`).join(' ')
  
  return (
    <svg width="40" height="15" className="overflow-visible" viewBox="0 0 40 15">
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/* ─── Mock Data Generators ─── */
const genTrend = (base: number) => Array.from({length: 6}, () => base + (Math.random() * 10 - 5))

const rankMeta: Record<number, { label: string; border: string; badge: string }> = {
  1: { label: '1st', border: 'border-white/20', badge: 'bg-white text-black' },
  2: { label: '2nd', border: 'border-white/5', badge: 'bg-[#222] text-white' },
  3: { label: '3rd', border: 'border-white/5', badge: 'bg-[#111] text-muted' },
}

const states = ['No preference', 'Maharashtra', 'Delhi', 'Tamil Nadu', 'Karnataka', 'Uttar Pradesh', 'West Bengal', 'Gujarat', 'Kerala']

const inputClass = `w-full px-3 py-2 rounded-md text-sm text-white placeholder-muted/40
  bg-[#111111] border border-white/10 outline-none
  focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all duration-200`

/* ─── Court Table Row ─── */
function CourtTableRow({ court, rank, onCompare, isComparing }: { court: CourtData; rank: number; onCompare: () => void; isComparing: boolean }) {
  const isTop = rank <= 3
  const trendData = genTrend(court.velocity_score)
  const isUp = trendData[trendData.length - 1] > trendData[0]
  const trendColor = isUp ? '#22c55e' : '#ef4444' // green-500 or red-500

  return (
    <motion.tr
      initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      className="border-b border-white/5 hover:bg-white/[0.02] transition-colors group"
    >
      <td className="py-3 px-4">
        <div className="flex items-center gap-3">
          <span className={`text-[10px] font-bold w-5 ${isTop ? 'text-white' : 'text-muted'}`}>#{rank}</span>
          <div>
            <p className="text-white text-xs font-semibold">{court.court_name}</p>
            <p className="text-muted text-[10px] uppercase tracking-wider">{court.state}</p>
          </div>
        </div>
      </td>
      <td className="py-3 px-4">
        <div className="flex items-center gap-2">
          <span className={`text-xs font-bold ${velColor(court.velocity_score)}`}>{court.velocity_score}</span>
          <Sparkline data={trendData} color={trendColor} />
        </div>
      </td>
      <td className="py-3 px-4 text-xs font-medium text-white">{court.injunction_rate}%</td>
      <td className={`py-3 px-4 text-xs font-medium ${pendColor(court.pendency_days)}`}>{court.pendency_days}d</td>
      <td className="py-3 px-4 text-right">
        <button
          onClick={onCompare}
          className={`px-3 py-1.5 rounded flex items-center gap-1.5 text-[10px] font-medium transition-colors border-none cursor-pointer ml-auto
            ${isComparing ? 'bg-white text-black' : 'bg-[#1a1a1a] text-muted hover:text-white group-hover:bg-[#252525]'}`}
        >
          <GitCompare className="w-3 h-3" /> Compare
        </button>
      </td>
    </motion.tr>
  )
}

/* ─── Recommendation Card ─── */
function RecommendationCard({ rec, index }: { rec: CourtRecommendation; index: number }) {
  const meta = rankMeta[rec.rank] || rankMeta[3]
  const nv = normalizeScore(rec.viability_score)
  const scoreColor = nv >= 70 ? 'text-green-500' : nv >= 40 ? 'text-amber-500' : 'text-red-500'
  const nInj = normalizeScore(rec.injunction_rate || 0)
  const nVel = normalizeScore(rec.velocity_score || 0)

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.1 }}
      className={`bg-[#0f0f0f] ${meta.border} border rounded-lg p-5 flex flex-col`}
    >
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-white/5">
        <div className="flex items-center gap-2">
          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${meta.badge}`}>Rank #{rec.rank}</span>
        </div>
        {rec.rank === 1 && (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-green-500/20 text-green-400">
            {rec.badge || 'OPTIMAL'}
          </span>
        )}
      </div>

      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-base font-bold text-white mb-0.5">{rec.court_name}</h3>
          <p className="text-muted text-[10px] uppercase tracking-wider">{rec.state}</p>
        </div>
        <div className="text-right">
          <span className={`text-2xl font-bold tracking-tight ${scoreColor}`}>{nv}</span>
          <span className="text-muted text-[10px] ml-0.5">/ 100</span>
        </div>
      </div>

      <p className="text-white/80 text-xs leading-relaxed mb-5 flex-1">{rec.reasoning}</p>

      <div className="grid grid-cols-3 gap-2 mb-5">
        <div className="bg-[#151515] rounded p-2 text-center border border-white/5">
          <p className="text-[10px] text-muted mb-0.5 font-medium">Disposal</p>
          <p className="text-xs text-white font-semibold">{rec.pendency_days || rec.disposal_time || '—'}d</p>
        </div>
        <div className="bg-[#151515] rounded p-2 text-center border border-white/5">
          <p className="text-[10px] text-muted mb-0.5 font-medium">Injunction</p>
          <p className="text-xs text-white font-semibold">{nInj}%</p>
        </div>
        <div className="bg-[#151515] rounded p-2 text-center border border-white/5">
          <p className="text-[10px] text-muted mb-0.5 font-medium">Velocity</p>
          <p className="text-xs text-white font-semibold">{nVel}</p>
        </div>
      </div>

      <div className="space-y-3 mt-auto pt-4 border-t border-white/5">
        {rec.pros && rec.pros.length > 0 && (
          <div>
            <p className="text-[10px] font-semibold text-green-500 uppercase tracking-wider mb-1.5">Advantages</p>
            <ul className="space-y-1">
              {rec.pros.slice(0, 3).map((p, i) => (
                <li key={i} className="text-xs text-muted flex items-start gap-1.5">
                  <span className="w-1 h-1 rounded-full bg-green-500 mt-1.5 shrink-0" />{p}
                </li>
              ))}
            </ul>
          </div>
        )}
        {rec.cons && rec.cons.length > 0 && (
          <div>
            <p className="text-[10px] font-semibold text-red-500 uppercase tracking-wider mb-1.5">Risks</p>
            <ul className="space-y-1">
              {rec.cons.slice(0, 2).map((c, i) => (
                <li key={i} className="text-xs text-muted flex items-start gap-1.5">
                  <span className="w-1 h-1 rounded-full bg-red-500 mt-1.5 shrink-0" />{c}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </motion.div>
  )
}

/* ═══════════════════════════════════════════════════════
   JURISDICTION ANALYTICS TERMINAL
   ═══════════════════════════════════════════════════════ */
export default function CourtArbitrage() {
  const { role } = useAuth()
  const [courts, setCourts] = useState<CourtData[]>([])
  const [loading, setLoading] = useState(true)

  const [summary, setSummary] = useState('')
  const [stateFilter, setStateFilter] = useState('No preference')
  const [analyzing, setAnalyzing] = useState(false)
  const [analyzeError, setAnalyzeError] = useState('')
  const [recommendations, setRecommendations] = useState<CourtRecommendation[]>([])
  const [compareSlots, setCompareSlots] = useState<[string | null, string | null]>([null, null])
  const recsRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const fetch = async () => {
      setLoading(true)
      try {
        const { data, error } = await supabase.from('court_scores').select('*')
        if (error || !data || data.length === 0) {
          setCourts(FALLBACK_COURTS)
        } else {
          const normalized = (data as CourtData[]).map(c => ({
            ...c,
            velocity_score: normalizeScore(c.velocity_score),
            injunction_rate: normalizeScore(c.injunction_rate),
          }))
          const deduped = Array.from(new Map(normalized.map(c => [c.court_name, c])).values())
          setCourts(deduped)
        }
      } catch {
        setCourts(FALLBACK_COURTS)
      } finally {
        setLoading(false)
      }
    }
    fetch()
  }, [])

  const sorted = [...courts].sort((a, b) => b.velocity_score - a.velocity_score)
  const getRank = (name: string) => sorted.findIndex(c => c.court_name === name) + 1

  const getBadge = (rec: CourtRecommendation, idx: number): string => {
    if (idx === 0) {
      if (normalizeScore(rec.injunction_rate || 0) >= 65) return 'TOP INJUNCTION RATE'
      if ((rec.pendency_days || 999) <= 300) return 'FASTEST DISPOSAL'
      return 'BEST OVERALL'
    }
    if (normalizeScore(rec.velocity_score || 0) >= 75) return 'HIGH VELOCITY'
    if ((rec.pendency_days || 999) <= 400) return 'FAST TRACK'
    return ''
  }

  const handleAnalyze = async () => {
    if (!summary.trim()) return
    setAnalyzing(true)
    setAnalyzeError('')
    setRecommendations([])
    try {
      const { data, error } = await supabase.functions.invoke('court-arbitrage', {
        body: { case_summary: summary.trim(), client_state: stateFilter === 'No preference' ? null : stateFilter },
      })
      if (error) throw error

      const rankedMap = new Map<string, Record<string, unknown>>()
      if (data?.ranked_courts) {
        for (const rc of data.ranked_courts) {
          rankedMap.set(rc.court_name, rc)
        }
      }

      const enriched = (data?.recommendations || []).map((rec: CourtRecommendation, idx: number) => {
        const courtData = rankedMap.get(rec.court_name) || {}
        const merged = {
          ...rec,
          reasoning: formatTextPercents(rec.reasoning),
          viability_score: normalizeScore((courtData as Record<string, number>).viability_score ?? rec.viability_score ?? 0),
          velocity_score: normalizeScore((courtData as Record<string, number>).velocity_score ?? rec.velocity_score ?? 0),
          injunction_rate: normalizeScore((courtData as Record<string, number>).injunction_rate ?? rec.injunction_rate ?? 0),
          pendency_days: (courtData as Record<string, number>).pendency_days ?? rec.pendency_days ?? 0,
          state: (courtData as Record<string, string>).state ?? rec.state ?? '',
          pros: (rec.pros || []).map(formatTextPercents),
          cons: (rec.cons || []).map(formatTextPercents),
          estimated_timeline: formatTextPercents(rec.estimated_timeline || ''),
          badge: '',
        }
        merged.badge = getBadge(merged, idx)
        return merged
      })

      setRecommendations(enriched)
      setTimeout(() => recsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 300)
    } catch (err: unknown) {
      setAnalyzeError(err instanceof Error ? err.message : 'Analysis failed')
    } finally {
      setAnalyzing(false)
    }
  }

  const toggleCompare = (name: string) => {
    setCompareSlots(prev => {
      if (prev[0] === name) return [null, prev[1]]
      if (prev[1] === name) return [prev[0], null]
      if (!prev[0]) return [name, prev[1]]
      if (!prev[1]) return [prev[0], name]
      return [name, null]
    })
  }
  const compareActive = compareSlots[0] && compareSlots[1]
  const compA = sorted.find(c => c.court_name === compareSlots[0])
  const compB = sorted.find(c => c.court_name === compareSlots[1])

  return (
    <div className="min-h-screen bg-background text-white flex selection:bg-white/20">
      <Sidebar role={role === 'lawyer' ? 'lawyer' : 'client'} />

      <main className="ml-60 flex-1 p-8 max-w-[1400px]">
        <div className="flex items-center justify-between mb-8 border-b border-white/5 pb-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-white mb-2">Jurisdiction Analytics Terminal</h1>
            <div className="flex items-center gap-4 text-[10px] uppercase tracking-wider font-medium text-muted">
              <span className="flex items-center gap-1.5"><Server className="w-3 h-3" /> System: Online</span>
              <span className="flex items-center gap-1.5"><Database className="w-3 h-3" /> Dataset: Sample Court Metrics</span>
              <span className="flex items-center gap-1.5 text-green-500"><Activity className="w-3 h-3" /> Last Synced: 2m ago</span>
            </div>
          </div>
        </div>

        {/* ── AI Case Analyzer ── */}
        <div className="bg-[#0f0f0f] border border-white/5 rounded-lg p-6 mb-8">
          <div className="flex items-center gap-2 mb-4 border-b border-white/5 pb-2">
            <BrainCircuit className="w-4 h-4 text-muted" />
            <h2 className="text-sm font-semibold text-white">Jurisdiction Analytics Engine</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-[1fr_200px] gap-4 mb-4">
            <textarea rows={2} placeholder="Describe the matter details..."
              value={summary} onChange={e => setSummary(e.target.value)}
              className={`${inputClass} resize-none`} />
            <select value={stateFilter} onChange={e => setStateFilter(e.target.value)}
              className={inputClass}>
              {states.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <button onClick={handleAnalyze} disabled={analyzing || !summary.trim()}
            className="w-full py-2.5 rounded-md text-xs font-medium text-black bg-white hover:bg-neutral-200 disabled:opacity-50 transition-colors flex items-center justify-center gap-2 border-none cursor-pointer">
            {analyzing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Run Analysis'}
          </button>

          {analyzeError && <div className="mt-4 p-3 rounded-md bg-red-500/10 text-red-400 text-xs border border-red-500/20">{analyzeError}</div>}
        </div>

        {/* ── Recommendations ── */}
        {recommendations.length > 0 && (
          <div ref={recsRef} className="mb-10">
            <h2 className="text-sm font-semibold text-white mb-4 flex items-center gap-2 border-b border-white/5 pb-2">
              <Zap className="w-4 h-4 text-muted" /> Strategic Recommendations
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {recommendations.slice(0, 3).map((rec, i) => (
                <RecommendationCard key={rec.court_name} rec={{ ...rec, rank: i + 1 }} index={i} />
              ))}
            </div>
          </div>
        )}

        {/* ── Court Heatmap Grid ── */}
        <div>
          <h2 className="text-sm font-semibold text-white mb-4 flex items-center gap-2 border-b border-white/5 pb-2">
            <MapIcon className="w-4 h-4 text-muted" /> Global Court Metrics
          </h2>

          {loading ? (
            <div className="bg-[#0f0f0f] border border-white/5 rounded-lg h-96 animate-pulse" />
          ) : (
            <div className="bg-[#0f0f0f] border border-white/5 rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[700px]">
                  <thead>
                    <tr className="border-b border-white/5 bg-[#141414]">
                      <th className="py-3 px-4 text-[10px] font-semibold uppercase tracking-wider text-muted">Jurisdiction</th>
                      <th className="py-3 px-4 text-[10px] font-semibold uppercase tracking-wider text-muted">Velocity & Trend</th>
                      <th className="py-3 px-4 text-[10px] font-semibold uppercase tracking-wider text-muted">Injunction Rate</th>
                      <th className="py-3 px-4 text-[10px] font-semibold uppercase tracking-wider text-muted">Avg Disposal</th>
                      <th className="py-3 px-4 text-[10px] font-semibold uppercase tracking-wider text-muted text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sorted.map((court) => (
                      <CourtTableRow 
                        key={court.court_name} 
                        court={court} 
                        rank={getRank(court.court_name)} 
                        onCompare={() => toggleCompare(court.court_name)}
                        isComparing={compareSlots.includes(court.court_name)}
                      />
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Comparison Panel */}
              {compareActive && compA && compB && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                  className="mt-6 bg-[#0f0f0f] border border-white/10 rounded-lg p-5">
                  <div className="flex items-center justify-between mb-4 border-b border-white/5 pb-3">
                    <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                      <GitCompare className="w-4 h-4 text-muted" /> Variance Analysis
                    </h3>
                    <button onClick={() => setCompareSlots([null, null])}
                      className="p-1 rounded bg-transparent text-muted hover:text-white border-none cursor-pointer">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="grid grid-cols-3 gap-y-4 gap-x-2 text-xs">
                    <div className="text-muted font-medium uppercase tracking-wider text-[10px]">Metric</div>
                    <div className="text-white font-semibold text-center border-b border-white/5 pb-2">{compA.court_name}</div>
                    <div className="text-white font-semibold text-center border-b border-white/5 pb-2">{compB.court_name}</div>

                    <div className="text-muted flex items-center gap-1.5"><Zap className="w-3 h-3" /> Velocity Score</div>
                    <div className={`text-center font-medium ${compA.velocity_score >= compB.velocity_score ? 'text-green-500' : 'text-red-500'}`}>{compA.velocity_score}/100</div>
                    <div className={`text-center font-medium ${compB.velocity_score >= compA.velocity_score ? 'text-green-500' : 'text-red-500'}`}>{compB.velocity_score}/100</div>

                    <div className="text-muted flex items-center gap-1.5"><Gavel className="w-3 h-3" /> Injunction Rate</div>
                    <div className={`text-center font-medium ${compA.injunction_rate >= compB.injunction_rate ? 'text-green-500' : 'text-red-500'}`}>{compA.injunction_rate}%</div>
                    <div className={`text-center font-medium ${compB.injunction_rate >= compA.injunction_rate ? 'text-green-500' : 'text-red-500'}`}>{compB.injunction_rate}%</div>

                    <div className="text-muted flex items-center gap-1.5"><Clock className="w-3 h-3" /> Avg. Disposal</div>
                    <div className={`text-center font-medium ${compA.pendency_days <= compB.pendency_days ? 'text-green-500' : 'text-red-500'}`}>{compA.pendency_days}d</div>
                    <div className={`text-center font-medium ${compB.pendency_days <= compA.pendency_days ? 'text-green-500' : 'text-red-500'}`}>{compB.pendency_days}d</div>
                  </div>
                </motion.div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
