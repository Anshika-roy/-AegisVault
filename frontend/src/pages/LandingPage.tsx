import { useState, useEffect, useMemo, useRef } from 'react'
import { motion, AnimatePresence, useInView, type Variants } from 'framer-motion'
import { Shield, Menu, X, BrainCircuit, Scale, MapPin } from 'lucide-react'
import { LoginModal, RegisterModal } from '@/components/AuthModals'

/* ═══════════════════════════════════════════════════════
   FLOATING PARTICLE
   ═══════════════════════════════════════════════════════ */
function Particle({ index }: { index: number }) {
  const config = useMemo(() => {
    const pseudoRandom = (seed: number) => {
      const x = Math.sin(seed * 999) * 10000;
      return x - Math.floor(x);
    }
    const isPurple = index % 3 !== 0
    return {
      left: `${pseudoRandom(index) * 100}%`,
      size: pseudoRandom(index + 1) * 3 + 1.5,
      duration: pseudoRandom(index + 2) * 12 + 14,
      delay: pseudoRandom(index + 3) * 8,
      color: isPurple ? 'bg-primary' : 'bg-accent',
      opacity: pseudoRandom(index + 4) * 0.3 + 0.08,
    }
  }, [index])

  return (
    <motion.div
      className={`absolute rounded-full ${config.color}`}
      style={{
        left: config.left,
        width: config.size,
        height: config.size,
        opacity: config.opacity,
        bottom: -20,
      }}
      animate={{ y: [0, -1200], opacity: [config.opacity, 0] }}
      transition={{
        duration: config.duration,
        delay: config.delay,
        repeat: Infinity,
        ease: 'linear',
      }}
    />
  )
}

/* ═══════════════════════════════════════════════════════
   NAVBAR
   ═══════════════════════════════════════════════════════ */
