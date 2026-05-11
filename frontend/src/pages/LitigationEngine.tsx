import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  Target, Sparkles, Loader2, AlertTriangle, Shield,
  Clock, Gavel, BarChart3, ChevronRight, Scale, Zap, BookOpen,
} from 'lucide-react'
import { Sidebar } from '@/components/Sidebar'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'

/* ─── Types ─── */
interface Factor {
  score: number
  reasoning: string
}
interface SimilarCase {
  name: string
  outcome: string
  similarity: number
  key_takeaway: string
}
interface ProbabilityResult {
  success_probability: number
  confidence_level: string
  verdict_prediction: string
  factors: Record<string, Factor>
  similar_cases: SimilarCase[]
  risk_factors: string[]
  recommended_strategy: string
  estimated_duration: string
  optimal_court: string
}

/* ─── Constants ─── */
const caseTypes = ['Select Case Type', 'Patent Infringement', 'Trademark Dispute', 'Copyright Violation', 'Contract Breach', 'Property Dispute', 'Criminal Defense', 'Bail Application', 'Writ Petition', 'Arbitration', 'Consumer Protection', 'Labour Dispute', 'Tax Appeal', 'Debt Recovery', 'Matrimonial', 'Environmental']
const reliefTypes = ['Select Relief Type', 'Interim Injunction', 'Permanent Injunction', 'Damages/Compensation', 'Specific Performance', 'Declaration', 'Bail', 'Quashing of FIR', 'Stay Order', 'Arbitral Award Enforcement', 'Winding Up']

const inputClass = `w-full px-4 py-3 rounded-lg text-sm text-white placeholder-muted/50
  bg-[#0a0a0a] border border-[#1a1a1a] outline-none
  focus:border-primary focus:ring-1 focus:ring-primary/40 transition-all duration-200`

/* ─── Helpers ─── */
const probColor = (p: number) => p >= 65 ? 'text-green-400' : p >= 45 ? 'text-amber-400' : 'text-red-400'
const probGlow = (p: number) => p >= 65 ? '0 0 60px rgba(16,185,129,0.3)' : p >= 45 ? '0 0 60px rgba(245,158,11,0.3)' : '0 0 60px rgba(239,68,68,0.3)'
const factorColor = (s: number) => s >= 65 ? 'bg-green-500' : s >= 45 ? 'bg-amber-500' : 'bg-red-500'
const factorText = (s: number) => s >= 65 ? 'text-green-400' : s >= 45 ? 'text-amber-400' : 'text-red-400'

const factorMeta: Record<string, { label: string; icon: React.ElementType }> = {
  jurisdiction_advantage: { label: 'Jurisdiction Advantage', icon: Gavel },
  precedent_strength: { label: 'Precedent Strength', icon: BookOpen },
  relief_likelihood: { label: 'Relief Likelihood', icon: Shield },
  timeline_risk: { label: 'Timeline Risk', icon: Clock },
  evidence_strength: { label: 'Evidence Strength', icon: BarChart3 },
}

/* ═══════════════════════════════════════════════════════
   LEGAL RISK ASSESSMENT ENGINE
   ═══════════════════════════════════════════════════════ */
