'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'

type Service = { id: string; name: string; description: string | null; duration_minutes: number; price: number | null }
type Doctor = { id: string; name: string; specialty: string | null; bio: string | null; photo_url: string | null; med_services: Service[] }
type Business = { id: string; name: string }

const DAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
const MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

function toLocalDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

function Calendar({ selected, onSelect }: { selected: string | null; onSelect: (d: string) => void }) {
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())

  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const todayStr = toLocalDate(today)

  function prev() {
    if (month === 0) { setMonth(11); setYear(y => y - 1) } else setMonth(m => m - 1)
  }
  function next() {
    if (month === 11) { setMonth(0); setYear(y => y + 1) } else setMonth(m => m + 1)
  }

  const cells: (number | null)[] = [...Array(firstDay).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)]
  // pad to complete row
  while (cells.length % 7 !== 0) cells.push(null)

  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '16px', userSelect: 'none' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <button onClick={prev} style={navBtn}>&lsaquo;</button>
        <span style={{ fontWeight: 600, fontSize: 14 }}>{MONTHS[month]} {year}</span>
        <button onClick={next} style={navBtn}>&rsaquo;</button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 2 }}>
        {DAYS.map(d => (
          <div key={d} style={{ textAlign: 'center', fontSize: 11, color: 'var(--muted)', fontWeight: 600, paddingBottom: 4 }}>{d}</div>
        ))}
        {cells.map((day, i) => {
          if (!day) return <div key={`empty-${i}`} />
          const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`
          const isPast = dateStr < todayStr
          const isSelected = dateStr === selected
          return (
            <button
              key={dateStr}
              disabled={isPast}
              onClick={() => onSelect(dateStr)}
              style={{
                ...dayBtn,
                background: isSelected ? 'var(--accent)' : 'transparent',
                color: isPast ? 'var(--border)' : isSelected ? '#fff' : 'var(--text)',
                cursor: isPast ? 'not-allowed' : 'pointer',
                borderRadius: 6,
                fontWeight: isSelected ? 700 : 400,
              }}
            >{day}</button>
          )
        })}
      </div>
    </div>
  )
}

const navBtn: React.CSSProperties = {
  background: 'none', border: '1px solid var(--border)', borderRadius: 6,
  width: 28, height: 28, cursor: 'pointer', fontSize: 18, color: 'var(--text)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
}
const dayBtn: React.CSSProperties = {
  border: 'none', width: '100%', aspectRatio: '1', fontSize: 13,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
}

type Step = 'service' | 'date' | 'slots' | 'form' | 'done'

export default function BookingPage() {
  const params = useParams()
  const slug = params.slug as string
  const doctorId = params.doctorId as string

  const [doctor, setDoctor] = useState<Doctor | null>(null)
  const [business, setBusiness] = useState<Business | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [step, setStep] = useState<Step>('service')
  const [selectedService, setSelectedService] = useState<Service | null>(null)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [slots, setSlots] = useState<string[]>([])
  const [slotsLoading, setSlotsLoading] = useState(false)
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null)

  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [confirmation, setConfirmation] = useState<{ date: string; time: string; doctor: string } | null>(null)

  useEffect(() => {
    fetch(`/api/public/doctor/${slug}/${doctorId}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) { setError(d.error); return }
        setDoctor(d.doctor)
        setBusiness(d.business)
        const active = d.doctor.med_services.filter((s: Service) => true)
        if (active.length === 1) setSelectedService(active[0])
      })
      .catch(() => setError('No se pudo cargar la información'))
      .finally(() => setLoading(false))
  }, [slug, doctorId])

  async function loadSlots(date: string, service: Service) {
    setSlotsLoading(true)
    setSlots([])
    setSelectedSlot(null)
    const res = await fetch(`/api/public/slots/${slug}/${doctorId}?date=${date}&duration=${service.duration_minutes}`)
    const d = await res.json()
    setSlots(d.slots ?? [])
    setSlotsLoading(false)
  }

  function handleDateSelect(date: string) {
    setSelectedDate(date)
    setStep('slots')
    if (selectedService) loadSlots(date, selectedService)
  }

  function handleServiceSelect(s: Service) {
    setSelectedService(s)
    setStep('date')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedDate || !selectedSlot || !selectedService) return
    setSubmitting(true)
    const res = await fetch(`/api/public/book/${slug}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        doctor_id: doctorId,
        service_id: selectedService.id,
        date: selectedDate,
        time: selectedSlot,
        name, phone, note,
      }),
    })
    const data = await res.json()
    setSubmitting(false)
    if (data.ok) {
      setConfirmation({ date: selectedDate, time: selectedSlot, doctor: doctor!.name })
      setStep('done')
    } else {
      alert(data.error ?? 'Error al agendar')
    }
  }

  const fmt12 = (t: string) => {
    const [h, m] = t.split(':').map(Number)
    const ampm = h >= 12 ? 'PM' : 'AM'
    const hh = h % 12 || 12
    return `${hh}:${String(m).padStart(2,'0')} ${ampm}`
  }

  const fmtDate = (d: string) => {
    const dt = new Date(d + 'T12:00:00')
    return `${DAYS[dt.getDay()]} ${dt.getDate()} de ${MONTHS[dt.getMonth()]}, ${dt.getFullYear()}`
  }

  if (loading) return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: 'var(--muted)', fontSize: 14 }}>Cargando...</div>
    </div>
  )

  if (error) return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: 'var(--danger)', fontSize: 14 }}>{error}</div>
    </div>
  )

  if (!doctor || !business) return null

  const activeServices = doctor.med_services.filter(s => s)

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100, overflowY: 'auto', background: 'var(--bg)' }}>
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '32px 16px 64px' }}>
      {/* Header */}
      <div style={{ width: '100%', maxWidth: 560, marginBottom: 28 }}>
        <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 4 }}>{business.name}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          {doctor.photo_url && (
            <img src={doctor.photo_url} alt={doctor.name}
              style={{ width: 56, height: 56, borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--border)' }} />
          )}
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)' }}>{doctor.name}</h1>
            {doctor.specialty && <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 2 }}>{doctor.specialty}</div>}
          </div>
        </div>
        {doctor.bio && <p style={{ fontSize: 13, color: 'var(--muted)', marginTop: 10, lineHeight: 1.5 }}>{doctor.bio}</p>}
      </div>

      {/* Steps */}
      <div style={{ width: '100%', maxWidth: 560 }}>

        {/* DONE */}
        {step === 'done' && confirmation && (
          <div style={{ ...card, textAlign: 'center' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>✓</div>
            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Cita confirmada</h2>
            <p style={{ color: 'var(--muted)', fontSize: 14, lineHeight: 1.6 }}>
              {fmtDate(confirmation.date)}<br />
              {fmt12(confirmation.time)}<br />
              con {confirmation.doctor}
            </p>
            <p style={{ marginTop: 16, fontSize: 13, color: 'var(--muted)' }}>Recibirás recordatorios por WhatsApp.</p>
          </div>
        )}

        {/* SERVICE */}
        {step !== 'done' && (
          <>
            <SectionHeader
              label="Servicio"
              value={selectedService ? selectedService.name : null}
              active={step === 'service'}
              onClick={() => { if (selectedService) setStep('service') }}
            />
            {step === 'service' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
                {activeServices.length === 0 && (
                  <div style={{ color: 'var(--muted)', fontSize: 13 }}>No hay servicios disponibles.</div>
                )}
                {activeServices.map(s => (
                  <button key={s.id} onClick={() => handleServiceSelect(s)} style={{
                    ...card, textAlign: 'left', cursor: 'pointer', border: selectedService?.id === s.id ? '2px solid var(--accent)' : '1px solid var(--border)',
                    padding: '14px 16px',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                      <span style={{ fontWeight: 600, fontSize: 14 }}>{s.name}</span>
                      <span style={{ fontSize: 13, color: 'var(--muted)' }}>
                        {s.duration_minutes} min{s.price != null ? ` · ₡${Number(s.price).toLocaleString()}` : ''}
                      </span>
                    </div>
                    {s.description && <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>{s.description}</div>}
                  </button>
                ))}
              </div>
            )}

            {/* DATE */}
            {(step === 'date' || step === 'slots' || step === 'form') && (
              <>
                <SectionHeader
                  label="Fecha"
                  value={selectedDate ? fmtDate(selectedDate) : null}
                  active={step === 'date'}
                  onClick={() => { setStep('date'); setSelectedSlot(null) }}
                />
                {step === 'date' && (
                  <div style={{ marginBottom: 20 }}>
                    <Calendar selected={selectedDate} onSelect={handleDateSelect} />
                  </div>
                )}

                {/* SLOTS */}
                {(step === 'slots' || step === 'form') && (
                  <>
                    <SectionHeader
                      label="Hora"
                      value={selectedSlot ? fmt12(selectedSlot) : null}
                      active={step === 'slots'}
                      onClick={() => { setStep('slots') }}
                    />
                    {step === 'slots' && (
                      <div style={{ marginBottom: 20 }}>
                        {slotsLoading && <div style={{ color: 'var(--muted)', fontSize: 13, padding: '8px 0' }}>Cargando horarios...</div>}
                        {!slotsLoading && slots.length === 0 && (
                          <div style={{ color: 'var(--muted)', fontSize: 13, padding: '8px 0' }}>No hay horarios disponibles para este día.</div>
                        )}
                        {!slotsLoading && slots.length > 0 && (
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                            {slots.map(sl => (
                              <button key={sl} onClick={() => { setSelectedSlot(sl); setStep('form') }} style={{
                                padding: '10px 0', border: selectedSlot === sl ? '2px solid var(--accent)' : '1px solid var(--border)',
                                borderRadius: 8, background: selectedSlot === sl ? 'var(--accent-light)' : 'var(--surface)',
                                fontSize: 14, fontWeight: 500, cursor: 'pointer', color: 'var(--text)',
                              }}>{fmt12(sl)}</button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* FORM */}
                    {step === 'form' && (
                      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
                        <div style={{ ...card, padding: '20px' }}>
                          <h3 style={{ fontWeight: 600, fontSize: 15, marginBottom: 16 }}>Tus datos</h3>
                          <Field label="Nombre completo" required>
                            <input value={name} onChange={e => setName(e.target.value)} required placeholder="Ej. María Rodríguez" style={inputStyle} />
                          </Field>
                          <Field label="WhatsApp" required>
                            <input value={phone} onChange={e => setPhone(e.target.value)} required placeholder="+506 8888-8888" style={inputStyle} />
                          </Field>
                          <Field label="Nota (opcional)">
                            <textarea value={note} onChange={e => setNote(e.target.value)} placeholder="Describe brevemente tu motivo de consulta" rows={3} style={{ ...inputStyle, resize: 'vertical' }} />
                          </Field>
                        </div>

                        {/* Summary */}
                        <div style={{ ...card, padding: '14px 16px', background: 'var(--surface2)', fontSize: 13, color: 'var(--muted)', lineHeight: 1.6 }}>
                          <strong style={{ color: 'var(--text)' }}>{selectedService?.name}</strong><br />
                          {fmtDate(selectedDate!)} · {fmt12(selectedSlot!)}
                        </div>

                        <button type="submit" disabled={submitting} style={{
                          background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 8,
                          padding: '13px', fontSize: 15, fontWeight: 600, cursor: submitting ? 'not-allowed' : 'pointer',
                          opacity: submitting ? 0.7 : 1,
                        }}>
                          {submitting ? 'Agendando...' : 'Confirmar cita'}
                        </button>
                      </form>
                    )}
                  </>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
    </div>
  )
}

function SectionHeader({ label, value, active, onClick }: { label: string; value: string | null; active: boolean; onClick: () => void }) {
  return (
    <div
      onClick={value && !active ? onClick : undefined}
      style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '10px 0', marginBottom: active ? 12 : 8,
        cursor: value && !active ? 'pointer' : 'default',
      }}
    >
      <span style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: active ? 'var(--accent)' : 'var(--muted)' }}>
        {label}
      </span>
      {value && !active && (
        <span style={{ fontSize: 13, color: 'var(--accent)', textDecoration: 'underline' }}>{value}</span>
      )}
    </div>
  )
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--muted)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
        {label}{required && ' *'}
      </label>
      {children}
    </div>
  )
}

const card: React.CSSProperties = {
  background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '16px',
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '9px 12px', fontSize: 14,
  border: '1px solid var(--border)', borderRadius: 7, background: 'var(--surface)',
  color: 'var(--text)', outline: 'none',
}

