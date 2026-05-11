import { Routes, Route } from 'react-router-dom'
import { ProtectedRoute } from '@/components/ProtectedRoute'

import LandingPage from '@/pages/LandingPage'
import ClientDashboard from '@/pages/ClientDashboard'
import LawyerDashboard from '@/pages/LawyerDashboard'
import LawyerDirectory from '@/pages/LawyerDirectory'
import CourtArbitrage from '@/pages/CourtArbitrage'
import JudicialIntelligence from '@/pages/JudicialIntelligence'
import LitigationEngine from '@/pages/LitigationEngine'
import CrossExamSimulator from '@/pages/CrossExamSimulator'
import Chat from '@/pages/Chat'
import AuthCallback from '@/pages/AuthCallback'

function App() {
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/" element={<LandingPage />} />
      <Route path="/auth-callback" element={<AuthCallback />} />

      {/* Protected routes */}
      <Route
        path="/client"
        element={
          <ProtectedRoute>
            <ClientDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/lawyer"
        element={
          <ProtectedRoute>
            <LawyerDashboard />
          </ProtectedRoute>
        }
      />
      <Route path="/lawyers" element={<LawyerDirectory />} />
      <Route
        path="/courts"
        element={
          <ProtectedRoute>
            <CourtArbitrage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/judicial-intelligence"
        element={
          <ProtectedRoute>
            <JudicialIntelligence />
          </ProtectedRoute>
        }
      />
      <Route
        path="/litigation-engine"
        element={
          <ProtectedRoute>
            <LitigationEngine />
          </ProtectedRoute>
        }
      />
      <Route
        path="/cross-examine"
        element={
          <ProtectedRoute>
            <CrossExamSimulator />
          </ProtectedRoute>
        }
      />
      <Route
        path="/chat/:requestId"
        element={
          <ProtectedRoute>
            <Chat />
          </ProtectedRoute>
        }
      />
    </Routes>
  )
}

export default App
