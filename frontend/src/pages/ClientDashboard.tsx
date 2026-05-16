import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Briefcase, Clock, BrainCircuit, Users, Sparkles, Loader2,
  CheckCircle, XCircle, Lightbulb, MessageSquare, ChevronDown, ChevronUp, FileText, Activity
} from 'lucide-react'
import { Sidebar } from '@/components/Sidebar'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { useDashboardData } from '@/hooks/useDashboardData'
import type { CaseAnalysis } from '@/lib/types'

/* ─── Skeleton Loader ─── */
function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`bg-[#1a1a1a] animate-pulse rounded-md ${className}`} />
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

/* ─── Case Type Config ─── */
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
const statusColors: Record<string, string> = {
  pending: 'text-amber-400 bg-amber-400/10 border-amber-400/20',
  accepted: 'text-green-400 bg-green-400/10 border-green-400/20',
  rejected: 'text-red-400 bg-red-400/10 border-red-400/20',
  completed: 'text-blue-400 bg-blue-400/10 border-blue-400/20',
}

const caseTypes = ['Criminal', 'Civil', 'Corporate', 'Family', 'Property', 'Intellectual Property', 'Labour', 'Constitutional']

const inputClass = `w-full px-4 py-3 rounded-md text-sm text-white placeholder-muted/40
  bg-[#111111] border border-white/10 outline-none
  focus:border-white/30 transition-all duration-200`

