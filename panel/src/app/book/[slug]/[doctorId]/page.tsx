'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'

type Service  = { id: string; name: string; description: string | null; duration_minutes: number; price: number | null }
type Doctor   = {
  id: string; name: string; specialty: string | null; bio: string | null; photo_url: string | null
  license_number: string | null; experience_years: number | null; education: string | null
  languages: string[] | null; certifications: string | null; consultation_fee: number | null
  med_services: Service[]
}
type Business = { id: string; name: string }
type Step     = 'service' | 'date' | 'slots' | 'form' | 'done'

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
function initials(name: string) {
  return name.split(' ').slice(0,2).map(n => n[0]).join('').toUpperCase()
}

// ── Step progress labels ─────────────────────────────────────────────────────
const STEP_ORDER: Step[] = ['service','date','slots','form']
const STEP_LABELS: Record<Step, string> = { service: 'Servicio', date: 'Fecha', slots: 'Hora', form: 'Datos', done: 'Listo' }

function StepBar({ step, singleService }: { step: Step; singleService: boolean }) {
  const steps = singleService ? STEP_ORDER.slice(1) : STEP_ORDER
  const idx = steps.indexOf(step)
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginBottom: 28 }}>
      {steps.map((s, i) => {
        const done    = i < idx
        const current = i === idx
        return (
          <div key={s} style={{ display: 'flex', alignItems: 'center', flex: i < steps.length - 1 ? 1 : undefined }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <div style={{
                width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, fontWeight: 700, transition: 'all .2s',
                background: done ? '#2563eb' : current ? '#2563eb' : '#e5e7eb',
                color: done || current ? '#fff' : '#9ca3af',
              }}>
                {done ? '✓' : i + 1}
              </div>
              <span style={{ fontSize: 10, fontWeight: 600, color: current ? '#2563eb' : done ? '#6b7280' : '#9ca3af', whiteSpace: 'nowrap', letterSpacing: '.02em' }}>
                {STEP_LABELS[s]}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div style={{ flex: 1, height: 2, background: done ? '#2563eb' : '#e5e7eb', margin: '0 4px', marginBottom: 20, transition: 'background .2s' }} />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Mini calendar ────────────────────────────────────────────────────────────
function Calendar({ selected, onSelect }: { selected: string | null; onSelect: (d: string) => void }) {
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
        <button onClick={prev} style={navBtnStyle}>‹</button>
        <span style={{ fontWeight: 700, fontSize: 15, color: '#111827' }}>
          {MONTHS_LONG[month]} {year}
        </span>
        <button onClick={next} style={navBtnStyle}>›</button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 4 }}>
        {DAYS_SHORT.map(d => (
          <div key={d} style={{ textAlign: 'center', fontSize: 11, color: '#9ca3af', fontWeight: 700, paddingBottom: 8, letterSpacing: '.04em' }}>{d}</div>
        ))}
        {cells.map((day, i) => {
          if (!day) return <div key={`e${i}`} />
          const ds  = `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`
          const past = ds < todayStr
          const sel  = ds === selected
          const isToday = ds === todayStr
          return (
            <button key={ds} disabled={past} onClick={() => onSelect(ds)} style={{
              border: sel ? '2px solid #2563eb' : isToday ? '1px solid #bfdbfe' : '1px solid transparent',
              width: '100%', aspectRatio: '1', borderRadius: 8, fontSize: 14,
              background: sel ? '#2563eb' : isToday ? '#eff6ff' : 'transparent',
              color: past ? '#d1d5db' : sel ? '#fff' : isToday ? '#2563eb' : '#111827',
              cursor: past ? 'not-allowed' : 'pointer',
              fontWeight: sel || isToday ? 700 : 400,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all .12s',
            }}>
              {day}
            </button>
          )
        })}
      </div>
    </div>
  )
}

const navBtnStyle: React.CSSProperties = {
  background: '#f3f4f6', border: 'none', borderRadius: 8,
  width: 36, height: 36, cursor: 'pointer', fontSize: 20, color: '#374151',
  display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1,
}

// ── Input + label ────────────────────────────────────────────────────────────
function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label style={{ fontSize: 12, fontWeight: 700, color: '#6b7280', letterSpacing: '.05em', textTransform: 'uppercase' }}>
        {label}{required && <span style={{ color: '#ef4444', marginLeft: 2 }}>*</span>}
      </label>
      {children}
    </div>
  )
}
const inputSt: React.CSSProperties = {
  width: '100%', padding: '11px 14px', fontSize: 15,
  border: '1.5px solid #e5e7eb', borderRadius: 10, background: '#fff',
  color: '#111827', outline: 'none', boxSizing: 'border-box',
  fontFamily: 'inherit',
}

