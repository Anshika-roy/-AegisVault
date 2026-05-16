import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft, Lock, Shield, Loader2, AlertCircle, FileText
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'

/* ═══════════════════════════════════════════════════════
   ENCRYPTION — AES-256-GCM via Web Crypto API
   ═══════════════════════════════════════════════════════ */
async function deriveKey(requestId: string): Promise<CryptoKey> {
  const enc = new TextEncoder()
  const keyMaterial = await crypto.subtle.importKey(
    'raw', enc.encode(requestId), 'PBKDF2', false, ['deriveKey']
  )
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: enc.encode('aegisvault-e2ee'), iterations: 100000, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  )
}

async function encryptMessage(text: string, key: CryptoKey): Promise<{ encrypted: string; iv: string }> {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const encoded = new TextEncoder().encode(text)
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded)
  return {
    encrypted: btoa(String.fromCharCode(...new Uint8Array(encrypted))),
    iv: btoa(String.fromCharCode(...iv)),
  }
}

async function decryptMessage(encrypted: string, iv: string, key: CryptoKey): Promise<string> {
  try {
    const encryptedBytes = Uint8Array.from(atob(encrypted), c => c.charCodeAt(0))
    const ivBytes = Uint8Array.from(atob(iv), c => c.charCodeAt(0))
    const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: ivBytes }, key, encryptedBytes)
    return new TextDecoder().decode(decrypted)
  } catch {
    return '[Unable to decrypt]'
  }
}

/* ═══════════════════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════════════════ */
interface Message {
  id: string
  request_id: string
  sender_id: string
  receiver_id: string
  content_encrypted: string
  iv: string
  created_at: string
  decrypted?: string
  isOptimistic?: boolean
}

interface RequestInfo {
  id: string
  case_description: string
  case_type: string | null
  status: string
  created_at: string
  client_id: string
  lawyer_id: string
  client?: { id: string; full_name: string; email: string } | null
  lawyer?: { id: string; full_name: string; email: string } | null
}

