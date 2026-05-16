import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  Crosshair, Loader2, AlertTriangle, ShieldAlert, HelpCircle,
  FileWarning, ChevronRight, Target, Eye, Zap, XCircle, MessageCircle,
} from 'lucide-react'
import { Sidebar } from '@/components/Sidebar'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'

/* ─── Types ─── */
interface Contradiction {
  type: string
  description: string
  severity: string
  quote: string
}
interface WeakPoint {
  area: string
  description: string
  exploitation_strategy: string
}
interface CrossQuestion {
  question: string
  purpose: string
  expected_impact: string
}
interface CrossExamResult {
  credibility_score: number
  credibility_assessment: string
  contradictions: Contradiction[]
  weak_points: WeakPoint[]
  cross_examination_questions: CrossQuestion[]
  missing_elements: string[]
  admissibility_issues: string[]
  overall_assessment: string
}

/* ─── Constants ─── */
const docTypes = ['Witness Statement', 'FIR', 'Affidavit', 'Complaint', 'Charge Sheet', 'Deposition']

const inputClass = `w-full px-4 py-3 rounded-lg text-sm text-white placeholder-muted/50
  bg-[#0a0a0a] border border-[#1a1a1a] outline-none
  focus:border-primary focus:ring-1 focus:ring-primary/40 transition-all duration-200`

/* ─── Helpers ─── */
const credColor = (s: number) => s >= 70 ? 'text-green-400' : s >= 40 ? 'text-amber-400' : 'text-red-400'
const credGlow = (s: number) => s >= 70 ? '0 0 40px rgba(16,185,129,0.2)' : s >= 40 ? '0 0 40px rgba(245,158,11,0.2)' : '0 0 40px rgba(239,68,68,0.3)'
const sevColor = (s: string) => s === 'critical' ? 'border-red-500/40 bg-red-500/5' : s === 'major' ? 'border-amber-500/40 bg-amber-500/5' : 'border-white/10 bg-white/[0.02]'
const sevBadge = (s: string) => s === 'critical' ? 'bg-red-500/15 text-red-400' : s === 'major' ? 'bg-amber-500/15 text-amber-400' : 'bg-white/10 text-muted'
const impactBadge = (i: string) => i === 'high' ? 'bg-red-500/15 text-red-400' : i === 'medium' ? 'bg-amber-500/15 text-amber-400' : 'bg-white/10 text-muted'

/* ═══════════════════════════════════════════════════════
   CROSS-EXAMINATION SIMULATOR
   ═══════════════════════════════════════════════════════ */