// ── Main page ────────────────────────────────────────────────────────────────
export default function BookingPage() {
  const params    = useParams()
  const slug      = params.slug as string
  const doctorId  = params.doctorId as string

  const [doctor, setDoctor]     = useState<Doctor | null>(null)
  const [business, setBusiness] = useState<Business | null>(null)
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState<string | null>(null)

  const [step, setStep]                   = useState<Step>('service')
  const [selectedService, setSelectedService] = useState<Service | null>(null)
  const [selectedDate, setSelectedDate]   = useState<string | null>(null)
  const [slots, setSlots]                 = useState<string[]>([])
  const [slotsLoading, setSlotsLoading]   = useState(false)
  const [selectedSlot, setSelectedSlot]   = useState<string | null>(null)

  const [name, setName]         = useState('')
  const [phone, setPhone]       = useState('')
  const [note, setNote]         = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [confirmation, setConfirmation] = useState<{ date: string; time: string; doctor: string } | null>(null)
  const [bioExpanded, setBioExpanded] = useState(false)

  useEffect(() => {
    fetch(`/api/public/doctor/${slug}/${doctorId}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) { setError(d.error); return }
        setDoctor(d.doctor); setBusiness(d.business)
        const active = d.doctor.med_services.filter(Boolean)
        if (active.length === 1) { setSelectedService(active[0]); setStep('date') }
      })
      .catch(() => setError('No se pudo cargar la información'))
      .finally(() => setLoading(false))
  }, [slug, doctorId])

  async function loadSlots(date: string, service: Service) {
    setSlotsLoading(true); setSlots([]); setSelectedSlot(null)
    const res = await fetch(`/api/public/slots/${slug}/${doctorId}?date=${date}&duration=${service.duration_minutes}`)
    const d   = await res.json()
    setSlots(d.slots ?? []); setSlotsLoading(false)
  }

  function handleServiceSelect(s: Service) {
    setSelectedService(s); setSelectedDate(null); setSelectedSlot(null)
    setStep('date')
  }

  function handleDateSelect(date: string) {
    setSelectedDate(date); setStep('slots')
    if (selectedService) loadSlots(date, selectedService)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedDate || !selectedSlot || !selectedService) return
    setSubmitting(true)
    const res = await fetch(`/api/public/book/${slug}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ doctor_id: doctorId, service_id: selectedService.id, date: selectedDate, time: selectedSlot, name, phone, note }),
    })
    const data = await res.json()
    setSubmitting(false)
    if (data.ok) { setConfirmation({ date: selectedDate, time: selectedSlot, doctor: doctor!.name }); setStep('done') }
    else alert(data.error ?? 'Error al agendar')
  }

  if (loading) return (
    <div style={{ position: 'fixed', inset: 0, background: '#f9fafb', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12 }}>
      <div style={{ width: 32, height: 32, border: '3px solid #e5e7eb', borderTopColor: '#2563eb', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <span style={{ fontSize: 13, color: '#9ca3af' }}>Cargando...</span>
    </div>
  )

  if (error) return (
    <div style={{ position: 'fixed', inset: 0, background: '#f9fafb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: '#fff', border: '1px solid #fee2e2', borderRadius: 12, padding: 24, textAlign: 'center', maxWidth: 280 }}>
        <div style={{ fontSize: 28, marginBottom: 8 }}>⚠️</div>
        <div style={{ color: '#dc2626', fontSize: 14 }}>{error}</div>
      </div>
    </div>
  )

  if (!doctor || !business) return null
  const singleService = doctor.med_services.length === 1

  return (
    <div style={{ position: 'fixed', inset: 0, overflowY: 'auto', background: '#f3f4f6' }}>
      <style>{`
        button:focus-visible { outline: 2px solid #2563eb; outline-offset: 2px; }
        @keyframes fadeUp { from { opacity:0; transform:translateY(8px) } to { opacity:1; transform:translateY(0) } }
        .book-section { animation: fadeUp .18s ease both }
      `}</style>

      {/* ── Top bar ── */}
      <div style={{ background: '#fff', borderBottom: '1px solid #e5e7eb', padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 10, position: 'sticky', top: 0, zIndex: 20 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#2563eb', letterSpacing: '.06em', textTransform: 'uppercase' }}>{business.name}</div>
      </div>

      <div style={{ maxWidth: 520, margin: '0 auto', padding: '24px 16px 80px' }}>

        {/* ── Doctor card ── */}
        <div className="book-section" style={{ background: '#fff', borderRadius: 16, padding: '20px', marginBottom: 16, boxShadow: '0 1px 4px rgba(0,0,0,.06)' }}>
          <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
            {doctor.photo_url ? (
              <img src={doctor.photo_url} alt={doctor.name} style={{ width: 64, height: 64, borderRadius: 12, objectFit: 'cover', flexShrink: 0, border: '1px solid #e5e7eb' }} />
            ) : (
              <div style={{ width: 64, height: 64, borderRadius: 12, background: '#dbeafe', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 700, color: '#2563eb', flexShrink: 0 }}>
                {initials(doctor.name)}
              </div>
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <h1 style={{ fontSize: 17, fontWeight: 700, color: '#111827', lineHeight: 1.3, margin: 0 }}>{doctor.name}</h1>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
                {doctor.specialty && (
                  <span style={{ padding: '2px 10px', background: '#eff6ff', color: '#2563eb', borderRadius: 99, fontSize: 12, fontWeight: 600 }}>
                    {doctor.specialty}
                  </span>
                )}
                {doctor.experience_years && (
                  <span style={{ padding: '2px 10px', background: '#f1f5f9', color: '#475569', borderRadius: 99, fontSize: 12 }}>
                    {doctor.experience_years} años exp.
                  </span>
                )}
                {doctor.license_number && (
                  <span style={{ padding: '2px 10px', background: '#f1f5f9', color: '#475569', borderRadius: 99, fontSize: 12 }}>
                    Lic. {doctor.license_number}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Bio */}
          {doctor.bio && (
            <div style={{ marginTop: 14 }}>
              <p style={{ fontSize: 13, color: '#6b7280', lineHeight: 1.6, margin: 0,
                display: bioExpanded ? 'block' : '-webkit-box',
                WebkitLineClamp: bioExpanded ? undefined : 3,
                WebkitBoxOrient: 'vertical' as any,
                overflow: bioExpanded ? 'visible' : 'hidden',
              }}>
                {doctor.bio}
              </p>
              {doctor.bio.length > 120 && (
                <button onClick={() => setBioExpanded(x => !x)} style={{ fontSize: 12, color: '#2563eb', background: 'none', border: 'none', padding: '4px 0 0', cursor: 'pointer', fontWeight: 600 }}>
                  {bioExpanded ? 'Ver menos' : 'Ver más'}
                </button>
              )}
            </div>
          )}

          {/* Extra info rows */}
          {(doctor.education || doctor.certifications || doctor.languages?.length) && (
            <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid #f1f5f9', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {doctor.education && (
                <div style={{ display: 'flex', gap: 8, fontSize: 12 }}>
                  <span style={{ color: '#9ca3af', flexShrink: 0 }}>🎓</span>
                  <span style={{ color: '#374151' }}>{doctor.education}</span>
                </div>
              )}
              {doctor.certifications && (
                <div style={{ display: 'flex', gap: 8, fontSize: 12 }}>
                  <span style={{ color: '#9ca3af', flexShrink: 0 }}>🏅</span>
                  <span style={{ color: '#374151' }}>{doctor.certifications}</span>
                </div>
              )}
              {doctor.languages && doctor.languages.length > 0 && (
                <div style={{ display: 'flex', gap: 8, fontSize: 12, alignItems: 'center' }}>
                  <span style={{ color: '#9ca3af', flexShrink: 0 }}>🌐</span>
                  <span style={{ color: '#374151' }}>{doctor.languages.join(' · ')}</span>
                </div>
              )}
            </div>
          )}

          {/* Consultation fee */}
          {doctor.consultation_fee && (
            <div style={{ marginTop: 12, display: 'inline-flex', alignItems: 'center', gap: 6, background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '6px 12px', fontSize: 13 }}>
              <span style={{ color: '#15803d', fontWeight: 700 }}>${Number(doctor.consultation_fee).toLocaleString()}</span>
              <span style={{ color: '#6b7280' }}>por consulta</span>
            </div>
          )}
        </div>

        {/* ── Done ── */}
        {step === 'done' && confirmation && (
          <div className="book-section" style={{ background: '#fff', borderRadius: 16, padding: 32, textAlign: 'center', boxShadow: '0 1px 4px rgba(0,0,0,.06)' }}>
            <div style={{ width: 64, height: 64, background: '#dcfce7', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, margin: '0 auto 16px' }}>✓</div>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: '#111827', margin: '0 0 8px' }}>¡Cita confirmada!</h2>
            <p style={{ color: '#6b7280', fontSize: 14, lineHeight: 1.7, margin: '0 0 20px' }}>
              <strong style={{ color: '#111827' }}>{fmtDate(confirmation.date)}</strong><br />
              {fmt12(confirmation.time)} · {confirmation.doctor}
            </p>
            <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, padding: '12px 16px', fontSize: 13, color: '#15803d' }}>
              📲 Recibirás un recordatorio por WhatsApp
            </div>
          </div>
        )}

        {/* ── Steps ── */}
        {step !== 'done' && (
          <>
            <StepBar step={step} singleService={singleService} />

            {/* SERVICE */}
            {!singleService && (
              <Section
                number={1} label="Servicio" active={step === 'service'}
                summary={selectedService ? selectedService.name : null}
                onEdit={selectedService ? () => setStep('service') : undefined}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {doctor.med_services.map(s => {
                    const sel = selectedService?.id === s.id
                    return (
                      <button key={s.id} onClick={() => handleServiceSelect(s)} style={{
                        textAlign: 'left', cursor: 'pointer', padding: '14px 16px', borderRadius: 12,
                        border: sel ? '2px solid #2563eb' : '1.5px solid #e5e7eb',
                        background: sel ? '#eff6ff' : '#fff',
                        transition: 'all .12s',
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontWeight: 600, fontSize: 14, color: sel ? '#1d4ed8' : '#111827' }}>{s.name}</span>
                          <span style={{ fontSize: 12, color: '#6b7280', whiteSpace: 'nowrap', flexShrink: 0 }}>
                            {s.duration_minutes} min{s.price != null ? ` · $${Number(s.price).toLocaleString()}` : ''}
                          </span>
                        </div>
                        {s.description && <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4, lineHeight: 1.4 }}>{s.description}</div>}
                      </button>
                    )
                  })}
                </div>
              </Section>
            )}

            {/* DATE */}
            {(step === 'date' || step === 'slots' || step === 'form') && (
              <Section
                number={singleService ? 1 : 2} label="Fecha" active={step === 'date'}
                summary={selectedDate ? fmtDate(selectedDate) : null}
                onEdit={() => { setStep('date'); setSelectedSlot(null) }}
              >
                <Calendar selected={selectedDate} onSelect={handleDateSelect} />
              </Section>
            )}

            {/* SLOTS */}
            {(step === 'slots' || step === 'form') && (
              <Section
                number={singleService ? 2 : 3} label="Horario" active={step === 'slots'}
                summary={selectedSlot ? fmt12(selectedSlot) : null}
                onEdit={() => setStep('slots')}
              >
                {slotsLoading ? (
                  <div style={{ textAlign: 'center', padding: '24px 0', color: '#9ca3af', fontSize: 13 }}>Buscando horarios disponibles...</div>
                ) : slots.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '20px 0' }}>
                    <div style={{ fontSize: 28, marginBottom: 8 }}>📅</div>
                    <div style={{ color: '#6b7280', fontSize: 13 }}>No hay horarios para este día.<br />Prueba con otra fecha.</div>
                    <button onClick={() => setStep('date')} style={{ marginTop: 12, padding: '8px 20px', background: '#eff6ff', color: '#2563eb', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                      Elegir otra fecha
                    </button>
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                    {slots.map(sl => {
                      const sel = selectedSlot === sl
                      return (
                        <button key={sl} onClick={() => { setSelectedSlot(sl); setStep('form') }} style={{
                          padding: '12px 4px', borderRadius: 10, fontSize: 14, fontWeight: 600,
                          border: sel ? '2px solid #2563eb' : '1.5px solid #e5e7eb',
                          background: sel ? '#2563eb' : '#fff',
                          color: sel ? '#fff' : '#111827',
                          cursor: 'pointer', transition: 'all .12s',
                          boxShadow: sel ? '0 2px 8px rgba(37,99,235,.25)' : '0 1px 2px rgba(0,0,0,.04)',
                        }}>
                          {fmt12(sl)}
                        </button>
                      )
                    })}
                  </div>
                )}
              </Section>
            )}

            {/* FORM */}
            {step === 'form' && (
              <Section number={singleService ? 3 : 4} label="Tus datos" active>
                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <Field label="Nombre completo" required>
                    <input value={name} onChange={e => setName(e.target.value)} required placeholder="Ej. María Rodríguez"
                      style={inputSt} onFocus={e => (e.target.style.borderColor='#2563eb')} onBlur={e => (e.target.style.borderColor='#e5e7eb')} />
                  </Field>
                  <Field label="WhatsApp" required>
                    <input value={phone} onChange={e => setPhone(e.target.value)} required placeholder="+593 99 000 0000"
                      type="tel" style={inputSt} onFocus={e => (e.target.style.borderColor='#2563eb')} onBlur={e => (e.target.style.borderColor='#e5e7eb')} />
                  </Field>
                  <Field label="Motivo de consulta (opcional)">
                    <textarea value={note} onChange={e => setNote(e.target.value)} rows={3}
                      placeholder="Describe brevemente por qué agendas esta cita..."
                      style={{ ...inputSt, resize: 'vertical', lineHeight: 1.5 }}
                      onFocus={e => (e.target.style.borderColor='#2563eb')} onBlur={e => (e.target.style.borderColor='#e5e7eb')} />
                  </Field>

                  {/* Summary chip */}
                  <div style={{ background: '#f8fafc', border: '1px solid #e5e7eb', borderRadius: 10, padding: '12px 14px', fontSize: 13, color: '#374151', lineHeight: 1.6 }}>
                    <div style={{ fontWeight: 600, color: '#111827', marginBottom: 2 }}>{selectedService?.name}</div>
                    <div style={{ color: '#6b7280' }}>{fmtDate(selectedDate!)} · {fmt12(selectedSlot!)}</div>
                  </div>

                  <button type="submit" disabled={submitting || !name.trim() || !phone.trim()} style={{
                    background: submitting || !name.trim() || !phone.trim() ? '#93c5fd' : '#2563eb',
                    color: '#fff', border: 'none', borderRadius: 12, padding: '15px',
                    fontSize: 16, fontWeight: 700, cursor: submitting ? 'not-allowed' : 'pointer',
                    boxShadow: '0 2px 12px rgba(37,99,235,.3)', transition: 'all .15s',
                    letterSpacing: '.01em',
                  }}>
                    {submitting ? 'Confirmando...' : 'Confirmar cita'}
                  </button>
                </form>
              </Section>
            )}
          </>
        )}

        <p style={{ textAlign: 'center', fontSize: 11, color: '#9ca3af', marginTop: 28 }}>
          Powered by Okapi Agent
        </p>
      </div>
    </div>
  )
}

