'use client'

import { useState, useRef, useEffect } from 'react'
import { Send, Bot, User, Loader2, Heart, Scale, TrendingUp, DollarSign, Baby, AlertTriangle } from 'lucide-react'

type Message = { role: 'user' | 'assistant'; content: string }

const PROMPT_CATEGORIES = [
  {
    label: 'Reproducción',
    color: 'text-pink-600',
    bg: 'bg-pink-50 border-pink-200 hover:bg-pink-100',
    icon: Heart,
    prompts: [
      { label: 'Estado DIV',         text: '¿Cuántas vacas están en protocolo DIV y cuáles son?' },
      { label: 'Preñeces positivas',  text: '¿Qué vacas tienen diagnóstico de preñez positivo?' },
      { label: 'Vacas servidas',      text: '¿Qué vacas fueron servidas y están esperando palpación?' },
      { label: 'Vacas paridas',       text: 'Listá todas las vacas paridas con fecha de parto' },
      { label: 'Próximos partos',     text: '¿Qué vacas están próximas a parir en los próximos 60 días?' },
      { label: 'Resumen reproductivo',text: 'Hacé un resumen completo del estado reproductivo del establecimiento' },
    ],
  },
  {
    label: 'Pesos y crecimiento',
    color: 'text-blue-600',
    bg: 'bg-blue-50 border-blue-200 hover:bg-blue-100',
    icon: Scale,
    prompts: [
      { label: 'Peso promedio',       text: '¿Cuál es el peso promedio del rodeo por lote?' },
      { label: 'Animales más pesados',text: '¿Cuáles son los 5 animales más pesados?' },
      { label: 'Sin pesar',           text: '¿Qué animales no tienen registro de peso?' },
      { label: 'GDP por lote',        text: '¿Cuál es la ganancia diaria de peso por lote?' },
      { label: 'Terneros al destete', text: '¿Cuánto pesan los terneros de este año al destete?' },
    ],
  },
  {
    label: 'Hacienda',
    color: 'text-emerald-600',
    bg: 'bg-emerald-50 border-emerald-200 hover:bg-emerald-100',
    icon: TrendingUp,
    prompts: [
      { label: 'Composición del rodeo', text: '¿Cómo está compuesto el rodeo por categoría?' },
      { label: 'Animales por lote',     text: '¿Cuántos animales hay en cada lote?' },
      { label: 'Terneros nacidos',      text: '¿Cuántos terneros nacieron este año y de quiénes?' },
      { label: 'Animales sin lote',     text: '¿Hay animales sin lote asignado?' },
    ],
  },
  {
    label: 'Rentabilidad',
    color: 'text-amber-600',
    bg: 'bg-amber-50 border-amber-200 hover:bg-amber-100',
    icon: DollarSign,
    prompts: [
      { label: 'Valor del rodeo',     text: '¿Cuánto vale el rodeo estimado con el precio configurado?' },
      { label: 'Animales para venta', text: '¿Qué animales ya alcanzaron el peso objetivo de venta?' },
      { label: 'Costo acumulado',     text: '¿Cuál es el costo acumulado del rodeo hasta hoy?' },
      { label: 'Mejor lote',         text: '¿Qué lote tiene mejor rendimiento en peso?' },
    ],
  },
]

