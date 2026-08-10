'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, useRef } from 'react'
import Link from 'next/link'

const DEFAULT_STAGES = ['Nuevo', 'Calificado', 'Propuesta', 'Negociación', 'Cerrado']

type Conv = {
  id: string; phone: string; status: string; pipeline_stage: string | null
  updated_at: string; leads?: { name?: string; product_interest?: string } | null
}

function timeAgo(ts: string) {
  const m = Math.floor((Date.now() - new Date(ts).getTime()) / 60000)
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h`
  return `${Math.floor(h / 24)}d`
}

const COL_COLORS = ['#e0f2fe','#fef9c3','#f3e8ff','#dcfce7','#fee2e2']
const COL_BORDERS = ['#7dd3fc','#fde047','#c084fc','#86efac','#fca5a5']

export default function KanbanPage() {
  const [convs, setConvs] = useState<Conv[]>([])
  const [stages, setStages] = useState<string[]>(DEFAULT_STAGES)
  const [editingStages, setEditingStages] = useState(false)
  const [stagesDraft, setStagesDraft] = useState<string[]>([])
  const [newStage, setNewStage] = useState('')
  const [moving, setMoving] = useState<string | null>(null)
  const dragCard = useRef<string | null>(null)
  const dragOver = useRef<string | null>(null)

  async function load() {
    const [convsRes, bizRes] = await Promise.all([
      fetch('/api/kanban').then(r => r.json()),
      fetch('/api/business').then(r => r.json()),
    ])
    if (Array.isArray(convsRes)) setConvs(convsRes)
    const savedStages = bizRes?.modules?.kanban?.stages
    if (Array.isArray(savedStages) && savedStages.length > 0) setStages(savedStages)
  }

  useEffect(() => { load() }, [])

  async function moveCard(convId: string, stage: string) {
    setMoving(convId)
    setConvs(prev => prev.map(c => c.id === convId ? { ...c, pipeline_stage: stage } : c))
    await fetch('/api/kanban', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: convId, pipeline_stage: stage }),
    })
    setMoving(null)
  }

  async function saveStages() {
    const updated = stagesDraft.filter(s => s.trim())
    setStages(updated)
    setEditingStages(false)
    // Persist in business modules
    const bizRes = await fetch('/api/business').then(r => r.json())
    const modules = bizRes?.modules ?? {}
    modules.kanban = { ...(modules.kanban ?? {}), enabled: true, stages: updated }
    await fetch('/api/business', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ modules }),
    })
    // Reassign convs in removed stages to first stage
    const removed = stages.filter(s => !updated.includes(s))
    if (removed.length > 0) {
      await Promise.all(
        convs.filter(c => c.pipeline_stage && removed.includes(c.pipeline_stage))
          .map(c => moveCard(c.id, updated[0] ?? ''))
      )
    }
  }

  const unassigned = convs.filter(c => !c.pipeline_stage || !stages.includes(c.pipeline_stage))

  return (
    <div style={{ height: 'calc(100vh - 56px)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '0 0 16px', flexShrink: 0 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Pipeline</h1>
        <span style={{ fontSize: 12, color: 'var(--muted)', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, padding: '2px 8px' }}>
          {convs.length} conversaciones
        </span>
        <div style={{ marginLeft: 'auto' }}>
          <button
            onClick={() => { setStagesDraft([...stages]); setEditingStages(true) }}
            style={{ fontSize: 12, padding: '6px 14px', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--surface)', cursor: 'pointer', color: 'var(--text)' }}
          >
            ✏️ Editar etapas
          </button>
        </div>
      </div>

      {/* Edit stages modal */}
      {editingStages && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'var(--bg)', borderRadius: 12, padding: 24, width: 380, boxShadow: '0 20px 60px rgba(0,0,0,.2)' }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 16px' }}>Editar etapas del pipeline</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
              {stagesDraft.map((s, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input
                    value={s}
                    onChange={e => setStagesDraft(d => d.map((x, j) => j === i ? e.target.value : x))}
                    style={{ flex: 1, padding: '7px 10px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 13, outline: 'none' }}
                  />
                  <button onClick={() => setStagesDraft(d => d.filter((_, j) => j !== i))}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: 18, lineHeight: 1 }}>×</button>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
              <input
                value={newStage}
                onChange={e => setNewStage(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && newStage.trim()) { setStagesDraft(d => [...d, newStage.trim()]); setNewStage('') }}}
                placeholder="Nueva etapa…"
                style={{ flex: 1, padding: '7px 10px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 13, outline: 'none' }}
              />
              <button onClick={() => { if (newStage.trim()) { setStagesDraft(d => [...d, newStage.trim()]); setNewStage('') }}}
                style={{ padding: '7px 12px', borderRadius: 6, border: 'none', background: 'var(--accent)', color: '#fff', cursor: 'pointer', fontSize: 13 }}>
                + Agregar
              </button>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setEditingStages(false)} style={{ padding: '8px 16px', borderRadius: 7, border: '1px solid var(--border)', background: 'none', cursor: 'pointer', fontSize: 13 }}>Cancelar</button>
              <button onClick={saveStages} style={{ padding: '8px 16px', borderRadius: 7, border: 'none', background: 'var(--accent)', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>Guardar</button>
            </div>
          </div>
        </div>
      )}

      {/* Board */}
      <div style={{ flex: 1, display: 'flex', gap: 14, overflowX: 'auto', overflowY: 'hidden', paddingBottom: 8 }}>
        {/* Unassigned column */}
        {unassigned.length > 0 && (
          <div style={{ width: 240, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.08em', padding: '0 2px' }}>
              Sin etapa ({unassigned.length})
            </div>
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
              {unassigned.map(c => <Card key={c.id} c={c} stages={stages} onMove={moveCard} moving={moving} />)}
            </div>
          </div>
        )}

        {stages.map((stage, si) => {
          const cards = convs.filter(c => c.pipeline_stage === stage)
          const bg = COL_COLORS[si % COL_COLORS.length]
          const border = COL_BORDERS[si % COL_BORDERS.length]
          return (
            <div
              key={stage}
              onDragOver={e => { e.preventDefault(); dragOver.current = stage }}
              onDrop={async () => {
                if (dragCard.current && dragOver.current && dragCard.current !== dragOver.current) {
                  await moveCard(dragCard.current, dragOver.current)
                }
                dragCard.current = null; dragOver.current = null
              }}
              style={{ width: 240, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 8 }}
            >
              <div style={{ fontSize: 11, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '.08em', padding: '4px 10px', borderRadius: 6, background: bg, border: `1px solid ${border}` }}>
                {stage} <span style={{ fontWeight: 400, opacity: .7 }}>({cards.length})</span>
              </div>
              <div
                style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6, minHeight: 60, borderRadius: 8, padding: 4,
                  background: 'rgba(0,0,0,.02)', border: '1px dashed transparent', transition: 'border-color .15s' }}
              >
                {cards.map(c => (
                  <div key={c.id} draggable onDragStart={() => { dragCard.current = c.id }}>
                    <Card c={c} stages={stages} onMove={moveCard} moving={moving} />
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function Card({ c, stages, onMove, moving }: { c: Conv; stages: string[]; onMove: (id: string, s: string) => void; moving: string | null }) {
  const phone = c.phone.replace('whatsapp:', '')
  const name = c.leads?.name || phone
  const busy = moving === c.id

  return (
    <Link href={`/conversations/${c.id}`} style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}>
      <div
        style={{
          background: '#fff', border: '1px solid var(--border)', borderRadius: 9,
          padding: '10px 12px', boxShadow: '0 1px 3px rgba(0,0,0,.06)',
          opacity: busy ? 0.5 : 1, cursor: 'pointer',
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 2 }}>{name}</div>
        {c.leads?.product_interest && (
          <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {c.leads.product_interest}
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 10, color: 'var(--muted)' }}>{timeAgo(c.updated_at)}</span>
          <div style={{ display: 'flex', gap: 4 }} onClick={e => e.preventDefault()}>
            {stages.map(s => s !== c.pipeline_stage && (
              <button
                key={s}
                onClick={e => { e.stopPropagation(); e.preventDefault(); onMove(c.id, s) }}
                title={`Mover a ${s}`}
                style={{ fontSize: 9, padding: '2px 5px', borderRadius: 4, border: '1px solid var(--border)', background: 'var(--surface)', cursor: 'pointer', color: 'var(--muted)' }}
              >
                {s.slice(0, 3)}→
              </button>
            ))}
          </div>
        </div>
      </div>
    </Link>
  )
}
