import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import type { CaseAnalysis } from '@/lib/types'

export interface CaseRequest {
  id: string
  client_id: string
  lawyer_id: string | null
  status: string
  case_description: string
  case_type: string | null
  urgency_score: number | null
  created_at: string
  analysis?: CaseAnalysis | null
}

export interface DashboardStats {
  activeCases: number
  pendingRequests: number
  aiAnalyses: number
  lawyersConnected: number
}

export function useDashboardData() {
  const { user } = useAuth()
  const [cases, setCases] = useState<CaseRequest[]>([])
  const [stats, setStats] = useState<DashboardStats>({ activeCases: 0, pendingRequests: 0, aiAnalyses: 0, lawyersConnected: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const fetchData = useCallback(async () => {
    if (!user) return
    setLoading(true)
    setError('')
    try {
      // Fetch requests
      const { data: requests, error: reqErr } = await supabase
        .from('requests')
        .select('*')
        .eq('client_id', user.id)
        .order('created_at', { ascending: false })
      if (reqErr) throw reqErr

      const reqs: CaseRequest[] = requests || []

      // Fetch analyses for these requests
      const reqIds = reqs.map(r => r.id)
      let analyses: CaseAnalysis[] = []
      if (reqIds.length > 0) {
        const { data: anData } = await supabase
          .from('case_analysis')
          .select('*')
          .in('request_id', reqIds)
        analyses = anData || []
      }

      // Merge analyses into requests
      const merged = reqs.map(r => ({
        ...r,
        analysis: analyses.find(a => a.request_id === r.id) || null,
      }))
      setCases(merged)

      // Compute stats
      const active = reqs.filter(r => r.status === 'accepted').length
      const pending = reqs.filter(r => r.status === 'pending').length
      const uniqueLawyers = new Set(reqs.filter(r => r.lawyer_id).map(r => r.lawyer_id)).size
      setStats({ activeCases: active, pendingRequests: pending, aiAnalyses: analyses.length, lawyersConnected: uniqueLawyers })
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load data')
    } finally {
      setLoading(false)
    }
  }, [user])

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { fetchData() }, [fetchData])

  return { cases, stats, loading, error, refetch: fetchData }
}