/* ─── Procedural Timeline ─── */
function ProceduralTimeline({ status }: { status: string }) {
  const steps = ['Drafting', 'Filed', 'Hearing', 'Judgment']
  const currentIdx = status === 'pending' ? 0 : status === 'accepted' ? 1 : status === 'completed' ? 3 : 0

  return (
    <div className="w-full mt-4 pt-4 border-t border-white/5">
      <div className="flex justify-between relative">
        <div className="absolute top-[9px] left-[10%] right-[10%] h-0.5 bg-white/5 z-0" />
        <div className="absolute top-[9px] left-[10%] h-0.5 bg-white z-0 transition-all duration-500" style={{ width: `${(currentIdx / 3) * 80}%` }} />
        {steps.map((step, i) => {
          const isPast = i <= currentIdx
          return (
            <div key={step} className="flex flex-col items-center z-10 w-1/4">
              <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold border-2 transition-colors duration-500
                ${isPast ? 'bg-white border-white text-black' : 'bg-[#111] border-white/20 text-muted'}`}>
                {isPast ? <CheckCircle className="w-3 h-3" /> : i + 1}
              </div>
              <span className={`text-[10px] mt-1.5 font-medium ${isPast ? 'text-white' : 'text-muted'}`}>{step}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ─── Helpers ─── */
const normalizeScore = (val: number) => (val <= 1 ? Math.round(val * 100) : Math.round(val))

function ConfidenceBar({ score }: { score: number }) {
  const normalized = normalizeScore(score)
  const color = normalized >= 70 ? 'bg-green-500' : normalized >= 40 ? 'bg-amber-500' : 'bg-red-500'
  return (
    <div className="w-full">
      <div className="flex justify-between items-end mb-1">
        <span className="text-xs font-semibold text-white">AI Confidence</span>
        <span className="text-[10px] text-muted">{normalized}%</span>
      </div>
      <div className="w-full h-1.5 bg-[#1a1a1a] rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all duration-1000`} style={{ width: `${normalized}%` }} />
      </div>
    </div>
  )
}

/* ─── Analysis Panel ─── */
function AnalysisPanel({ analysis }: { analysis: CaseAnalysis }) {
  const missing = Array.isArray(analysis.missing_elements)
    ? analysis.missing_elements as Array<{ name?: string; description?: string }>
    : Object.entries(analysis.missing_elements || {}).map(([k, v]) => ({ name: k, description: String(v) }))

  return (
    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="mt-4 pt-4 border-t border-white/5 overflow-hidden">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div>
          <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">Assessment</p>
          <ConfidenceBar score={analysis.confidence_score} />
          <p className="text-xs text-white/70 mt-3 leading-relaxed">
            Based on our initial analysis, your case details have been structured for attorney review.
          </p>
        </div>

        <div>
          <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <XCircle className="w-3.5 h-3.5 text-red-400" /> Missing Evidence
          </p>
          {missing.length > 0 ? (
            <ul className="space-y-2">
              {missing.map((item, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-400 mt-1.5 shrink-0" />
                  <div>
                    <p className="text-white text-xs font-medium">{item.name || `Missing Element ${i + 1}`}</p>
                    {item.description && <p className="text-muted text-[10px] leading-tight mt-0.5">{item.description}</p>}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted text-xs">No critical gaps identified.</p>
          )}
        </div>

        <div>
          <p className="text-[10px] font-bold text-muted uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <Lightbulb className="w-3.5 h-3.5 text-amber-500" /> Strategic Next Steps
          </p>
          <p className="text-white text-xs leading-relaxed whitespace-pre-line bg-[#151515] p-3 rounded border border-white/5">
            {analysis.recommendations || 'Await lawyer consultation.'}
          </p>
        </div>
      </div>
    </motion.div>
  )
}

/* ═══════════════════════════════════════════════════════
   CLIENT DASHBOARD
   ═══════════════════════════════════════════════════════ */
export default function ClientDashboard() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { cases, stats, loading, error, refetch } = useDashboardData()

  const [desc, setDesc] = useState('')
  const [caseType, setCaseType] = useState(caseTypes[0])
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [latestAnalysis, setLatestAnalysis] = useState<CaseAnalysis | null>(null)
  const [expandedCase, setExpandedCase] = useState<string | null>(null)

  const handleSubmit = async () => {
    if (!desc.trim() || !user) return
    setSubmitting(true)
    setSubmitError('')
    setLatestAnalysis(null)

    try {
      const { data: newReq, error: insertErr } = await supabase
        .from('requests')
        .insert({
          client_id: user.id,
          lawyer_id: null,
          case_description: desc.trim(),
          case_type: caseType,
          status: 'pending',
        })
        .select()
        .single()
      if (insertErr) throw insertErr

      const { data: analysisData, error: fnErr } = await supabase.functions.invoke('analyze-case', {
        body: { case_description: desc.trim(), request_id: newReq.id },
      })
      if (fnErr) throw fnErr

      if (analysisData) setLatestAnalysis(analysisData as CaseAnalysis)
      setDesc('')
      refetch()
    } catch (err: unknown) {
      setSubmitError(err instanceof Error ? err.message : 'Submission failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-background text-white flex">
      <Sidebar />

      <main className="ml-60 flex-1 p-8 max-w-[1400px]">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-semibold tracking-tight text-white">Client Portal</h1>
        </div>

        {error && (
          <div className="mb-6 p-3 rounded-md border border-red-500/20 bg-red-500/10 text-red-400 text-sm">{error}</div>
        )}

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard icon={Briefcase} label="Active Cases" value={stats.activeCases} loading={loading} />
          <StatCard icon={Clock} label="Pending Requests" value={stats.pendingRequests} loading={loading} />
          <StatCard icon={BrainCircuit} label="AI Analyses" value={stats.aiAnalyses} loading={loading} />
          <StatCard icon={Users} label="Lawyers Connected" value={stats.lawyersConnected} loading={loading} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            
            {/* Submit Case */}
            <div className="bg-[#0f0f0f] border border-white/5 rounded-lg p-6">
              <div className="flex items-center gap-2 mb-4 border-b border-white/5 pb-3">
                <FileText className="w-4 h-4 text-muted" />
                <h2 className="text-sm font-semibold text-white">Submit New Case</h2>
              </div>

              <textarea rows={4} placeholder="Describe your legal situation. Specific dates and events help the AI process your case accurately..."
                value={desc} onChange={e => setDesc(e.target.value)}
                className={`${inputClass} resize-none mb-4`} />

              <div className="flex flex-col sm:flex-row gap-4">
                <select value={caseType} onChange={e => setCaseType(e.target.value)}
                  className={`${inputClass} sm:w-48 cursor-pointer`}>
                  {caseTypes.map(t => <option key={t} value={t}>{t}</option>)}
                </select>

                <button onClick={handleSubmit} disabled={submitting || !desc.trim()}
                  className="flex-1 sm:flex-none px-4 py-2 rounded-md text-xs font-medium text-black bg-white hover:bg-neutral-200 disabled:opacity-50 transition-colors flex items-center justify-center gap-2 border-none cursor-pointer">
                  {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                  {submitting ? 'Analyzing & Routing...' : 'Submit to Lawyers'}
                </button>
              </div>

              {submitError && <div className="mt-4 p-3 rounded-md border border-red-500/20 bg-red-500/10 text-red-400 text-xs">{submitError}</div>}
              {latestAnalysis && <AnalysisPanel analysis={latestAnalysis} />}
            </div>

            {/* Cases List */}
            <div>
              <div className="flex items-center justify-between mb-4 border-b border-white/5 pb-2">
                <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                  <Briefcase className="w-4 h-4 text-muted" /> My Cases
                </h2>
              </div>

              {loading ? (
                <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-20 w-full" />)}</div>
              ) : cases.length === 0 ? (
                <div className="py-8 text-center bg-[#0a0a0a] border border-white/5 rounded-lg border-dashed">
                  <p className="text-muted text-sm">No cases submitted yet.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {cases.map(c => {
                    // Document Readiness mock based on missing elements
                    let readiness = 100
                    if (c.analysis && c.analysis.missing_elements) {
                      const m = Array.isArray(c.analysis.missing_elements) ? c.analysis.missing_elements : Object.keys(c.analysis.missing_elements)
                      readiness = Math.max(10, 100 - (m.length * 20))
                    }

                    return (
                      <div key={c.id} className="bg-[#0f0f0f] border border-white/5 rounded-lg p-5 transition-all">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-2 flex-wrap">
                            {c.case_type && (
                              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-sm border ${caseTypeColors[c.case_type] || 'text-muted border-white/10'}`}>
                                {c.case_type}
                              </span>
                            )}
                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-sm border ${statusColors[c.status] || 'text-muted border-white/10'}`}>
                              {c.status.toUpperCase()}
                            </span>
                          </div>
                          <div className="text-right">
                            <span className="text-[10px] text-muted font-mono block">ID-{c.id.slice(0, 6).toUpperCase()}</span>
                            <span className="text-[10px] text-green-500 font-medium">{readiness}% Document Readiness</span>
                          </div>
                        </div>

                      <p className="text-white/80 text-xs leading-relaxed mb-3">
                        {c.case_description.length > 120 ? c.case_description.slice(0, 120) + '…' : c.case_description}
                      </p>

                      <div className="flex items-center justify-between mt-4 border-t border-white/5 pt-3">
                        <span className="text-[10px] text-muted font-mono">{new Date(c.created_at).toLocaleDateString()}</span>
                        <div className="flex items-center gap-3">
                          {c.analysis && (
                            <button onClick={() => setExpandedCase(expandedCase === c.id ? null : c.id)}
                              className="text-[10px] font-medium text-white hover:text-neutral-300 flex items-center gap-1 bg-white/10 px-2 py-1 rounded transition-colors border-none cursor-pointer">
                              {expandedCase === c.id ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                              {expandedCase === c.id ? 'Hide Assessment' : 'View Assessment'}
                            </button>
                          )}
                          {c.status === 'accepted' && (
                            <button onClick={() => navigate(`/chat/${c.id}`)}
                              className="px-4 py-1.5 rounded-md text-[10px] font-semibold text-black bg-white hover:bg-neutral-200 transition-colors flex items-center gap-1.5 border-none cursor-pointer">
                              <MessageSquare className="w-3 h-3" /> Secure Channel
                            </button>
                          )}
                        </div>
                      </div>

                      {expandedCase === c.id && c.analysis && <AnalysisPanel analysis={c.analysis} />}
                      
                      <ProceduralTimeline status={c.status} />
                    </div>
                  )
                })}
                </div>
              )}
            </div>
          </div>

          {/* Educational / Helper Sidebar */}
          <div>
             <div className="bg-[#0f0f0f] border border-white/5 rounded-lg p-5">
                <div className="flex items-center gap-2 mb-4 border-b border-white/5 pb-2">
                  <Activity className="w-4 h-4 text-muted" />
                  <h3 className="text-sm font-semibold text-white">How it works</h3>
                </div>
                <ul className="space-y-4">
                  <li className="flex items-start gap-3">
                    <div className="w-5 h-5 rounded-full bg-white/5 flex items-center justify-center shrink-0 mt-0.5">
                      <span className="text-[10px] font-bold text-white">1</span>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-white mb-0.5">Submit Case Facts</p>
                      <p className="text-[10px] text-muted leading-relaxed">Provide as much detail as possible. The AI engine will instantly structure the facts for attorney review.</p>
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="w-5 h-5 rounded-full bg-white/5 flex items-center justify-center shrink-0 mt-0.5">
                      <span className="text-[10px] font-bold text-white">2</span>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-white mb-0.5">Lawyer Matching</p>
                      <p className="text-[10px] text-muted leading-relaxed">Specialized attorneys in our network will review your structured case and choose to accept representation.</p>
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="w-5 h-5 rounded-full bg-white/5 flex items-center justify-center shrink-0 mt-0.5">
                      <span className="text-[10px] font-bold text-white">3</span>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-white mb-0.5">Secure Collaboration</p>
                      <p className="text-[10px] text-muted leading-relaxed">Once accepted, engage in client-side encrypted messaging with your lawyer to share documents and strategy.</p>
                    </div>
                  </li>
                </ul>
             </div>
          </div>
        </div>
      </main>
    </div>
  )
}
