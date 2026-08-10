'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'

const DAYS_SHORT  = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb']
const MONTHS_LONG = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

function toISO(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}
function fmt12(t: string) {
  const [h, m] = t.split(':').map(Number)
  return `${h % 12 || 12}:${String(m).padStart(2,'0')} ${h >= 12 ? 'PM' : 'AM'}`
}
function fmtDate(d: string) {
  const dt = new Date(d + 'T12:00:00')
  return `${DAYS_SHORT[dt.getDay()]} ${dt.getDate()} de ${MONTHS_LONG[dt.getMonth()]}`
}

type Appt = {
  id: string; date: string; start_time: string; status: string; doctor_id: string; service_id: string
  doctors: { id: string; name: string; specialty: string | null }
  med_services: { name: string; duration_minutes: number } | null
  doctor_locations: { name: string; address: string | null; maps_url: string | null } | null
  patients: { name: string; phone: string }
}

function Calendar({ selected, onSelect, enabledDays }: {
  selected: string | null; onSelect: (d: string) => void; enabledDays?: Set<number>
}) {
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())
  const todayStr  = toISO(today)
  const firstDay  = new Date(year, month, 1).getDay()
  const daysCount = new Date(year, month + 1, 0).getDate()
  const cells     = [...Array(firstDay).fill(null), ...Array.from({ length: daysCount }, (_, i) => i + 1)]
  while (cells.length % 7 !== 0) cells.push(null)

  function prev() { month === 0 ? (setMonth(11), setYear(y => y - 1)) : setMonth(m => m - 1) }
  function next() { month === 11 ? (setMonth(0), setYear(y => y + 1)) : setMonth(m => m + 1) }

  return (
    <div style={{ userSelect: 'none' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <button onClick={prev} style={{ background: '#f3f4f6', border: 'none', borderRadius: 8, width: 36, height: 36, cursor: 'pointer', fontSize: 20, color: '#374151' }}>‹</button>
        <span style={{ fontWeight: 700, fontSize: 15 }}>{MONTHS_LONG[month]} {year}</span>
        <button onClick={next} style={{ background: '#f3f4f6', border: 'none', borderRadius: 8, width: 36, height: 36, cursor: 'pointer', fontSize: 20, color: '#374151' }}>›</button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 4 }}>
        {DAYS_SHORT.map(d => <div key={d} style={{ textAlign: 'center', fontSize: 11, color: '#9ca3af', fontWeight: 700, paddingBottom: 8 }}>{d}</div>)}
        {cells.map((day, i) => {
          if (!day) return <div key={`e${i}`} />
          const ds  = `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`
          const dow = new Date(ds + 'T12:00:00').getDay()
          const disabled = ds <= todayStr || (enabledDays !== undefined && !enabledDays.has(dow))
          const sel = ds === selected
          return (
            <button key={ds} disabled={disabled} onClick={() => onSelect(ds)} style={{
              border: sel ? '2px solid #2563eb' : '1px solid transparent',
              width: '100%', aspectRatio: '1', borderRadius: 8, fontSize: 14,
              background: sel ? '#2563eb' : 'transparent',
              color: disabled ? '#d1d5db' : sel ? '#fff' : '#111827',
              cursor: disabled ? 'not-allowed' : 'pointer', fontWeight: sel ? 700 : 400,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>{day}</button>
          )
        })}
      </div>
    </div>
  )
}

export default function ManagePage() {
  const params        = useParams()
  const slug          = params.slug as string
  const appointmentId = params.appointmentId as string

  const [phase, setPhase] = useState<'verify' | 'view' | 'reschedule' | 'done'>('verify')
  const [phone, setPhone] = useState('')
  const [appt, setAppt]   = useState<Appt | null>(null)
  const [bizName, setBizName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')
  const [action, setAction]   = useState<'cancelled' | 'rescheduled' | null>(null)

  // Reschedule state
  const [availableDays, setAvailableDays] = useState<Set<number>>(new Set())
  const [newDate, setNewDate]             = useState<string | null>(null)
  const [slots, setSlots]                 = useState<string[]>([])
  const [slotsLoading, setSlotsLoading]   = useState(false)
  const [newSlot, setNewSlot]             = useState<string | null>(null)
  const [submitting, setSubmitting]       = useState(false)

  async function verify(e: React.FormEvent) {
    e.preventDefault(); setLoading(true); setError('')
    const norm = phone.replace(/\s/g, '')
    const res = await fetch(`/api/public/appointment/${slug}/${appointmentId}?phone=${encodeURIComponent(norm)}`)
    const data = await res.json()
    setLoading(false)
    if (!res.ok) { setError(data.error ?? 'No se encontró la cita'); return }
    setAppt(data.appointment); setBizName(data.business.name); setPhase('view')
  }

  async function startReschedule() {
    setPhase('reschedule')
    // Fetch available days for this doctor
    const res = await fetch(`/api/public/locations/${slug}/${appt!.doctors.id}`)
    const data = await res.json()
    // Merge all available_days across locations (or all days if no locations)
    const locs: { available_days?: number[] }[] = data.locations ?? []
    if (locs.length > 0) {
      const days = new Set(locs.flatMap(l => l.available_days ?? []))
      setAvailableDays(days)
    }
  }

  async function loadSlots(date: string) {
    setNewDate(date); setNewSlot(null); setSlotsLoading(true); setSlots([])
    const duration = appt?.med_services?.duration_minutes ?? 30
    const res = await fetch(`/api/public/slots/${slug}/${appt!.doctors.id}?date=${date}&duration=${duration}`)
    const data = await res.json()
    setSlots(data.slots ?? []); setSlotsLoading(false)
  }

  async function doAction(act: 'cancel' | 'reschedule') {
    setSubmitting(true); setError('')
    const body: Record<string, unknown> = { action: act, phone: phone.replace(/\s/g, '') }
    if (act === 'reschedule') { body.date = newDate; body.time = newSlot }
    const res = await fetch(`/api/public/appointment/${slug}/${appointmentId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    })
    const data = await res.json()
    setSubmitting(false)
    if (!res.ok) { setError(data.error ?? 'Error'); return }
    setAction(act === 'cancel' ? 'cancelled' : 'rescheduled'); setPhase('done')
  }

  const cardSt: React.CSSProperties = {
    background: '#fff', borderRadius: 16, padding: 24,
    boxShadow: '0 1px 4px rgba(0,0,0,.06)', marginBottom: 16,
  }
  const inputSt: React.CSSProperties = {
    width: '100%', padding: '11px 14px', fontSize: 15, border: '1.5px solid #e5e7eb',
    borderRadius: 10, background: '#fff', color: '#111827', outline: 'none',
    boxSizing: 'border-box', fontFamily: 'inherit',
  }
  const btnPrimary: React.CSSProperties = {
    background: '#2563eb', color: '#fff', border: 'none', borderRadius: 10,
    padding: '12px 20px', fontSize: 15, fontWeight: 700, cursor: 'pointer', width: '100%',
  }

  return (
    <div style={{ position: 'fixed', inset: 0, overflowY: 'auto', background: '#f3f4f6' }}>
      <div style={{ background: '#fff', borderBottom: '1px solid #e5e7eb', padding: '12px 20px', position: 'sticky', top: 0, zIndex: 20 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#2563eb', letterSpacing: '.06em', textTransform: 'uppercase' }}>{bizName || '…'}</div>
      </div>
      <div style={{ maxWidth: 480, margin: '0 auto', padding: '24px 16px 80px' }}>

        {/* VERIFY */}
        {phase === 'verify' && (
          <div style={cardSt}>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: '#111827', marginBottom: 6 }}>Gestionar mi cita</h2>
            <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 20 }}>Ingresá tu número de WhatsApp para verificar tu identidad.</p>
            <form onSubmit={verify} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <input value={phone} onChange={e => setPhone(e.target.value)} required placeholder="+593 99 000 0000"
                type="tel" style={inputSt} />
              {error && <div style={{ fontSize: 13, color: '#dc2626' }}>{error}</div>}
              <button type="submit" disabled={loading} style={{ ...btnPrimary, opacity: loading ? .6 : 1 }}>
                {loading ? 'Verificando…' : 'Continuar'}
              </button>
            </form>
          </div>
        )}

        {/* VIEW */}
        {phase === 'view' && appt && (
          <>
            <div style={cardSt}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#2563eb', letterSpacing: '.05em', textTransform: 'uppercase', marginBottom: 12 }}>
                Tu cita
              </div>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#111827', marginBottom: 4 }}>{fmtDate(appt.date)}</div>
              <div style={{ fontSize: 15, color: '#374151', marginBottom: 12 }}>{fmt12(appt.start_time)} · {appt.doctors.name}</div>
              {appt.med_services && <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 8 }}>{appt.med_services.name}</div>}
              {appt.doctor_locations && (
                <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: '8px 12px', fontSize: 13 }}>
                  <span style={{ fontWeight: 600, color: '#1e40af' }}>📍 {appt.doctor_locations.name}</span>
                  {appt.doctor_locations.address && <div style={{ color: '#3b82f6', marginTop: 2 }}>{appt.doctor_locations.address}</div>}
                  {appt.doctor_locations.maps_url && (
                    <a href={appt.doctor_locations.maps_url} target="_blank" rel="noopener noreferrer"
                      style={{ fontSize: 12, color: '#2563eb', fontWeight: 600, display: 'inline-block', marginTop: 4 }}>Ver en mapa →</a>
                  )}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button onClick={startReschedule} style={btnPrimary}>Reagendar cita</button>
              <button onClick={() => {
                if (confirm('¿Estás seguro de que querés cancelar tu cita?')) doAction('cancel')
              }} style={{ ...btnPrimary, background: '#fee2e2', color: '#dc2626' }}>
                Cancelar cita
              </button>
            </div>
          </>
        )}

        {/* RESCHEDULE */}
        {phase === 'reschedule' && appt && (
          <div style={cardSt}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
              <button onClick={() => setPhase('view')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: '#6b7280', padding: 0 }}>‹</button>
              <h2 style={{ fontSize: 17, fontWeight: 700, color: '#111827', margin: 0 }}>Elegir nueva fecha</h2>
            </div>

            <Calendar selected={newDate} onSelect={loadSlots} enabledDays={availableDays.size > 0 ? availableDays : undefined} />

            {newDate && (
              <div style={{ marginTop: 20 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#6b7280', letterSpacing: '.05em', textTransform: 'uppercase', marginBottom: 10 }}>
                  Horarios disponibles — {fmtDate(newDate)}
                </div>
                {slotsLoading ? (
                  <div style={{ textAlign: 'center', padding: '16px 0', color: '#9ca3af', fontSize: 13 }}>Buscando horarios...</div>
                ) : slots.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '16px 0', color: '#6b7280', fontSize: 13 }}>No hay horarios disponibles para este día.</div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                    {slots.map(sl => {
                      const sel = newSlot === sl
                      return (
                        <button key={sl} onClick={() => setNewSlot(sl)} style={{
                          padding: '11px 4px', borderRadius: 10, fontSize: 14, fontWeight: 600,
                          border: sel ? '2px solid #2563eb' : '1.5px solid #e5e7eb',
                          background: sel ? '#2563eb' : '#fff', color: sel ? '#fff' : '#111827',
                          cursor: 'pointer',
                        }}>{fmt12(sl)}</button>
                      )
                    })}
                  </div>
                )}

                {newSlot && (
                  <button onClick={() => doAction('reschedule')} disabled={submitting} style={{ ...btnPrimary, marginTop: 16, opacity: submitting ? .6 : 1 }}>
                    {submitting ? 'Guardando…' : `Confirmar — ${fmtDate(newDate)} ${fmt12(newSlot)}`}
                  </button>
                )}
                {error && <div style={{ fontSize: 13, color: '#dc2626', marginTop: 8 }}>{error}</div>}
              </div>
            )}
          </div>
        )}

        {/* DONE */}
        {phase === 'done' && (
          <div style={{ ...cardSt, textAlign: 'center' }}>
            <div style={{ width: 56, height: 56, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, margin: '0 auto 16px',
              background: action === 'cancelled' ? '#fee2e2' : '#dcfce7' }}>
              {action === 'cancelled' ? '✕' : '✓'}
            </div>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: '#111827', marginBottom: 8 }}>
              {action === 'cancelled' ? 'Cita cancelada' : '¡Cita reagendada!'}
            </h2>
            {action === 'rescheduled' && newDate && newSlot && (
              <p style={{ color: '#6b7280', fontSize: 14 }}>
                Nueva cita: <strong style={{ color: '#111827' }}>{fmtDate(newDate)}</strong> a las {fmt12(newSlot)}
              </p>
            )}
            {action === 'cancelled' && (
              <p style={{ color: '#6b7280', fontSize: 14 }}>Tu cita ha sido cancelada. Si querés reagendar podés hacerlo cuando quieras.</p>
            )}
          </div>
        )}

        <p style={{ textAlign: 'center', fontSize: 11, color: '#9ca3af', marginTop: 28 }}>Powered by Okapi Agent</p>
      </div>
    </div>
  )
}
