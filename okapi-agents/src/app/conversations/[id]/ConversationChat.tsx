'use client'

import { useState, useRef, useEffect } from 'react'

type Message = {
  id: string
  direction: 'inbound' | 'outbound'
  body: string
  sent_at: string
  needs_approval: boolean
  approved: boolean
}

type Props = {
  conversationId: string
  initialMessages: Message[]
  status: string
  customerPhone: string
  twilioNumber: string
}

export default function ConversationChat({ conversationId, initialMessages, status, customerPhone, twilioNumber }: Props) {
  const [messages, setMessages] = useState(initialMessages)
  const [reply, setReply] = useState('')
  const [sending, setSending] = useState(false)
  const [resolving, setResolving] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const seenIds = useRef(new Set(initialMessages.map(m => m.id)))

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    const poll = async () => {
      try {
        const res = await fetch(`/api/conversations/${conversationId}/messages`)
        if (!res.ok) return
        const { messages: fresh } = await res.json() as { messages: Message[] }
        const newOnes = fresh.filter(m => !seenIds.current.has(m.id))
        if (newOnes.length > 0) {
          newOnes.forEach(m => seenIds.current.add(m.id))
          setMessages(prev => [...prev, ...newOnes])
        }
      } catch {}
    }
    const timer = setInterval(poll, 5000)
    return () => clearInterval(timer)
  }, [conversationId])

  async function sendReply() {
    if (!reply.trim() || sending) return
    setSending(true)
    try {
      const r = await fetch('/api/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId, to: customerPhone, from: twilioNumber, body: reply.trim() }),
      })
      if (r.ok) {
        setMessages(m => [...m, {
          id: Date.now().toString(),
          direction: 'outbound',
          body: reply.trim(),
          sent_at: new Date().toISOString(),
          needs_approval: false,
          approved: true,
        }])
        setReply('')
      }
    } finally {
      setSending(false)
    }
  }

  async function resolve() {
    setResolving(true)
    await fetch(`/api/conversations/${conversationId}/resolve`, { method: 'POST' })
    window.location.reload()
  }

  function formatTime(iso: string) {
    return new Date(iso).toLocaleTimeString('es-CR', { hour: '2-digit', minute: '2-digit' })
  }

  function formatDay(iso: string) {
    return new Date(iso).toLocaleDateString('es-CR', { weekday: 'short', month: 'short', day: 'numeric' })
  }

  let lastDay = ''

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 160px)', padding: 0, overflow: 'hidden' }}>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {messages.length === 0 && (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)', fontSize: 13 }}>
            No messages yet
          </div>
        )}
        {messages.map(m => {
          const day = m.sent_at.slice(0, 10)
          const showDay = day !== lastDay
          lastDay = day
          const isOut = m.direction === 'outbound'

          return (
            <div key={m.id}>
              {showDay && (
                <div style={{ textAlign: 'center', fontSize: 10, color: 'var(--muted)', margin: '8px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                  {formatDay(m.sent_at)}
                  <span style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: isOut ? 'flex-end' : 'flex-start' }}>
                <div style={{
                  maxWidth: '75%',
                  padding: '9px 13px',
                  borderRadius: 14,
                  fontSize: 13,
                  lineHeight: 1.55,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  background: isOut ? '#D91E2A' : 'var(--surface)',
                  color: isOut ? '#fff' : 'var(--text)',
                  borderBottomRightRadius: isOut ? 3 : 14,
                  borderBottomLeftRadius: isOut ? 14 : 3,
                  border: isOut ? 'none' : '1px solid var(--border)',
                }}>
                  {m.body}
                  <div style={{ fontSize: 10, opacity: .5, marginTop: 4, textAlign: isOut ? 'right' : 'left' }}>
                    {formatTime(m.sent_at)}
                  </div>
                </div>
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {/* Reply bar — only show when pending_human or always? Show always for manual control */}
      <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)', background: 'var(--surface)', display: 'flex', gap: 10, alignItems: 'flex-end' }}>
        <textarea
          className="form-control"
          style={{ minHeight: 60, flex: 1 }}
          placeholder={status === 'pending_human' ? 'Escribe una respuesta manual…' : 'Escribe un mensaje…'}
          value={reply}
          onChange={e => setReply(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendReply() } }}
        />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <button className="btn btn-primary btn-sm" onClick={sendReply} disabled={sending || !reply.trim()}>
            {sending ? '…' : 'Send'}
          </button>
          {status === 'pending_human' && (
            <button className="btn btn-ghost btn-sm" onClick={resolve} disabled={resolving}>
              {resolving ? '…' : 'Resolve'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