// ── Section card ─────────────────────────────────────────────────────────────
function Section({ number, label, active, summary, onEdit, children }: {
  number: number; label: string; active: boolean
  summary?: string | null; onEdit?: () => void; children?: React.ReactNode
}) {
  const collapsed = !active && summary
  return (
    <div className="book-section" style={{
      background: '#fff', borderRadius: 16, marginBottom: 12,
      border: active ? '1.5px solid #bfdbfe' : '1px solid #e5e7eb',
      boxShadow: active ? '0 0 0 3px rgba(37,99,235,.06), 0 1px 4px rgba(0,0,0,.06)' : '0 1px 3px rgba(0,0,0,.04)',
      overflow: 'hidden', transition: 'border .15s, box-shadow .15s',
    }}>
      <div style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        borderBottom: active ? '1px solid #f1f5f9' : 'none',
        cursor: collapsed ? 'pointer' : 'default',
      }} onClick={collapsed && onEdit ? onEdit : undefined}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 24, height: 24, borderRadius: '50%', background: active ? '#2563eb' : collapsed ? '#dcfce7' : '#f3f4f6',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700,
            color: active ? '#fff' : collapsed ? '#15803d' : '#9ca3af', flexShrink: 0 }}>
            {collapsed ? '✓' : number}
          </div>
          <span style={{ fontWeight: 700, fontSize: 14, color: active ? '#111827' : collapsed ? '#374151' : '#9ca3af' }}>{label}</span>
          {collapsed && summary && <span style={{ fontSize: 13, color: '#6b7280' }}>— {summary}</span>}
        </div>
        {collapsed && onEdit && (
          <button onClick={e => { e.stopPropagation(); onEdit() }} style={{ fontSize: 12, color: '#2563eb', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, padding: '2px 0' }}>
            Cambiar
          </button>
        )}
      </div>
      {active && (
        <div style={{ padding: '16px 18px 18px' }}>
          {children}
        </div>
      )}
    </div>
  )
}