function Navbar({ onLogin, onRegister }: { onLogin: () => void; onRegister: () => void }) {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <motion.nav
      initial={{ y: -80, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
      className="fixed top-0 left-0 right-0 z-50 border-b border-[#1a1a1a]"
      style={{
        background: 'rgba(0, 0, 0, 0.6)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
      }}
    >
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <a href="/" className="flex items-center gap-2.5 no-underline">
          <Shield className="w-7 h-7 text-primary" strokeWidth={2.2} />
          <span className="text-white font-bold text-lg tracking-tight">AegisVault</span>
        </a>

        <div className="hidden md:flex items-center gap-3">
          <a href="/lawyers" className="px-4 py-2 text-sm font-medium text-muted hover:text-white transition-colors duration-200">
            Find Lawyers
          </a>
          <button onClick={onLogin} className="px-5 py-2 text-sm font-semibold text-primary border border-primary/60 rounded-lg hover:border-primary hover:shadow-[0_0_20px_rgba(124,58,237,0.3)] transition-all duration-300 bg-transparent cursor-pointer">
            Login
          </button>
          <button onClick={onRegister} className="px-5 py-2 text-sm font-semibold text-black bg-white rounded-lg hover:bg-neutral-200 transition-all duration-300 border-none cursor-pointer">
            Register
          </button>
        </div>

        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="md:hidden text-white p-2 bg-transparent border-none cursor-pointer"
          aria-label="Toggle menu"
        >
          {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            className="md:hidden overflow-hidden border-t border-[#1a1a1a]"
            style={{ background: 'rgba(0, 0, 0, 0.9)' }}
          >
            <div className="px-6 py-5 flex flex-col gap-3">
              <a href="/lawyers" className="text-muted hover:text-white text-sm font-medium py-2 transition-colors">Find Lawyers</a>
              <button onClick={() => { setMobileOpen(false); onLogin() }} className="text-center px-5 py-2.5 text-sm font-semibold text-primary border border-primary/60 rounded-lg hover:border-primary transition-all bg-transparent cursor-pointer">Login</button>
              <button onClick={() => { setMobileOpen(false); onRegister() }} className="text-center px-5 py-2.5 text-sm font-semibold text-black bg-white rounded-lg hover:bg-neutral-200 transition-all border-none cursor-pointer">Register</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.nav>
  )
}

/* ═══════════════════════════════════════════════════════
   HERO SECTION
   ═══════════════════════════════════════════════════════ */
function Hero() {
  const stagger = {
    hidden: {},
    visible: { transition: { staggerChildren: 0.15, delayChildren: 0.4 } },
  }
  const fadeUp = {
    hidden: { opacity: 0, y: 30 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.7, ease: 'easeOut' as const } },
  } satisfies Variants

  return (
    <section className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden px-6 pt-20">
      {/* Ambient glows */}
      <div className="absolute pointer-events-none" style={{ width: 900, height: 900, left: '10%', top: '5%', borderRadius: '50%', background: 'radial-gradient(circle, rgba(124,58,237,0.12) 0%, transparent 70%)' }} />
      <div className="absolute pointer-events-none" style={{ width: 600, height: 600, right: '5%', top: '30%', borderRadius: '50%', background: 'radial-gradient(circle, rgba(16,185,129,0.08) 0%, transparent 70%)' }} />

      {/* Floating particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {Array.from({ length: 20 }).map((_, i) => (
          <Particle key={i} index={i} />
        ))}
      </div>

      {/* Hero content */}
      <motion.div variants={stagger} initial="hidden" animate="visible" className="relative z-10 flex flex-col items-center text-center max-w-4xl">
        {/* Badge */}
        <motion.div variants={fadeUp}>
          <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold text-primary border border-primary/40 mb-8" style={{ boxShadow: '0 0 30px rgba(124,58,237,0.15)' }}>
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
            Now with AI Legal Intelligence
          </span>
        </motion.div>

        {/* Headline */}
        <motion.h1 variants={fadeUp} className="mb-6">
          <span className="block font-light text-white" style={{ fontSize: 'clamp(48px, 8vw, 80px)', lineHeight: 1.05 }}>Justice,</span>
          <span className="block font-extrabold" style={{ fontSize: 'clamp(48px, 8vw, 80px)', lineHeight: 1.05, background: 'linear-gradient(135deg, #FFFFFF 30%, #7C3AED 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>Engineered.</span>
        </motion.h1>

        {/* Subheadline */}
        <motion.p variants={fadeUp} className="text-muted text-base md:text-lg max-w-[600px] mb-10 leading-relaxed">
          The first legal platform that tells you if your case will win, under which law, and in which court.
        </motion.p>

        {/* CTA Buttons */}
        <motion.div variants={fadeUp} className="flex flex-col sm:flex-row items-center gap-4 mb-8">
          <motion.a href="/" whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }} className="px-8 py-3.5 rounded-lg text-sm font-semibold text-black bg-white shadow-[0_0_30px_rgba(255,255,255,0.15)] hover:bg-neutral-200 transition-all duration-300 no-underline">
            Get Started Free
          </motion.a>
          <motion.a href="/" whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }} className="px-8 py-3.5 rounded-lg text-sm font-semibold text-white border border-white/20 hover:border-white/50 hover:bg-white/5 transition-all duration-300 no-underline">
            See How It Works
          </motion.a>
        </motion.div>

        {/* Trust line */}
        <motion.p variants={fadeUp} className="text-xs text-muted/60 flex items-center gap-2">
          <span className="w-1 h-1 rounded-full bg-muted/40" />
          Trusted by 500+ legal professionals across India
          <span className="w-1 h-1 rounded-full bg-muted/40" />
        </motion.p>

        {/* Mockup card */}
        <motion.div variants={fadeUp} className="mt-16 w-full max-w-3xl">
          <motion.div
            animate={{ y: [0, -10, 0] }}
            transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
            className="relative rounded-2xl border border-primary/30 overflow-hidden"
            style={{ background: 'linear-gradient(180deg, rgba(124,58,237,0.06) 0%, rgba(0,0,0,0.8) 100%)', boxShadow: '0 0 60px rgba(124,58,237,0.15), inset 0 1px 0 rgba(124,58,237,0.15)' }}
          >
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-px" style={{ background: 'linear-gradient(90deg, transparent, rgba(124,58,237,0.6), transparent)' }} />
            <div className="relative aspect-[16/10] w-full overflow-hidden">
              <img
                src="/dashboard-preview.png"
                alt="AegisVault Dashboard Mockup"
                className="w-full h-full object-cover opacity-90"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-60" />
            </div>
          </motion.div>
        </motion.div>
      </motion.div>
    </section>
  )
}

