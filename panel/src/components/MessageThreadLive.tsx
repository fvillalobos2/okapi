'use client'
import { useEffect, useRef, useState } from 'react'

type Msg = { role: 'user' | 'assistant'; content: string; ts?: string }

function timeLabel(ts?: string) {
  if (!ts) return ''
  return new Date(ts).toLocaleTimeString('es-CR', { hour: '2-digit', minute: '2-digit' })
}
function dayLabel(ts?: string) {
  if (!ts) return ''
  return new Date(ts).toLocaleDateString('es-CR', { weekday: 'long', day: 'numeric', month: 'long' })
}

export default function MessageThreadLive({
  convId,
  initial,
}: {
  convId: string
  initial: Msg[]
}) {
  const [messages, setMessages] = useState<Msg[]>(initial)
  const [live, setLive] = useState(false)
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const prevCount = useRef(initial.length)

  // scroll to bottom on mount
  useEffect(() => { bottomRef.current?.scrollIntoView() }, [])

  // poll every 5s + immediately on tab focus
  useEffect(() => {
    async function poll() {
      try {
        const res = await fetch(`/api/conversations/${convId}`)
        if (!res.ok) return
        const data = await res.json()
        const msgs: Msg[] = Array.isArray(data.messages) ? data.messages : []
        setMessages(msgs)
        setLive(true)
        if (msgs.length > prevCount.current) {
          prevCount.current = msgs.length
          setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
        }
      } catch { /* ignore */ }
    }

    function onVisible() { if (document.visibilityState === 'visible') poll() }

    const timer = setInterval(poll, 5_000)
    document.addEventListener('visibilitychange', onVisible)
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', onVisible) }
  }, [convId])

  function autoResize() {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 120) + 'px'
  }

  async function send() {
    if (!message.trim() || sending) return
    setSending(true)
    setSendError('')
    const res = await fetch(`/api/conversations/${convId}/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message }),
    })
    if (res.ok) {
      setMessage('')
      if (textareaRef.current) textareaRef.current.style.height = 'auto'
      // optimistically add the message while polling catches up
      const optimistic: Msg = { role: 'assistant', content: message.trim(), ts: new Date().toISOString() }
      setMessages(prev => [...prev, optimistic])
      prevCount.current += 1
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
    } else {
      const d = await res.json().catch(() => ({}))
      setSendError(d.error || 'Error al enviar')
    }
    setSending(false)
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); send() }
  }

  let lastDay = ''

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#ECE5DD', position: 'relative' }}>

      {/* Live indicator */}
      {live && (
        <div style={{ position: 'absolute', top: 10, right: 12, zIndex: 10, pointerEvents: 'none' }}>
          <span style={{ fontSize: 10, color: '#075E54', display: 'flex', alignItems: 'center', gap: 4, background: 'rgba(255,255,255,.8)', backdropFilter: 'blur(4px)', borderRadius: 20, padding: '3px 8px', border: '1px solid rgba(0,0,0,.06)' }}>
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#25D366', display: 'inline-block', animation: 'pulse 2s ease-in-out infinite' }} />
            En vivo
          </span>
        </div>
      )}

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px 8px', display: 'flex', flexDirection: 'column', gap: 3 }}>
        {messages.length === 0 ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#667781', fontSize: 13 }}>
            Sin mensajes registrados
          </div>
        ) : messages.map((m, i) => {
          const isOut = m.role === 'assistant'
          const day = m.ts ? m.ts.slice(0, 10) : ''
          const showDay = day && day !== lastDay
          if (day) lastDay = day

          return (
            <div key={i}>
              {showDay && (
                <div style={{ textAlign: 'center', margin: '12px 0 8px' }}>
                  <span style={{ fontSize: 11, color: '#667781', background: 'rgba(255,255,255,.85)', borderRadius: 8, padding: '4px 10px', boxShadow: '0 1px 1px rgba(0,0,0,.1)' }}>
                    {dayLabel(m.ts)}
                  </span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: isOut ? 'flex-end' : 'flex-start', marginBottom: 2 }}>
                <div style={{
                  maxWidth: '72%',
                  padding: '7px 12px 6px',
                  borderRadius: isOut ? '12px 12px 3px 12px' : '12px 12px 12px 3px',
                  fontSize: 13.5,
                  lineHeight: 1.5,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  background: isOut ? 'var(--accent)' : '#FFFFFF',
                  color: isOut ? '#fff' : '#111827',
                  boxShadow: '0 1px 2px rgba(0,0,0,.13)',
                  position: 'relative',
                }}>
                  {m.content}
                  <div style={{ fontSize: 10, color: isOut ? 'rgba(255,255,255,.65)' : '#667781', marginTop: 4, textAlign: 'right', lineHeight: 1 }}>
                    {timeLabel(m.ts)}
                  </div>
                </div>
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {/* Send bar */}
      <div style={{ background: '#F0F2F5', borderTop: '1px solid #DDD', padding: '10px 16px', display: 'flex', alignItems: 'flex-end', gap: 10, flexShrink: 0 }}>
        <textarea
          ref={textareaRef}
          value={message}
          onChange={e => { setMessage(e.target.value); setSendError(''); autoResize() }}
          onKeyDown={onKeyDown}
          placeholder="Escribe un mensaje"
          rows={1}
          style={{
            flex: 1,
            padding: '9px 14px',
            borderRadius: 22,
            border: 'none',
            background: '#FFFFFF',
            fontSize: 14,
            color: '#111827',
            resize: 'none',
            outline: 'none',
            fontFamily: 'inherit',
            lineHeight: 1.5,
            boxShadow: '0 1px 2px rgba(0,0,0,.08)',
            maxHeight: 120,
            overflowY: 'auto',
          }}
        />
        <button
          onClick={send}
          disabled={sending || !message.trim()}
          title="Enviar (⌘↵)"
          style={{
            width: 42, height: 42,
            borderRadius: '50%',
            border: 'none',
            background: sending || !message.trim() ? '#BFC6CC' : '#128C7E',
            color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: sending || !message.trim() ? 'default' : 'pointer',
            flexShrink: 0,
            transition: 'background .15s',
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M22 2L11 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M22 2L15 22L11 13L2 9L22 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>

      {sendError && (
        <div style={{ padding: '6px 16px', background: '#FEE2E2', fontSize: 12, color: '#DC2626', flexShrink: 0 }}>
          {sendError}
        </div>
      )}
    </div>
  )
}