export default function CrossExamSimulator() {
  const { role } = useAuth()
  const [docText, setDocText] = useState('')
  const [docType, setDocType] = useState('Witness Statement')
  const [analyzing, setAnalyzing] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<CrossExamResult | null>(null)

  const handleAnalyze = async () => {
    if (!docText.trim()) return
    setAnalyzing(true)
    setError('')
    setResult(null)
    try {
      const { data, error: fnError } = await supabase.functions.invoke('cross-examine', {
        body: { document_text: docText.trim(), document_type: docType },
      })
      if (fnError) throw fnError
      setResult(data as CrossExamResult)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Analysis failed.')
    } finally {
      setAnalyzing(false)
    }
  }

  const criticalCount = result?.contradictions?.filter(c => c.severity === 'critical').length || 0
  const majorCount = result?.contradictions?.filter(c => c.severity === 'major').length || 0

  return (
    <div className="min-h-screen bg-background text-white flex">
      <Sidebar role={role === 'lawyer' ? 'lawyer' : 'client'} />

      <main className="ml-60 flex-1 p-8 max-w-[1200px]">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Crosshair className="w-7 h-7 text-red-400" />
            <h1 className="text-2xl font-bold text-white">Cross-Examination Simulator</h1>
          </div>
          <p className="text-muted text-sm mb-3">
            AI-powered contradiction finder. Paste a witness statement, FIR, or affidavit — the AI will expose every weakness.
          </p>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-500/15 text-red-400 text-xs font-semibold">
            <ShieldAlert className="w-3 h-3" /> Adversarial Analysis Engine
          </span>
        </div>

        {/* Input */}
        <div className="bg-[#111111] border border-red-500/20 rounded-xl p-6 mb-8"
          style={{ boxShadow: '0 0 40px rgba(239,68,68,0.05)' }}>
          <div className="flex items-center gap-2 mb-1">
            <FileWarning className="w-5 h-5 text-red-400" />
            <h2 className="text-lg font-bold text-white">Upload Document for Analysis</h2>
          </div>
          <p className="text-muted text-sm mb-5">Paste the full text of the document to find contradictions and weak points.</p>

          <div className="grid grid-cols-1 gap-4 mb-4">
            <div className="flex gap-3">
              {docTypes.map(dt => (
                <button key={dt} onClick={() => setDocType(dt)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border-none cursor-pointer
                    ${docType === dt ? 'bg-red-500/15 text-red-400' : 'bg-white/5 text-muted hover:bg-white/10'}`}>
                  {dt}
                </button>
              ))}
            </div>
            <textarea rows={8}
              placeholder="Paste the witness statement, FIR, affidavit, or complaint text here..."
              value={docText} onChange={e => setDocText(e.target.value)}
              className={`${inputClass} resize-none font-mono text-xs leading-relaxed`} />
          </div>

          <button onClick={handleAnalyze} disabled={analyzing || !docText.trim()}
            className="w-full py-3.5 rounded-lg text-sm font-semibold text-white bg-red-600 hover:bg-red-500
              disabled:opacity-50 transition-all duration-300 flex items-center justify-center gap-2 border-none cursor-pointer">
            {analyzing ? <><Loader2 className="w-4 h-4 animate-spin" /> Scanning for contradictions &amp; weak points...</>
              : <><Crosshair className="w-4 h-4" /> Analyze Document</>}
          </button>

          {error && (
            <div className="mt-4 p-3 rounded-lg border border-red-500/40 bg-red-500/10 text-red-400 text-sm">{error}</div>
          )}
        </div>

        {/* Results */}
        {result && (
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>

            {/* Credibility Score */}
            <div className="bg-[#111111] border border-[#1a1a1a] rounded-xl p-8 mb-6 text-center"
              style={{ boxShadow: credGlow(result.credibility_score) }}>
              <p className="text-xs text-muted uppercase tracking-widest mb-3">Document Credibility</p>
              <motion.p
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
                className={`text-7xl font-extrabold ${credColor(result.credibility_score)}`}
              >
                {result.credibility_score}/100
              </motion.p>
              <span className={`mt-3 inline-block px-3 py-1 rounded-full text-xs font-semibold ${
                result.credibility_assessment === 'high' ? 'bg-green-500/15 text-green-400' :
                result.credibility_assessment === 'moderate' ? 'bg-amber-500/15 text-amber-400' :
                'bg-red-500/15 text-red-400'
              }`}>
                {result.credibility_assessment.toUpperCase()} CREDIBILITY
              </span>

              {/* Quick stats */}
              <div className="flex items-center justify-center gap-6 mt-5">
                <span className="text-red-400 text-xs font-semibold">{criticalCount} Critical Issues</span>
                <span className="text-amber-400 text-xs font-semibold">{majorCount} Major Issues</span>
                <span className="text-muted text-xs">{result.cross_examination_questions?.length || 0} Questions Generated</span>
              </div>
            </div>

            {/* Overall Assessment */}
            <div className="bg-[#111111] border border-[#1a1a1a] rounded-xl p-5 mb-6">
              <div className="flex items-center gap-2 mb-3">
                <Eye className="w-4 h-4 text-primary" />
                <p className="text-sm font-bold text-white">Overall Assessment</p>
              </div>
              <p className="text-sm text-muted leading-relaxed">{result.overall_assessment}</p>
            </div>

            {/* Contradictions */}
            {result.contradictions && result.contradictions.length > 0 && (
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-4">
                  <XCircle className="w-5 h-5 text-red-400" />
                  <h3 className="text-base font-bold text-white">Contradictions Found ({result.contradictions.length})</h3>
                </div>
                <div className="space-y-3">
                  {result.contradictions.map((c, i) => (
                    <motion.div key={i}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.1 * i }}
                      className={`border rounded-xl p-4 ${sevColor(c.severity)}`}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${sevBadge(c.severity)}`}>
                          {c.severity}
                        </span>
                        <span className="text-[10px] text-muted uppercase bg-white/5 px-2 py-0.5 rounded-full">{c.type}</span>
                      </div>
                      <p className="text-sm text-white mb-2">{c.description}</p>
                      {c.quote && (
                        <p className="text-xs text-muted italic border-l-2 border-red-500/30 pl-3">"{c.quote}"</p>
                      )}
                    </motion.div>
                  ))}
                </div>
              </div>
            )}

            {/* Weak Points */}
            {result.weak_points && result.weak_points.length > 0 && (
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-4">
                  <Target className="w-5 h-5 text-amber-400" />
                  <h3 className="text-base font-bold text-white">Exploitable Weak Points ({result.weak_points.length})</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {result.weak_points.map((w, i) => (
                    <motion.div key={i}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.1 * i }}
                      className="bg-[#111111] border border-amber-500/20 rounded-xl p-4"
                    >
                      <p className="text-xs text-amber-400 font-semibold uppercase mb-1">{w.area}</p>
                      <p className="text-sm text-white mb-2">{w.description}</p>
                      <div className="flex items-start gap-1.5 text-xs text-muted">
                        <Zap className="w-3 h-3 text-primary mt-0.5 shrink-0" />
                        <span><span className="text-primary font-semibold">Strategy:</span> {w.exploitation_strategy}</span>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}

            {/* Cross-Examination Questions */}
            {result.cross_examination_questions && result.cross_examination_questions.length > 0 && (
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-4">
                  <MessageCircle className="w-5 h-5 text-primary" />
                  <h3 className="text-base font-bold text-white">Generated Cross-Examination Questions ({result.cross_examination_questions.length})</h3>
                </div>
                <div className="space-y-2">
                  {result.cross_examination_questions.map((q, i) => (
                    <motion.div key={i}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.05 * i }}
                      className="bg-[#111111] border border-[#1a1a1a] rounded-xl p-4 flex items-start gap-3"
                    >
                      <span className="text-primary font-bold text-sm mt-0.5">Q{i + 1}.</span>
                      <div className="flex-1">
                        <p className="text-sm text-white font-medium mb-1">{q.question}</p>
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-muted"><span className="text-primary">Purpose:</span> {q.purpose}</span>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${impactBadge(q.expected_impact)}`}>
                            {q.expected_impact} impact
                          </span>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}

            {/* Missing Elements + Admissibility */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {result.missing_elements && result.missing_elements.length > 0 && (
                <div className="bg-[#111111] border border-[#1a1a1a] rounded-xl p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <HelpCircle className="w-4 h-4 text-amber-400" />
                    <p className="text-sm font-bold text-white">Missing Elements</p>
                  </div>
                  <ul className="space-y-1.5">
                    {result.missing_elements.map((m, i) => (
                      <li key={i} className="text-xs text-muted flex items-start gap-2">
                        <ChevronRight className="w-3 h-3 text-amber-400 mt-0.5 shrink-0" />{m}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {result.admissibility_issues && result.admissibility_issues.length > 0 && (
                <div className="bg-[#111111] border border-[#1a1a1a] rounded-xl p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <AlertTriangle className="w-4 h-4 text-red-400" />
                    <p className="text-sm font-bold text-white">Admissibility Issues (BSA 2023)</p>
                  </div>
                  <ul className="space-y-1.5">
                    {result.admissibility_issues.map((a, i) => (
                      <li key={i} className="text-xs text-muted flex items-start gap-2">
                        <ChevronRight className="w-3 h-3 text-red-400 mt-0.5 shrink-0" />{a}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </main>
    </div>
  )
}
