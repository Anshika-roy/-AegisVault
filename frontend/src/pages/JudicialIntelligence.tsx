import { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  BrainCircuit, Search, Filter, TrendingUp, Clock, Gavel, Shield,
  ChevronRight, Sparkles, BarChart3, Target, AlertTriangle, Award,
} from 'lucide-react'
import { Sidebar } from '@/components/Sidebar'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'

/* ─── Types ─── */
interface JudgeProfile {
  id: string
  judge_name: string
  court_name: string
  bench: string
  domain: string
  total_cases_analyzed: number
  injunction_grant_rate: number
  avg_disposal_days: number
  dismissal_rate: number
  settlement_rate: number
  appeal_overturn_rate: number
  notable_precedents: string[]
  specialization_score: number
  data_period: string
}

/* ─── Constants ─── */
const domains = ['All', 'IP', 'Criminal', 'Commercial', 'Constitutional', 'Civil', 'Family', 'Labour']
const courts = ['All Courts', 'Delhi High Court', 'Bombay High Court', 'Madras High Court', 'Karnataka High Court', 'Kerala High Court', 'Gujarat High Court', 'Calcutta High Court', 'Allahabad High Court', 'Punjab & Haryana HC']

const inputClass = `w-full px-4 py-3 rounded-lg text-sm text-white placeholder-muted/50
  bg-[#0a0a0a] border border-[#1a1a1a] outline-none
  focus:border-primary focus:ring-1 focus:ring-primary/40 transition-all duration-200`

/* ─── Helpers ─── */
const pct = (v: number) => v <= 1 ? Math.round(v * 100) : Math.round(v)
const rateColor = (v: number) => {
  const n = pct(v)
  return n >= 60 ? 'text-green-400' : n >= 40 ? 'text-amber-400' : 'text-red-400'
}
const rateBg = (v: number) => {
  const n = pct(v)
  return n >= 60 ? 'bg-green-500' : n >= 40 ? 'bg-amber-500' : 'bg-red-500'
}
const specColor = (s: number) => s >= 85 ? 'text-green-400' : s >= 70 ? 'text-amber-400' : 'text-red-400'
const dispColor = (d: number) => d <= 30 ? 'text-green-400' : d <= 50 ? 'text-amber-400' : 'text-red-400'

/* ─── Stat Pill ─── */
function Stat({ icon: Icon, label, value, color }: { icon: React.ElementType; label: string; value: string; color?: string }) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/[0.03] border border-white/[0.05]">
      <Icon className={`w-3.5 h-3.5 ${color || 'text-muted'}`} />
      <div>
        <p className="text-[10px] text-muted uppercase tracking-wider">{label}</p>
        <p className={`text-sm font-bold ${color || 'text-white'}`}>{value}</p>
      </div>
    </div>
  )
}