export default function AsistentePage() {
  const [messages, setMessages]         = useState<Message[]>([])
  const [input, setInput]               = useState('')
  const [loading, setLoading]           = useState(false)
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef  = useRef<HTMLInputElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  async function send(text?: string) {
    const content = (text ?? input).trim()
    if (!content || loading) return

    const userMsg: Message = { role: 'user', content }
    const next = [...messages, userMsg]
    setMessages(next)
    setInput('')
    setLoading(true)

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: next }),
      })
      const data = await res.json() as { ok: boolean; text?: string; error?: string }
      setMessages(m => [...m, { role: 'assistant', content: data.text ?? data.error ?? 'Error al responder' }])
    } catch {
      setMessages(m => [...m, { role: 'assistant', content: 'Error de conexión. Intentá de nuevo.' }])
    } finally {
      setLoading(false)
      inputRef.current?.focus()
    }
  }

  const empty = messages.length === 0
  const activeCat = PROMPT_CATEGORIES.find(c => c.label === activeCategory)

  return (
    <div className="max-w-3xl mx-auto flex flex-col h-[calc(100vh-120px)]">
      {/* Header */}
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-gray-900">Asistente IA</h1>
        <p className="text-gray-500 text-sm mt-0.5">Consultá sobre animales, pesos, reproducción y más</p>
      </div>

      {/* Chat area */}
      <div className="flex-1 overflow-y-auto pb-4">
        {empty ? (
          <div className="flex flex-col gap-6 pt-2">
            {/* Welcome */}
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-emerald-100 rounded-2xl flex items-center justify-center shrink-0">
                <Bot size={24} className="text-emerald-600" />
              </div>
              <div className="bg-white border border-gray-200 rounded-2xl rounded-tl-sm px-4 py-3">
                <p className="text-sm font-medium text-gray-800">¡Hola! Soy tu asistente ganadero.</p>
                <p className="text-sm text-gray-500 mt-0.5">Tengo acceso a todos los datos de tu establecimiento. Elegí una categoría o escribí tu pregunta.</p>
              </div>
            </div>

            {/* Category tabs */}
            <div className="flex gap-2 flex-wrap">
              {PROMPT_CATEGORIES.map(cat => {
                const Icon = cat.icon
                const active = activeCategory === cat.label
                return (
                  <button
                    key={cat.label}
                    onClick={() => setActiveCategory(active ? null : cat.label)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                      active
                        ? cat.bg + ' ' + cat.color
                        : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
                    }`}
                  >
                    <Icon size={13} />
                    {cat.label}
                  </button>
                )
              })}
            </div>

            {/* Prompt grid */}
            {activeCat ? (
              <div className="grid grid-cols-2 gap-2">
                {activeCat.prompts.map(p => {
                  const Icon = activeCat.icon
                  return (
                    <button
                      key={p.label}
                      onClick={() => send(p.text)}
                      className={`text-left px-4 py-3.5 bg-white border rounded-xl transition-colors group ${activeCat.bg}`}
                    >
                      <div className="flex items-start gap-2">
                        <Icon size={14} className={`${activeCat.color} shrink-0 mt-0.5`} />
                        <div>
                          <p className={`text-xs font-semibold ${activeCat.color}`}>{p.label}</p>
                          <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{p.text}</p>
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            ) : (
              /* Show one prompt per category as preview */
              <div className="grid grid-cols-2 gap-2">
                {PROMPT_CATEGORIES.map(cat => {
                  const Icon = cat.icon
                  const preview = cat.prompts[0]
                  return (
                    <button
                      key={cat.label}
                      onClick={() => send(preview.text)}
                      className={`text-left px-4 py-3.5 bg-white border rounded-xl transition-colors ${cat.bg}`}
                    >
                      <div className="flex items-start gap-2">
                        <Icon size={14} className={`${cat.color} shrink-0 mt-0.5`} />
                        <div>
                          <p className={`text-xs font-semibold ${cat.color}`}>{cat.label}</p>
                          <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{preview.text}</p>
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((m, i) => (
              <div key={i} className={`flex gap-3 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {m.role === 'assistant' && (
                  <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center shrink-0 mt-0.5">
                    <Bot size={16} className="text-emerald-600" />
                  </div>
                )}
                <div className={`max-w-[85%] px-4 py-3 rounded-2xl text-sm whitespace-pre-wrap ${
                  m.role === 'user'
                    ? 'bg-emerald-500 text-white rounded-br-sm'
                    : 'bg-white border border-gray-200 text-gray-800 rounded-bl-sm'
                }`}>
                  {m.content}
                </div>
                {m.role === 'user' && (
                  <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center shrink-0 mt-0.5">
                    <User size={16} className="text-gray-600" />
                  </div>
                )}
              </div>
            ))}

            {loading && (
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                  <Bot size={16} className="text-emerald-600" />
                </div>
                <div className="px-4 py-3 bg-white border border-gray-200 rounded-2xl rounded-bl-sm">
                  <Loader2 size={16} className="text-emerald-500 animate-spin" />
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        )}

        {/* Prompt chips visible while chatting */}
        {!empty && !loading && (
          <div className="mt-4 flex gap-2 flex-wrap">
            {PROMPT_CATEGORIES.flatMap(c => c.prompts.slice(0, 1)).map(p => (
              <button
                key={p.text}
                onClick={() => send(p.text)}
                className="text-xs px-3 py-1.5 bg-white border border-gray-200 rounded-full text-gray-600 hover:border-emerald-300 hover:bg-emerald-50 transition-colors"
              >
                {p.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Input */}
      <div className="pt-3 border-t border-gray-200">
        <form
          onSubmit={e => { e.preventDefault(); send() }}
          className="flex gap-2"
        >
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Preguntá sobre el rodeo..."
            className="flex-1 px-4 py-3 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            disabled={loading}
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="px-4 py-3 bg-emerald-500 text-white rounded-xl hover:bg-emerald-600 disabled:opacity-40 transition-colors"
          >
            <Send size={16} />
          </button>
        </form>
      </div>
    </div>
  )
}
