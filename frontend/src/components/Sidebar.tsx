import { useNavigate, useLocation } from 'react-router-dom'
import { Shield, LayoutDashboard, Briefcase, Search, Map, Settings, LogOut, Inbox, Scale, BrainCircuit, Target, Crosshair } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'

const clientNav = [
  { label: 'Dashboard', icon: LayoutDashboard, path: '/client' },
  { label: 'My Cases', icon: Briefcase, path: '/client', hash: '#cases' },
  { label: 'Find Lawyers', icon: Search, path: '/lawyers' },
  { label: 'Jurisdiction Intel', icon: Map, path: '/courts' },
  { label: 'Settings', icon: Settings, path: '/client', hash: '#settings' },
]

const lawyerNav = [
  { label: 'Dashboard', icon: LayoutDashboard, path: '/lawyer' },
  { label: 'Incoming Requests', icon: Inbox, path: '/lawyer', hash: '#requests' },
  { label: 'Active Cases', icon: Briefcase, path: '/lawyer', hash: '#active' },
  { label: 'BNS Transposer', icon: Scale, path: '/lawyer', hash: '#bns' },
  { label: 'Jurisdiction Intel', icon: Map, path: '/courts' },
  { label: 'Judicial Intel', icon: BrainCircuit, path: '/judicial-intelligence' },
  { label: 'Risk Assessment', icon: Target, path: '/litigation-engine' },
  { label: 'Cross-Exam AI', icon: Crosshair, path: '/cross-examine' },
  { label: 'Settings', icon: Settings, path: '/lawyer', hash: '#settings' },
]

export function Sidebar({ role = 'client' }: { role?: 'client' | 'lawyer' }) {
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useAuth()

  const navItems = role === 'lawyer' ? lawyerNav : clientNav
  const fullName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User'
  const initial = fullName.charAt(0).toUpperCase()
  const email = user?.email || ''

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    navigate('/')
  }

  return (
    <aside className="fixed left-0 top-0 bottom-0 w-60 bg-[#000000] border-r border-white/5 flex flex-col z-40 selection:bg-white/20">
      {/* Brand */}
      <div className="px-5 h-16 flex items-center gap-2.5 border-b border-white/5 shrink-0">
        <Shield className="w-5 h-5 text-white" strokeWidth={2} />
        <span className="text-white font-semibold text-sm tracking-tight">AegisVault</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-6 flex flex-col gap-1 overflow-y-auto">
        <div className="mb-2 px-2">
          <p className="text-[10px] font-semibold text-muted uppercase tracking-wider">Menu</p>
        </div>
        {navItems.map((item) => {
          const isActive = location.pathname === item.path && !item.hash
          return (
            <button
              key={item.label}
              onClick={() => navigate(item.path)}
              className={`flex items-center gap-3 px-3 py-2 rounded-md text-xs font-medium transition-colors w-full text-left border-none cursor-pointer
                ${isActive
                  ? 'bg-white/10 text-white'
                  : 'bg-transparent text-muted hover:text-white hover:bg-white/5'
                }`}
            >
              <item.icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-muted'}`} strokeWidth={isActive ? 2 : 1.5} />
              {item.label}
            </button>
          )
        })}
      </nav>

      {/* User */}
      <div className="px-5 py-4 border-t border-white/5 bg-[#0a0a0a] shrink-0">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 rounded bg-white/10 flex items-center justify-center text-white font-semibold text-xs">
            {initial}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-white text-xs font-medium truncate leading-tight">{fullName}</p>
            <p className="text-muted text-[10px] truncate">{email}</p>
          </div>
        </div>
        <button
          onClick={handleSignOut}
          className="flex items-center justify-between w-full text-muted hover:text-white text-xs font-medium transition-colors bg-transparent border-none cursor-pointer group"
        >
          <span className="flex items-center gap-2">
            <LogOut className="w-3.5 h-3.5 group-hover:text-red-400 transition-colors" /> Sign Out
          </span>
        </button>
      </div>
    </aside>
  )
}