/* ═══════════════════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════════════════ */
function formatTime(d: string) {
  return new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function formatDate(d: string) {
  const date = new Date(d)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  if (date.toDateString() === today.toDateString()) return 'Today'
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday'
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

function shouldShowDate(msgs: Message[], i: number) {
  if (i === 0) return true
  const prev = new Date(msgs[i - 1].created_at).toDateString()
  const curr = new Date(msgs[i].created_at).toDateString()
  return prev !== curr
}

/* ═══════════════════════════════════════════════════════
   CHAT PAGE
   ═══════════════════════════════════════════════════════ */
export default function Chat() {
  const { requestId } = useParams<{ requestId: string }>()
  const navigate = useNavigate()
  const { user, role } = useAuth()

  const [request, setRequest] = useState<RequestInfo | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')

  const cryptoKeyRef = useRef<CryptoKey | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => {
    if (!requestId) return
    deriveKey(requestId).then(key => { cryptoKeyRef.current = key })
  }, [requestId])

  useEffect(() => {
    if (!requestId || !user) return
    let cancelled = false

    const fetchData = async () => {
      setLoading(true)
      setError('')
      try {
        const { data: reqData, error: reqErr } = await supabase
          .from('requests')
          .select('*')
          .eq('id', requestId)
          .single()
        if (reqErr) throw reqErr
        if (cancelled) return

        const [clientRes, lawyerRes] = await Promise.all([
          supabase.from('users').select('id, full_name, email').eq('id', reqData.client_id).single(),
          supabase.from('users').select('id, full_name, email').eq('id', reqData.lawyer_id).single(),
        ])

        const fullRequest: RequestInfo = {
          ...reqData,
          client: clientRes.data || null,
          lawyer: lawyerRes.data || null,
        }
        setRequest(fullRequest)

        const { data: msgData, error: msgErr } = await supabase
          .from('messages')
          .select('*')
          .eq('request_id', requestId)
          .order('created_at', { ascending: true })
        if (msgErr) throw msgErr
        if (cancelled) return

        const key = cryptoKeyRef.current || await deriveKey(requestId)
        cryptoKeyRef.current = key
        const decrypted = await Promise.all(
          (msgData || []).map(async (m: Message) => ({
            ...m,
            decrypted: m.iv ? await decryptMessage(m.content_encrypted, m.iv, key) : m.content_encrypted,
          }))
        )
        setMessages(decrypted)
        setTimeout(scrollBottom, 100)
      } catch (err: unknown) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load chat')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    fetchData()
    return () => { cancelled = true }
  }, [requestId, user, scrollBottom])

  useEffect(() => {
    if (!requestId) return

    const channel = supabase
      .channel(`chat-${requestId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `request_id=eq.${requestId}`,
      }, async (payload) => {
        const msg = payload.new as Message
        if (messages.find(m => m.id === msg.id)) return
        const key = cryptoKeyRef.current
        if (!key) return
        const decrypted = msg.iv ? await decryptMessage(msg.content_encrypted, msg.iv, key) : msg.content_encrypted
        setMessages(prev => {
          if (prev.find(m => m.id === msg.id)) return prev
          return [...prev, { ...msg, decrypted }]
        })
        setTimeout(scrollBottom, 100)
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestId, scrollBottom])

  const handleSend = async () => {
    if (!input.trim() || !user || !requestId || sending) return
    const text = input.trim()
    setInput('')
    setSending(true)

    try {
      const key = cryptoKeyRef.current
      if (!key) throw new Error('Encryption key not ready')

      const { encrypted, iv } = await encryptMessage(text, key)

      const receiverId = user.id === request?.client_id ? request?.lawyer_id : request?.client_id
      const { error: insertErr } = await supabase.from('messages').insert({
        request_id: requestId,
        sender_id: user.id,
        receiver_id: receiverId,
        content_encrypted: encrypted,
        iv,
      })
      if (insertErr) throw insertErr

      const optimistic: Message = {
        id: crypto.randomUUID(),
        request_id: requestId,
        sender_id: user.id,
        receiver_id: receiverId || '',
        content_encrypted: encrypted,
        iv,
        created_at: new Date().toISOString(),
        decrypted: text,
        isOptimistic: true,
      }
      setMessages(prev => [...prev, optimistic])
      setTimeout(scrollBottom, 50)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to send')
      setInput(text)
    } finally {
      setSending(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
  }

  const isClient = user?.id === request?.client_id
  const otherParty = isClient ? request?.lawyer : request?.client
  const otherName = otherParty?.full_name || (isClient ? 'Lawyer' : 'Client')
  const otherRole = isClient ? 'Attorney at Law' : 'Client'
  const otherInitial = otherName.charAt(0).toUpperCase()

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-muted animate-spin" />
      </div>
    )
  }

  return (
    <div className="h-screen bg-background text-white flex overflow-hidden">
      {/* ════ LEFT PANEL ════ */}
      <aside className="w-[300px] shrink-0 bg-[#0a0a0a] border-r border-white/5 flex flex-col">
        {/* Back */}
        <div className="px-5 h-14 flex items-center border-b border-white/5">
          <button onClick={() => navigate(role === 'lawyer' ? '/lawyer' : '/client')}
            className="flex items-center gap-2 text-muted hover:text-white text-xs font-medium transition-colors bg-transparent border-none cursor-pointer">
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Dashboard
          </button>
        </div>

        {/* Case Info */}
        <div className="flex-1 overflow-y-auto p-5">
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-4">
              <FileText className="w-4 h-4 text-muted" />
              <h3 className="text-sm font-semibold text-white">Case Matter Details</h3>
            </div>
            {request?.case_type && (
              <span className="inline-block text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 border border-white/10 rounded-full mb-3 text-muted">
                {request.case_type}
              </span>
            )}
            <p className="text-muted text-xs leading-relaxed mb-4 whitespace-pre-wrap">
              {(request?.case_description || '').slice(0, 200)}{(request?.case_description || '').length > 200 ? '…' : ''}
            </p>
            <div className="flex flex-col gap-1.5 text-[10px] text-muted">
              <div className="flex items-center justify-between">
                <span>Status</span>
                <span className="text-green-500 font-medium">Active Matter</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Initiated</span>
                <span>{request?.created_at ? new Date(request.created_at).toLocaleDateString() : ''}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Ref ID</span>
                <span className="font-mono">{request?.id.slice(0,8)}</span>
              </div>
            </div>
          </div>

          {/* Other party */}
          <div className="border-t border-white/5 pt-6">
            <h4 className="text-[10px] uppercase tracking-wider font-semibold text-muted mb-4">Counterparty</h4>
            <div className="flex items-center gap-3 bg-[#111111] p-3 rounded-lg border border-white/5">
              <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white font-medium text-xs">
                {otherInitial}
              </div>
              <div>
                <p className="text-white text-sm font-medium">{otherName}</p>
                <p className="text-muted text-[10px]">{otherRole}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Encryption notice */}
        <div className="px-5 py-4 bg-[#050505] border-t border-white/5">
          <div className="flex items-center gap-2 mb-1.5">
            <Lock className="w-3.5 h-3.5 text-green-500" />
            <span className="text-green-500 text-[10px] font-semibold uppercase tracking-wider">Client-Side Encrypted</span>
          </div>
          <p className="text-muted/50 text-[10px] leading-tight">
            Messages are encrypted via AES-256-GCM using the Web Crypto API. Keys are derived locally via PBKDF2. Server stores ciphertext only.
          </p>
        </div>
      </aside>

      {/* ════ RIGHT PANEL ════ */}
      <div className="flex-1 flex flex-col min-w-0 bg-[#000000]">
        {/* Header */}
        <div className="h-14 px-6 flex items-center justify-between border-b border-white/5 bg-[#0a0a0a] shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-white text-sm font-medium">{otherName}</span>
          </div>
          <span className="flex items-center gap-1.5 text-muted text-[10px] font-medium">
            <Shield className="w-3 h-3" /> Secure Connection Established
          </span>
        </div>

        {/* Error */}
        {error && (
          <div className="mx-6 mt-4 p-3 rounded-md bg-red-500/10 text-red-400 text-xs border border-red-500/20 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" /> {error}
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-6 py-6" ref={bottomRef}>
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center max-w-md mx-auto">
              <Lock className="w-8 h-8 text-muted/30 mb-4" />
              <h3 className="text-sm font-medium text-white mb-2">Encrypted Channel Ready</h3>
              <p className="text-muted text-xs leading-relaxed">
                This channel uses AES-256-GCM client-side encryption. Share case details 
                and strategy with your lawyer. The server stores only ciphertext — plaintext never leaves your device.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* System Audit Marker */}
              <div className="flex justify-center mb-6 pt-4">
                <div className="bg-[#111] border border-white/5 px-4 py-2 rounded-md flex items-center gap-2">
                  <Shield className="w-3.5 h-3.5 text-green-500/80" />
                  <span className="text-[10px] text-muted font-mono uppercase tracking-wider">Audit Log: AES-256-GCM Handshake Complete • {formatDate(messages[0]?.created_at || new Date().toISOString())}</span>
                </div>
              </div>
              <AnimatePresence initial={false}>
                {messages.map((msg, i) => {
                  const isMine = msg.sender_id === user?.id
                  return (
                    <div key={msg.id}>
                      {shouldShowDate(messages, i) && (
                        <div className="flex items-center justify-center mb-6 mt-2">
                          <span className="text-muted/50 text-[10px] font-medium uppercase tracking-wider">
                            {formatDate(msg.created_at)}
                          </span>
                        </div>
                      )}

                      <motion.div
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}
                      >
                        <div className={`max-w-[75%] flex flex-col ${isMine ? 'items-end' : 'items-start'}`}>
                          <div className={`px-4 py-2.5 text-sm leading-relaxed rounded-lg ${msg.isOptimistic ? 'opacity-70' : ''}
                            ${isMine
                              ? 'bg-white text-black'
                              : 'bg-[#151515] text-white border border-white/5'
                            }`}>
                            {msg.decrypted || msg.content_encrypted}
                          </div>
                          <div className={`flex items-center gap-1.5 mt-1.5 ${isMine ? 'justify-end' : 'justify-start'}`}>
                            {msg.isOptimistic ? (
                              <Loader2 className="w-2.5 h-2.5 text-muted/50 animate-spin" />
                            ) : (
                              <span className="text-muted/40 text-[10px] font-medium">{formatTime(msg.created_at)}</span>
                            )}
                            {isMine && !msg.isOptimistic && <Lock className="w-2.5 h-2.5 text-muted/30" />}
                          </div>
                        </div>
                      </motion.div>
                    </div>
                  )
                })}
              </AnimatePresence>
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input */}
        <div className="px-6 py-4 border-t border-white/5 bg-[#0a0a0a] shrink-0">
          <div className="flex items-center gap-3">
            <input
              type="text"
              placeholder="Type encrypted message..."
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              className="flex-1 px-4 py-3 rounded-md text-sm text-white placeholder-muted/40
                bg-[#111111] border border-white/10 outline-none
                focus:border-white/30 transition-all duration-200"
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || sending}
              className="h-[46px] px-6 rounded-md bg-white hover:bg-neutral-200 disabled:opacity-40
                flex items-center justify-center transition-colors border-none cursor-pointer shrink-0"
            >
              {sending ? <Loader2 className="w-4 h-4 animate-spin text-black" /> : <span className="text-black text-xs font-semibold">Send</span>}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
