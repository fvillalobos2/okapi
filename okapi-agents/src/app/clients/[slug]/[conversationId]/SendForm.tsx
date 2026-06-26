'use client'

import { useState } from 'react'

export default function SendForm({ conversationId }: { conversationId: string }) {
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)

  async function handleSend() {
    const body = message.trim()
    if (!body) return
    setSending(true)
    try {
      const res = await fetch('/api/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversation_id: conversationId, body }),
      })
      if (res.ok) {
        setMessage('')
        // Reload to show new message
        window.location.reload()
      }
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="bg-white border-t border-zinc-200 px-6 py-4 max-w-2xl mx-auto w-full">
      <div className="flex gap-3">
        <textarea
          className="flex-1 resize-none rounded-xl border border-zinc-200 px-4 py-2.5 text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent"
          rows={2}
          placeholder="Escribe un mensaje…"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              handleSend()
            }
          }}
          disabled={sending}
        />
        <button
          onClick={handleSend}
          disabled={sending || !message.trim()}
          className="px-5 py-2.5 bg-zinc-900 text-white text-sm font-medium rounded-xl hover:bg-zinc-700 disabled:opacity-40 transition-colors"
        >
          {sending ? '…' : 'Enviar'}
        </button>
      </div>
    </div>
  )
}