export default function LitigationEngine() {
  const { role } = useAuth()
  const [caseFacts, setCaseFacts] = useState('')
  const [caseType, setCaseType] = useState('Select Case Type')
  const [jurisdiction, setJurisdiction] = useState('')
  const [reliefSought, setReliefSought] = useState('Select Relief Type')
  const [analyzing, setAnalyzing] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<ProbabilityResult | null>(null)

  const handleAnalyze = async () => {
    if (!caseFacts.trim()) return
    setAnalyzing(true)
    setError('')
    setResult(null)
    try {
      const { data, error: fnError } = await supabase.functions.invoke('litigation-probability', {
        body: {
          case_facts: caseFacts.trim(),
          case_type: caseType === 'Select Case Type' ? null : caseType,
          jurisdiction: jurisdiction.trim() || null,
          relief_sought: reliefSought === 'Select Relief Type' ? null : reliefSought,
        },
      })
      if (fnError) throw fnError
      setResult(data as ProbabilityResult)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Analysis failed. Please try again.')
    } finally {
      setAnalyzing(false)
    }
  }

  return (
    <div className="min-h-screen bg-background text-white flex">
      <Sidebar role={role === 'lawyer' ? 'lawyer' : 'client'} />

      <main className="ml-60 flex-1 p-8 max-w-[1200px]">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Target className="w-7 h-7 text-primary" />
            <h1 className="text-2xl font-bold text-white">Legal Risk Assessment Engine</h1>
          </div>
          <p className="text-muted text-sm mb-3">
            AI-assisted risk assessment based on judicial patterns, precedent strength, and historical outcomes. Results are advisory — not legal advice.
          </p>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-accent/15 text-accent text-xs font-semibold">
            <Sparkles className="w-3 h-3" /> Assistive Legal Analytics
          </span>
        </div>

        {/* Input Form */}
        <div className="bg-[#111111] border border-primary/30 rounded-xl p-6 mb-8"
          style={{ boxShadow: '0 0 40px rgba(124,58,237,0.08)' }}>
          <div className="flex items-center gap-2 mb-1">
            <Scale className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-bold text-white">Analyze Your Case</h2>
          </div>
          <p className="text-muted text-sm mb-5">Provide case details for AI-assisted risk assessment. This is not a guarantee of outcome.</p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <textarea rows={4} placeholder="Describe the case facts, circumstances, and key evidence in detail..."
              value={caseFacts} onChange={e => setCaseFacts(e.target.value)}
              className={`${inputClass} resize-none md:col-span-2`} />
            <select value={caseType} onChange={e => setCaseType(e.target.value)} className={`${inputClass} cursor-pointer`}>
              {caseTypes.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <select value={reliefSought} onChange={e => setReliefSought(e.target.value)} className={`${inputClass} cursor-pointer`}>
              {reliefTypes.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
            <input type="text" placeholder="Jurisdiction (e.g., Delhi, Mumbai, Bangalore)"
              value={jurisdiction} onChange={e => setJurisdiction(e.target.value)}
              className={inputClass} />
          </div>

          <button onClick={handleAnalyze} disabled={analyzing || !caseFacts.trim()}
            className="w-full py-3.5 rounded-lg text-sm font-semibold text-black bg-white hover:bg-neutral-200
              disabled:opacity-50 transition-all duration-300 flex items-center justify-center gap-2 border-none cursor-pointer">
            {analyzing ? <><Loader2 className="w-4 h-4 animate-spin" /> Analyzing judicial patterns & precedents...</>
              : <><Sparkles className="w-4 h-4" /> Run Risk Assessment</>}
          </button>

          {error && (
            <div className="mt-4 p-3 rounded-lg border border-red-500/40 bg-red-500/10 text-red-400 text-sm">{error}</div>
          )}
        </div>

        {/* Results */}
        {result && (
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>

            {/* Probability Gauge */}
            <div className="bg-[#111111] border border-[#1a1a1a] rounded-xl p-8 mb-6 text-center"
              style={{ boxShadow: probGlow(result.success_probability) }}>
              <p className="text-xs text-muted uppercase tracking-widest mb-4">Recommendation Score</p>
              <motion.p
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
                className={`text-8xl font-extrabold ${probColor(result.success_probability)}`}
              >
                {result.success_probability}%
              </motion.p>
              <div className="flex items-center justify-center gap-4 mt-4">
                <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                  result.confidence_level === 'high' ? 'bg-green-500/15 text-green-400' :
                  result.confidence_level === 'moderate' ? 'bg-amber-500/15 text-amber-400' :
                  'bg-red-500/15 text-red-400'
                }`}>
                  {result.confidence_level.toUpperCase()} RELIABILITY
                </span>
                <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                  result.verdict_prediction.includes('favorable') ? 'bg-green-500/15 text-green-400' :
                  result.verdict_prediction.includes('unfavorable') ? 'bg-red-500/15 text-red-400' :
                  'bg-amber-500/15 text-amber-400'
                }`}>
                  {result.verdict_prediction.toUpperCase()}
                </span>
              </div>

              {/* Duration + court */}
              <div className="flex items-center justify-center gap-6 mt-5">
                {result.estimated_duration && (
                  <span className="text-muted text-xs flex items-center gap-1.5">
                    <Clock className="w-3 h-3" /> Est. Duration: <span className="text-white font-semibold">{result.estimated_duration}</span>
                  </span>
                )}
                {result.optimal_court && (
                  <span className="text-muted text-xs flex items-center gap-1.5">
                    <Gavel className="w-3 h-3" /> Optimal Court: <span className="text-white font-semibold">{result.optimal_court}</span>
                  </span>
                )}
              </div>
            </div>

            {/* Factor Breakdown */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              {Object.entries(result.factors || {}).map(([key, factor], i) => {
                const meta = factorMeta[key] || { label: key, icon: BarChart3 }
                const Icon = meta.icon
                return (
                  <motion.div key={key}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.1 * i }}
                    className="bg-[#111111] border border-[#1a1a1a] rounded-xl p-5"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Icon className="w-4 h-4 text-primary" />
                        <p className="text-sm font-semibold text-white">{meta.label}</p>
                      </div>
                      <span className={`text-lg font-extrabold ${factorText(factor.score)}`}>{factor.score}/100</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-white/5 overflow-hidden mb-3">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${factor.score}%` }}
                        transition={{ duration: 1, delay: 0.2 * i, ease: 'easeOut' }}
                        className={`h-full rounded-full ${factorColor(factor.score)}`}
                      />
                    </div>
                    <p className="text-xs text-muted leading-relaxed">{factor.reasoning}</p>
                  </motion.div>
                )
              })}
            </div>

            {/* Strategy + Risk */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              {/* Strategy */}
              <div className="bg-[#111111] border border-green-500/20 rounded-xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Zap className="w-4 h-4 text-green-400" />
                  <p className="text-sm font-bold text-white">Recommended Strategy</p>
                </div>
                <p className="text-sm text-muted leading-relaxed">{result.recommended_strategy}</p>
              </div>

              {/* Risks */}
              <div className="bg-[#111111] border border-red-500/20 rounded-xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <AlertTriangle className="w-4 h-4 text-red-400" />
                  <p className="text-sm font-bold text-white">Risk Factors</p>
                </div>
                <ul className="space-y-2">
                  {(result.risk_factors || []).map((r, i) => (
                    <li key={i} className="text-xs text-muted flex items-start gap-2">
                      <ChevronRight className="w-3 h-3 text-red-400 mt-0.5 shrink-0" />{r}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Similar Cases */}
            {result.similar_cases && result.similar_cases.length > 0 && (
              <div className="bg-[#111111] border border-[#1a1a1a] rounded-xl p-5">
                <div className="flex items-center gap-2 mb-4">
                  <BookOpen className="w-4 h-4 text-primary" />
                  <p className="text-sm font-bold text-white">Similar Precedents</p>
                </div>
                <div className="space-y-3">
                  {result.similar_cases.map((c, i) => (
                    <motion.div key={i}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.1 * i }}
                      className="flex items-center justify-between p-3 rounded-lg bg-white/[0.02] border border-white/5"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white font-medium truncate">{c.name}</p>
                        <p className="text-xs text-muted mt-0.5">{c.key_takeaway}</p>
                      </div>
                      <div className="flex items-center gap-3 shrink-0 ml-4">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                          c.outcome.toLowerCase().includes('won') || c.outcome.toLowerCase().includes('favorable')
                            ? 'bg-green-500/15 text-green-400'
                            : c.outcome.toLowerCase().includes('settled')
                            ? 'bg-amber-500/15 text-amber-400'
                            : 'bg-red-500/15 text-red-400'
                        }`}>
                          {c.outcome}
                        </span>
                        <span className="text-xs text-muted">{c.similarity}% match</span>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </main>
    </div>
  )
}
