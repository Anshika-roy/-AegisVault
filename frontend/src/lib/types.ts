export interface User {
  id: string
  email: string
  role: 'client' | 'lawyer'
  full_name: string
  avatar_url: string | null
  created_at: string
}

export interface Lawyer {
  id: string
  user_id: string
  specialization: string
  bio: string | null
  location: string | null
  rating: number
  verified: boolean
  created_at: string
}

export interface Request {
  id: string
  client_id: string
  lawyer_id: string
  status: 'pending' | 'accepted' | 'rejected' | 'completed'
  case_description: string
  case_type: string | null
  urgency_score: number | null
  created_at: string
}

export interface Message {
  id: string
  request_id: string
  sender_id: string
  content_encrypted: string
  iv: string
  created_at: string
}

export interface CaseAnalysis {
  id: string
  request_id: string
  causal_graph: Record<string, unknown>
  missing_elements: Record<string, unknown>
  confidence_score: number
  recommendations: string
  created_at: string
}

export interface CourtScore {
  id: string
  court_name: string
  state: string
  velocity_score: number
  injunction_rate: number
  pendency_days: number
  domain: string
  updated_at: string
}