/* ─── Judge Card ─── */
function JudgeCard({ judge, rank }: { judge: JudgeProfile; rank: number }) {
  const [expanded, setExpanded] = useState(false)
  const injRate = pct(judge.injunction_grant_rate)
  const dismRate = pct(judge.dismissal_rate)
  const settRate = pct(judge.settlement_rate)
  const appealRate = pct(judge.appeal_overturn_rate)

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: rank * 0.05 }}
      className="bg-[#111111] border border-[#1a1a1a] rounded-xl overflow-hidden hover:border-primary/30 transition-all duration-300"
    >
      <div className="p-5">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">#{rank}</span>
              <span className="text-xs text-muted bg-white/5 px-2 py-0.5 rounded-full">{judge.bench}</span>
            </div>
            <h3 className="text-white font-bold text-base truncate">{judge.judge_name}</h3>
            <p className="text-muted text-xs mt-0.5">{judge.court_name}</p>
          </div>
          <div className="text-right shrink-0 ml-3">
            <p className="text-[10px] text-muted uppercase">Specialization</p>
            <p className={`text-2xl font-extrabold ${specColor(judge.specialization_score)}`}>{Math.round(judge.specialization_score)}</p>
            <p className="text-[10px] text-muted">/100</p>
          </div>
        </div>

        {/* Domain badge */}
        <div className="flex items-center gap-2 mb-4">
          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-primary/15 text-primary">
            {judge.domain}
          </span>
          <span className="text-[10px] text-muted">{judge.total_cases_analyzed.toLocaleString()} cases analyzed • {judge.data_period}</span>
        </div>

        {/* Key metrics */}
        <div className="grid grid-cols-2 gap-2 mb-4">
          <Stat icon={Gavel} label="Injunction Rate" value={`${injRate}%`} color={rateColor(judge.injunction_grant_rate)} />
          <Stat icon={Clock} label="Avg Disposal" value={`${judge.avg_disposal_days}d`} color={dispColor(judge.avg_disposal_days)} />
          <Stat icon={AlertTriangle} label="Dismissal Rate" value={`${dismRate}%`} color={dismRate <= 20 ? 'text-green-400' : dismRate <= 30 ? 'text-amber-400' : 'text-red-400'} />
          <Stat icon={TrendingUp} label="Settlement Rate" value={`${settRate}%`} color="text-blue-400" />
        </div>

        {/* Injunction bar */}
        <div className="mb-3">
          <div className="flex justify-between text-[10px] text-muted mb-1">
            <span>Injunction Grant Rate</span>
            <span className={rateColor(judge.injunction_grant_rate)}>{injRate}%</span>
          </div>
          <div className="w-full h-2 rounded-full bg-white/5 overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${injRate}%` }}
              transition={{ duration: 1, delay: rank * 0.05, ease: 'easeOut' }}
              className={`h-full rounded-full ${rateBg(judge.injunction_grant_rate)}`}
            />
          </div>
        </div>

        {/* Appeal overturn */}
        <div className="flex items-center justify-between text-xs mb-3">
          <span className="text-muted">Appeal Overturn Risk</span>
          <span className={`font-semibold ${appealRate <= 12 ? 'text-green-400' : appealRate <= 18 ? 'text-amber-400' : 'text-red-400'}`}>
            {appealRate}%
          </span>
        </div>

        {/* Expand toggle */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center justify-center gap-1 text-xs text-muted hover:text-primary transition-colors bg-transparent border-none cursor-pointer py-1"
        >
          <ChevronRight className={`w-3 h-3 transition-transform ${expanded ? 'rotate-90' : ''}`} />
          {expanded ? 'Hide' : 'Show'} Precedents
        </button>
      </div>

      {/* Expanded: Notable Precedents */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-4 pt-2 border-t border-white/5">
              <p className="text-[10px] text-muted uppercase tracking-wider mb-2">Notable Precedents</p>
              <ul className="space-y-1.5">
                {judge.notable_precedents.map((p, i) => (
                  <li key={i} className="text-xs text-muted flex items-start gap-2">
                    <Award className="w-3 h-3 text-primary mt-0.5 shrink-0" />
                    {p}
                  </li>
                ))}
              </ul>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

/* ═══════════════════════════════════════════════════════
   JUDICIAL INTELLIGENCE DASHBOARD
   ═══════════════════════════════════════════════════════ */
export default function JudicialIntelligence() {
  const { role } = useAuth()
  const [judges, setJudges] = useState<JudgeProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [domainFilter, setDomainFilter] = useState('All')
  const [courtFilter, setCourtFilter] = useState('All Courts')
  const [sortBy, setSortBy] = useState<'specialization' | 'injunction' | 'disposal' | 'cases'>('specialization')

  useEffect(() => {
    const fetchJudges = async () => {
      setLoading(true)
      try {
        const { data, error } = await supabase.from('judicial_intelligence').select('*')
        if (error) throw error
        setJudges((data || []) as JudgeProfile[])
      } catch {
        setJudges([])
      } finally {
        setLoading(false)
      }
    }
    fetchJudges()
  }, [])

  // Filter + sort
  const filtered = useMemo(() => {
    let result = [...judges]

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      result = result.filter(j =>
        j.judge_name.toLowerCase().includes(q) ||
        j.court_name.toLowerCase().includes(q) ||
        j.domain.toLowerCase().includes(q)
      )
    }
    if (domainFilter !== 'All') {
      result = result.filter(j => j.domain === domainFilter)
    }
    if (courtFilter !== 'All Courts') {
      result = result.filter(j => j.court_name === courtFilter)
    }

    switch (sortBy) {
      case 'specialization': result.sort((a, b) => b.specialization_score - a.specialization_score); break
      case 'injunction': result.sort((a, b) => b.injunction_grant_rate - a.injunction_grant_rate); break
      case 'disposal': result.sort((a, b) => a.avg_disposal_days - b.avg_disposal_days); break
      case 'cases': result.sort((a, b) => b.total_cases_analyzed - a.total_cases_analyzed); break
    }

    return result
  }, [judges, searchQuery, domainFilter, courtFilter, sortBy])

  // Summary stats
  const totalCases = judges.reduce((sum, j) => sum + j.total_cases_analyzed, 0)
  const avgInjunction = judges.length > 0 ? Math.round(judges.reduce((s, j) => s + pct(j.injunction_grant_rate), 0) / judges.length) : 0
  const avgDisposal = judges.length > 0 ? Math.round(judges.reduce((s, j) => s + j.avg_disposal_days, 0) / judges.length) : 0

  return (
    <div className="min-h-screen bg-background text-white flex">
      <Sidebar role={role === 'lawyer' ? 'lawyer' : 'client'} />

      <main className="ml-60 flex-1 p-8 max-w-[1200px]">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <BrainCircuit className="w-7 h-7 text-primary" />
            <h1 className="text-2xl font-bold text-white">Judicial Behavioral Intelligence</h1>
          </div>
          <p className="text-muted text-sm mb-3">
            AI-analyzed behavioral patterns of Indian High Court judges. Injunction tendencies, disposal velocity, and specialization scores from simulated case data.
          </p>
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-accent/15 text-accent text-xs font-semibold">
              <Sparkles className="w-3 h-3" /> {totalCases.toLocaleString()} Cases Analyzed
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/5 text-muted text-xs">
              <Target className="w-3 h-3" /> {judges.length} Judges Profiled
            </span>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            className="bg-[#111111] border border-[#1a1a1a] rounded-xl p-5">
            <div className="flex items-center gap-2 mb-2">
              <BarChart3 className="w-4 h-4 text-primary" />
              <p className="text-xs text-muted uppercase">Total Cases Analyzed</p>
            </div>
            <p className="text-3xl font-extrabold text-white">{totalCases.toLocaleString()}</p>
            <p className="text-xs text-muted mt-1">Across {judges.length} judges, 9 High Courts</p>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
            className="bg-[#111111] border border-[#1a1a1a] rounded-xl p-5">
            <div className="flex items-center gap-2 mb-2">
              <Gavel className="w-4 h-4 text-green-400" />
              <p className="text-xs text-muted uppercase">Avg Injunction Rate</p>
            </div>
            <p className="text-3xl font-extrabold text-green-400">{avgInjunction}%</p>
            <p className="text-xs text-muted mt-1">Interim relief grant probability</p>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
            className="bg-[#111111] border border-[#1a1a1a] rounded-xl p-5">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-4 h-4 text-amber-400" />
              <p className="text-xs text-muted uppercase">Avg Disposal Time</p>
            </div>
            <p className="text-3xl font-extrabold text-amber-400">{avgDisposal}d</p>
            <p className="text-xs text-muted mt-1">Mean case resolution duration</p>
          </motion.div>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
            <input
              type="text"
              placeholder="Search judge, court, or domain..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className={`${inputClass} pl-10`}
            />
          </div>
          <select value={domainFilter} onChange={e => setDomainFilter(e.target.value)}
            className={`${inputClass} cursor-pointer`}>
            {domains.map(d => <option key={d} value={d}>{d === 'All' ? 'All Domains' : d}</option>)}
          </select>
          <select value={courtFilter} onChange={e => setCourtFilter(e.target.value)}
            className={`${inputClass} cursor-pointer`}>
            {courts.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={sortBy} onChange={e => setSortBy(e.target.value as typeof sortBy)}
            className={`${inputClass} cursor-pointer`}>
            <option value="specialization">Sort: Specialization ↓</option>
            <option value="injunction">Sort: Injunction Rate ↓</option>
            <option value="disposal">Sort: Fastest Disposal ↑</option>
            <option value="cases">Sort: Most Cases ↓</option>
          </select>
        </div>

        {/* Results count */}
        <div className="flex items-center gap-2 mb-5">
          <Filter className="w-4 h-4 text-muted" />
          <p className="text-muted text-sm">
            Showing <span className="text-white font-semibold">{filtered.length}</span> of {judges.length} judges
          </p>
        </div>

        {/* Judge Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="bg-[#111111] border border-[#1a1a1a] rounded-xl h-64 animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <Shield className="w-12 h-12 text-muted mx-auto mb-4" />
            <p className="text-muted text-sm">No judges found matching your filters.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filtered.map((judge, i) => (
              <JudgeCard key={judge.id} judge={judge} rank={i + 1} />
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