/* ═══════════════════════════════════════════════════════
   FEATURE CARD
   ═══════════════════════════════════════════════════════ */
const featureCards = [
  {
    icon: BrainCircuit,
    title: 'Causal Integrity Engine',
    description: 'AI verifies if your case has all the logical pieces to win. Detects missing evidence before you file — not after.',
    tag: 'Unique to AegisVault',
    color: '#7C3AED',
    glowClass: 'hover:border-[#7C3AED]/60 hover:shadow-[0_0_30px_rgba(124,58,237,0.2)]',
    tagColor: 'text-primary',
    iconBg: 'rgba(124,58,237,0.12)',
  },
  {
    icon: Scale,
    title: 'BNS Strategic Transposer',
    description: "India's laws changed. Your strategy shouldn't suffer. AI maps your IPC expertise to the new BNS in seconds.",
    tag: 'India Exclusive',
    color: '#10B981',
    glowClass: 'hover:border-[#10B981]/60 hover:shadow-[0_0_30px_rgba(16,185,129,0.2)]',
    tagColor: 'text-accent',
    iconBg: 'rgba(16,185,129,0.12)',
  },
  {
    icon: MapPin,
    title: 'Jurisdiction Analytics Dashboard',
    description: 'AI tells you which High Court to file in based on speed, judge behavior, and your case type. Justice, strategically delivered.',
    tag: 'Data Driven',
    color: '#3B82F6',
    glowClass: 'hover:border-[#3B82F6]/60 hover:shadow-[0_0_30px_rgba(59,130,246,0.2)]',
    tagColor: 'text-[#3B82F6]',
    iconBg: 'rgba(59,130,246,0.12)',
  },
]

function FeatureCards() {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: '-80px' })

  const containerVariants = {
    hidden: {},
    visible: { transition: { staggerChildren: 0.18 } },
  } satisfies Variants
  const cardVariants = {
    hidden: { opacity: 0, y: 40 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.7, ease: 'easeOut' as const } },
  } satisfies Variants

  return (
    <section className="relative py-28 px-6" ref={ref}>
      {/* Section header */}
      <div className="text-center mb-16">
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5 }}
          className="text-accent text-xs font-semibold uppercase tracking-[0.2em] mb-3"
        >
          Our AI Engines
        </motion.p>
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="text-3xl md:text-4xl font-bold text-white"
        >
          Three Features Nobody Else Has.
        </motion.h2>
      </div>

      {/* Cards grid */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate={isInView ? 'visible' : 'hidden'}
        className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6"
      >
        {featureCards.map((card) => (
          <motion.div
            key={card.title}
            variants={cardVariants}
            whileHover={{ y: -8 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            className={`group rounded-2xl border border-[#1a1a1a] bg-[#111111] p-8 flex flex-col gap-5
                        transition-all duration-400 cursor-default ${card.glowClass}`}
          >
            {/* Icon */}
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center"
              style={{ backgroundColor: card.iconBg, boxShadow: `0 0 24px ${card.color}22` }}
            >
              <card.icon className="w-6 h-6" style={{ color: card.color }} strokeWidth={1.8} />
            </div>

            {/* Title */}
            <h3 className="text-lg font-bold text-white">{card.title}</h3>

            {/* Description */}
            <p className="text-muted text-sm leading-relaxed flex-1">{card.description}</p>

            {/* Tag */}
            <p className={`text-xs font-semibold ${card.tagColor} mt-1`}>
              {card.tag}
            </p>
          </motion.div>
        ))}
      </motion.div>
    </section>
  )
}

/* ═══════════════════════════════════════════════════════
   ANIMATED COUNTER
   ═══════════════════════════════════════════════════════ */
function AnimatedCounter({
  target,
  suffix = '',
  prefix = '',
  duration = 2000,
}: {
  target: number
  suffix?: string
  prefix?: string
  duration?: number
}) {
  const [count, setCount] = useState(0)
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: '-50px' })

  useEffect(() => {
    if (!isInView) return

    let startTime: number | null = null
    let animationFrame: number

    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp
      const progress = Math.min((timestamp - startTime) / duration, 1)
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3)
      setCount(Math.floor(eased * target))

      if (progress < 1) {
        animationFrame = requestAnimationFrame(animate)
      } else {
        setCount(target)
      }
    }

    animationFrame = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(animationFrame)
  }, [isInView, target, duration])

  return (
    <span ref={ref}>
      {prefix}{count}{suffix}
    </span>
  )
}

/* ═══════════════════════════════════════════════════════
   STATS BAR
   ═══════════════════════════════════════════════════════ */
function StatsBar() {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: '-50px' })

  const stats = [
    { value: 50, suffix: 'M+', prefix: '', label: 'Pending cases in India we help navigate', color: 'text-primary' },
    { value: 3, suffix: '', prefix: '', label: 'AI engines running simultaneously', color: 'text-accent' },
    { value: 0, suffix: '₹', prefix: '', label: 'Cost to get started today', color: 'text-white', isZero: true },
  ]

  return (
    <section
      ref={ref}
      className="border-t border-b border-[#1a1a1a] py-20 px-6"
    >
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={isInView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-12 md:gap-0"
      >
        {stats.map((stat, i) => (
          <div
            key={stat.label}
            className={`flex flex-col items-center text-center ${
              i < stats.length - 1 ? 'md:border-r md:border-[#1a1a1a]' : ''
            }`}
          >
            <p className={`text-5xl md:text-6xl font-extrabold mb-3 ${stat.color}`}>
              {stat.isZero ? (
                <span>0₹</span>
              ) : (
                <AnimatedCounter target={stat.value} suffix={stat.suffix} prefix={stat.prefix} />
              )}
            </p>
            <p className="text-muted text-sm max-w-[220px] leading-relaxed">
              {stat.label}
            </p>
          </div>
        ))}
      </motion.div>
    </section>
  )
}

/* ═══════════════════════════════════════════════════════
   FOOTER
   ═══════════════════════════════════════════════════════ */
function Footer() {
  return (
    <footer className="border-t border-[#1a1a1a] py-12 px-6">
      <div className="max-w-6xl mx-auto">
        {/* Row 1 */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-6 mb-8">
          {/* Brand */}
          <a href="/" className="flex items-center gap-2.5 no-underline">
            <Shield className="w-6 h-6 text-primary" strokeWidth={2.2} />
            <span className="text-white font-bold text-base tracking-tight">AegisVault</span>
          </a>

          {/* Links */}
          <div className="flex items-center gap-8">
            <a href="#" className="text-muted text-sm hover:text-white transition-colors duration-200">About</a>
            <a href="#" className="text-muted text-sm hover:text-white transition-colors duration-200">Privacy</a>
            <a href="#" className="text-muted text-sm hover:text-white transition-colors duration-200">Contact</a>
          </div>
        </div>

        {/* Row 2 */}
        <div className="text-center">
          <p className="text-muted/40 text-xs">
            © 2026 AegisVault. Built for Kleos 4.0 — RAIT ACM.
          </p>
        </div>
      </div>
    </footer>
  )
}

/* ═══════════════════════════════════════════════════════
   LANDING PAGE (ASSEMBLED)
   ═══════════════════════════════════════════════════════ */
export default function LandingPage() {
  const [authModal, setAuthModal] = useState<'login' | 'register' | null>(null)

  return (
    <div className="min-h-screen bg-background text-white overflow-x-hidden">
      <Navbar onLogin={() => setAuthModal('login')} onRegister={() => setAuthModal('register')} />
      <Hero />
      <FeatureCards />
      <StatsBar />
      <Footer />

      <LoginModal
        isOpen={authModal === 'login'}
        onClose={() => setAuthModal(null)}
        onSwitchToRegister={() => setAuthModal('register')}
      />
      <RegisterModal
        isOpen={authModal === 'register'}
        onClose={() => setAuthModal(null)}
        onSwitchToLogin={() => setAuthModal('login')}
      />
    </div>
  )
}
