'use client'

import { useEffect, useRef, useState } from 'react'

type Service = { id: string; name: string; duration_minutes: number; price: number | null; active: boolean }
type Doctor = {
  id: string; name: string; specialty: string | null; bio: string | null
  photo_url: string | null; active: boolean
  license_number: string | null; experience_years: number | null
  education: string | null; languages: string[] | null
  phone: string | null; email: string | null
  certifications: string | null; consultation_fee: number | null
  booking_rules?: Record<string, any>
  med_services?: Service[]
}
type DaySchedule  = { enabled: boolean; start_time: string; end_time: string; location_id: string }
type BookingRules = { min_advance_hours: string; max_advance_days: string; buffer_minutes: string; max_per_day: string }
type Location     = { id: string; name: string; address: string; maps_url: string; phone: string }

const DAYS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
const DEFAULT_SCHEDULE: DaySchedule[] = DAYS.map((_, i) => ({
  enabled: i >= 1 && i <= 5,
  start_time: '08:00', end_time: '17:00', location_id: '',
}))

const EMPTY_DOCTOR = {
  name: '', specialty: '', bio: '', photo_url: '',
  license_number: '', experience_years: '', education: '',
  languages: '', phone: '', email: '', certifications: '',
  consultation_fee: '', active: true,
}

const inp: React.CSSProperties = {
  width: '100%', padding: '8px 12px', fontSize: 13,
  border: '1px solid var(--border)', borderRadius: 7,
  background: '#fff', color: 'var(--text)', outline: 'none',
  boxSizing: 'border-box', fontFamily: 'inherit',
}
const label12: React.CSSProperties = {
  display: 'block', fontSize: 12, fontWeight: 600,
  color: 'var(--muted)', marginBottom: 4, letterSpacing: '.02em',
}
function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label style={label12}>{label}{required && <span style={{ color: '#ef4444', marginLeft: 2 }}>*</span>}</label>
      {children}
    </div>
  )
}

function RuleField({ label, unit, hint, value, onChange }: { label: string; unit: string; hint: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label style={{ ...label12, marginBottom: 3 }}>{label}</label>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <input type="number" min="0" placeholder="—" value={value} onChange={e => onChange(e.target.value)}
          style={{ ...inp, width: 72, flexShrink: 0 }} />
        <span style={{ fontSize: 12, color: 'var(--muted)', whiteSpace: 'nowrap' }}>{unit}</span>
      </div>
      <p style={{ fontSize: 11, color: 'var(--muted)', margin: '3px 0 0', lineHeight: 1.3 }}>{hint}</p>
    </div>
  )
}

function initials(name: string) {
  return name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase()
}

export default function DoctorsPage() {
  const [doctors, setDoctors]       = useState<Doctor[]>([])
  const [loading, setLoading]       = useState(true)
  const [slug, setSlug]             = useState('')
  const [copiedId, setCopiedId]     = useState<string | null>(null)

  // Profile drawer
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editing, setEditing]       = useState<typeof EMPTY_DOCTOR & { id?: string } | null>(null)
  const [saving, setSaving]         = useState(false)
  const [photoFile, setPhotoFile]   = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [uploading, setUploading]   = useState(false)
  const fileInputRef                = useRef<HTMLInputElement>(null)

  // Schedule dialog
  const schedDialogRef              = useRef<HTMLDialogElement>(null)
  const [scheduleDoctor, setScheduleDoctor] = useState<Doctor | null>(null)
  const [schedule, setSchedule]     = useState<DaySchedule[]>(DEFAULT_SCHEDULE)
  const [schedSaving, setSchedSaving] = useState(false)
  const [bookingRules, setBookingRules] = useState<BookingRules>({ min_advance_hours: '', max_advance_days: '', buffer_minutes: '', max_per_day: '' })
  const [locations, setLocations]       = useState<Location[]>([])
  const [editingLoc, setEditingLoc]     = useState<Partial<Location> & { isNew?: boolean } | null>(null)
  const [savingLoc, setSavingLoc]       = useState(false)

  async function load() {
    const [docs, biz] = await Promise.all([
      fetch('/api/doctors').then(r => r.json()),
      fetch('/api/business').then(r => r.json()),
    ])
    setDoctors(docs ?? []); setSlug(biz?.slug ?? ''); setLoading(false)
  }
  useEffect(() => { load() }, [])

  function bookingUrl(doctorId: string) {
    if (typeof window === 'undefined' || !slug) return ''
    return `${window.location.origin}/book/${slug}/${doctorId}`
  }
  function copyLink(doctorId: string) {
    const url = bookingUrl(doctorId)
    if (!url) return
    navigator.clipboard.writeText(url).then(() => {
      setCopiedId(doctorId); setTimeout(() => setCopiedId(null), 2000)
    })
  }

  function openCreate() {
    setEditing({ ...EMPTY_DOCTOR }); setPhotoFile(null); setPhotoPreview(null)
    setDrawerOpen(true)
  }
  function openEdit(d: Doctor) {
    setEditing({
      id: d.id, name: d.name, specialty: d.specialty ?? '',
      bio: d.bio ?? '', photo_url: d.photo_url ?? '',
      license_number: d.license_number ?? '', experience_years: String(d.experience_years ?? ''),
      education: d.education ?? '', languages: (d.languages ?? []).join(', '),
      phone: d.phone ?? '', email: d.email ?? '',
      certifications: d.certifications ?? '', consultation_fee: String(d.consultation_fee ?? ''),
      active: d.active,
    })
    setPhotoFile(null); setPhotoPreview(null)
    setDrawerOpen(true)
  }
  function closeDrawer() { setDrawerOpen(false); setEditing(null) }

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    setPhotoFile(f)
    const reader = new FileReader()
    reader.onload = ev => setPhotoPreview(ev.target?.result as string)
    reader.readAsDataURL(f)
  }

  async function save() {
    if (!editing || !editing.name.trim()) return
    setSaving(true)
    const isNew = !editing.id

    const body: Record<string, any> = {
      name:            editing.name.trim(),
      specialty:       editing.specialty || null,
      bio:             editing.bio || null,
      license_number:  editing.license_number || null,
      experience_years: editing.experience_years ? parseInt(editing.experience_years) : null,
      education:       editing.education || null,
      languages:       editing.languages ? editing.languages.split(',').map(s => s.trim()).filter(Boolean) : null,
      phone:           editing.phone || null,
      email:           editing.email || null,
      certifications:  editing.certifications || null,
      consultation_fee: editing.consultation_fee ? parseFloat(editing.consultation_fee) : null,
      active:          editing.active,
    }
    if (!photoFile) body.photo_url = editing.photo_url || null

    let doctorId = editing.id
    if (isNew) {
      const res  = await fetch('/api/doctors', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const data = await res.json()
      doctorId   = data.id
    } else {
      await fetch('/api/doctors', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: editing.id, ...body }) })
    }

    // Upload photo if selected
    if (photoFile && doctorId) {
      setUploading(true)
      const form = new FormData()
      form.append('file', photoFile)
      form.append('doctor_id', doctorId)
      await fetch('/api/doctors/upload', { method: 'POST', body: form })
      setUploading(false)
    }

    setSaving(false); closeDrawer(); load()
  }

  async function toggleActive(d: Doctor) {
    await fetch('/api/doctors', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: d.id, active: !d.active }) })
    load()
  }

  async function openSchedule(d: Doctor) {
    setScheduleDoctor(d); setEditingLoc(null)
    const [availData, locsData] = await Promise.all([
      fetch(`/api/availability?doctor_id=${d.id}`).then(r => r.json()),
      fetch(`/api/doctors/locations?doctor_id=${d.id}`).then(r => r.json()),
    ])
    const existing = availData.schedule ?? []
    const locs: Location[] = locsData ?? []
    setLocations(locs)
    setSchedule(DEFAULT_SCHEDULE.map((def, i) => {
      const row = existing.find((e: any) => e.day_of_week === i)
      return row
        ? { enabled: true, start_time: row.start_time.slice(0, 5), end_time: row.end_time.slice(0, 5), location_id: row.location_id ?? '' }
        : { ...def, enabled: false }
    }))
    // Load booking rules from the doctor record (already in doctors list)
    const rules = d.booking_rules ?? {}
    setBookingRules({
      min_advance_hours: rules.min_advance_hours != null ? String(rules.min_advance_hours) : '',
      max_advance_days:  rules.max_advance_days  != null ? String(rules.max_advance_days)  : '',
      buffer_minutes:    rules.buffer_minutes     != null ? String(rules.buffer_minutes)    : '',
      max_per_day:       rules.max_per_day        != null ? String(rules.max_per_day)       : '',
    })
    schedDialogRef.current?.showModal()
  }
  function closeSchedule() { schedDialogRef.current?.close() }
  async function saveSchedule() {
    if (!scheduleDoctor) return
    setSchedSaving(true)
    const schedRows = schedule.map((d, i) => ({ day_of_week: i, start_time: d.start_time, end_time: d.end_time, enabled: d.enabled, location_id: d.location_id || null })).filter(r => r.enabled)
    const rules: Record<string, number> = {}
    if (bookingRules.min_advance_hours !== '') rules.min_advance_hours = Number(bookingRules.min_advance_hours)
    if (bookingRules.max_advance_days  !== '') rules.max_advance_days  = Number(bookingRules.max_advance_days)
    if (bookingRules.buffer_minutes    !== '') rules.buffer_minutes    = Number(bookingRules.buffer_minutes)
    if (bookingRules.max_per_day       !== '') rules.max_per_day       = Number(bookingRules.max_per_day)
    await Promise.all([
      fetch('/api/availability', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ doctor_id: scheduleDoctor.id, schedule: schedRows }) }),
      fetch('/api/doctors', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: scheduleDoctor.id, booking_rules: rules }) }),
    ])
    setSchedSaving(false); closeSchedule(); load()
  }

  async function saveLocation() {
    if (!editingLoc || !scheduleDoctor) return
    setSavingLoc(true)
    if (editingLoc.isNew) {
      const { isNew, ...body } = editingLoc
      const res  = await fetch('/api/doctors/locations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...body, doctor_id: scheduleDoctor.id }) })
      const data = await res.json()
      setLocations(l => [...l, data])
    } else {
      await fetch('/api/doctors/locations', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(editingLoc) })
      setLocations(l => l.map(x => x.id === editingLoc.id ? { ...x, ...editingLoc } as Location : x))
    }
    setSavingLoc(false); setEditingLoc(null)
  }

  async function deleteLocation(id: string) {
    await fetch('/api/doctors/locations', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    setLocations(l => l.filter(x => x.id !== id))
    setSchedule(s => s.map(d => d.location_id === id ? { ...d, location_id: '' } : d))
  }

  const currentPhoto = photoPreview || editing?.photo_url || null

  return (
    <div>
      <div style={{ marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-.3px', margin: 0 }}>Doctores</h1>
          <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: 3 }}>{doctors.filter(d => d.active).length} activos</p>
        </div>
        <button className="btn btn-primary" onClick={openCreate}>+ Nuevo doctor</button>
      </div>

      {loading ? (
        <div style={{ color: 'var(--muted)', padding: 40, textAlign: 'center' }}>Cargando...</div>
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          {doctors.length === 0 && (
            <div style={{ color: 'var(--muted)', textAlign: 'center', padding: 48, fontSize: 14 }}>Sin doctores registrados</div>
          )}
          {doctors.map(d => (
            <div key={d.id} style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 12, padding: '16px 20px', display: 'flex', gap: 16, alignItems: 'flex-start', boxShadow: '0 1px 3px rgba(0,0,0,.04)' }}>
              {/* Avatar */}
              <div style={{ flexShrink: 0 }}>
                {d.photo_url ? (
                  <img src={d.photo_url} alt={d.name} style={{ width: 52, height: 52, borderRadius: 10, objectFit: 'cover', border: '1.5px solid var(--border)' }} />
                ) : (
                  <div style={{ width: 52, height: 52, borderRadius: 10, background: '#dbeafe', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17, fontWeight: 700, color: '#2563eb' }}>
                    {initials(d.name)}
                  </div>
                )}
              </div>

              {/* Info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)' }}>{d.name}</span>
                  {d.license_number && <span style={{ fontSize: 11, color: 'var(--muted)', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 4, padding: '1px 6px' }}>Lic. {d.license_number}</span>}
                  <span className={`badge ${d.active ? 'badge-active' : 'badge-lost'}`} style={{ fontSize: 11 }}>{d.active ? 'Activo' : 'Inactivo'}</span>
                </div>
                <div style={{ display: 'flex', gap: 12, marginTop: 4, flexWrap: 'wrap' }}>
                  {d.specialty && <span style={{ fontSize: 12, color: '#2563eb', fontWeight: 500 }}>{d.specialty}</span>}
                  {d.experience_years && <span style={{ fontSize: 12, color: 'var(--muted)' }}>{d.experience_years} años exp.</span>}
                  {d.consultation_fee && <span style={{ fontSize: 12, color: 'var(--muted)' }}>${Number(d.consultation_fee).toLocaleString()}</span>}
                </div>
                {d.med_services && d.med_services.filter(s => s.active).length > 0 && (
                  <div style={{ marginTop: 6, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    {d.med_services.filter(s => s.active).map(s => (
                      <span key={s.id} style={{ fontSize: 11, padding: '2px 8px', background: '#f1f5f9', borderRadius: 99, color: 'var(--muted)', border: '1px solid var(--border)' }}>{s.name}</span>
                    ))}
                  </div>
                )}
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: 6, flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                <button className="btn btn-ghost btn-sm" onClick={() => openEdit(d)}>Editar perfil</button>
                <button className="btn btn-ghost btn-sm" onClick={() => openSchedule(d)}>Horario</button>
                <button className="btn btn-ghost btn-sm" onClick={() => copyLink(d.id)}
                  title={bookingUrl(d.id)} style={{ color: copiedId === d.id ? '#16a34a' : undefined, minWidth: 86 }}>
                  {copiedId === d.id ? '✓ Copiado' : 'Copiar link'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Profile drawer ───────────────────────────────────────────────── */}
      {drawerOpen && editing && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex' }}>
          {/* Backdrop */}
          <div style={{ flex: 1, background: 'rgba(0,0,0,.35)' }} onClick={closeDrawer} />
          {/* Panel */}
          <div style={{ width: 520, maxWidth: '95vw', background: '#fff', overflowY: 'auto', boxShadow: '-8px 0 40px rgba(0,0,0,.14)', display: 'flex', flexDirection: 'column' }}>
            {/* Header */}
            <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, background: '#fff', zIndex: 2 }}>
              <h2 style={{ fontSize: 17, fontWeight: 700, margin: 0 }}>{editing.id ? 'Perfil del doctor' : 'Nuevo doctor'}</h2>
              <button onClick={closeDrawer} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: 'var(--muted)', lineHeight: 1 }}>×</button>
            </div>

            <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: 20, flex: 1 }}>

              {/* Photo upload */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <div style={{ position: 'relative', flexShrink: 0 }}>
                  {currentPhoto ? (
                    <img src={currentPhoto} alt="" style={{ width: 72, height: 72, borderRadius: 12, objectFit: 'cover', border: '1.5px solid var(--border)' }} />
                  ) : (
                    <div style={{ width: 72, height: 72, borderRadius: 12, background: '#dbeafe', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 700, color: '#2563eb' }}>
                      {editing.name ? initials(editing.name) : '?'}
                    </div>
                  )}
                  <button onClick={() => fileInputRef.current?.click()}
                    style={{ position: 'absolute', bottom: -6, right: -6, width: 24, height: 24, borderRadius: '50%', background: '#2563eb', border: '2px solid #fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 13, color: '#fff', lineHeight: 1 }}>
                    ✎
                  </button>
                </div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 2 }}>Foto de perfil</div>
                  <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 6 }}>JPG o PNG, máx 5 MB</div>
                  <button className="btn btn-ghost btn-sm" onClick={() => fileInputRef.current?.click()}>Subir imagen</button>
                  {photoFile && <span style={{ fontSize: 11, color: 'var(--muted)', marginLeft: 8 }}>{photoFile.name}</span>}
                </div>
                <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePhotoChange} />
              </div>

              <div style={{ borderTop: '1px solid var(--border)', paddingTop: 20 }}>
                <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.06em', margin: '0 0 14px' }}>Información básica</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <Field label="Nombre completo" required>
                    <input style={inp} value={editing.name} onChange={e => setEditing(f => f && ({ ...f, name: e.target.value }))} placeholder="Dr. Juan Pérez" />
                  </Field>
                  <Field label="Especialidad">
                    <input style={inp} value={editing.specialty} onChange={e => setEditing(f => f && ({ ...f, specialty: e.target.value }))} placeholder="Medicina general" />
                  </Field>
                  <Field label="N° de licencia / CMP">
                    <input style={inp} value={editing.license_number} onChange={e => setEditing(f => f && ({ ...f, license_number: e.target.value }))} placeholder="12345" />
                  </Field>
                  <Field label="Años de experiencia">
                    <input style={inp} type="number" min="0" max="60" value={editing.experience_years} onChange={e => setEditing(f => f && ({ ...f, experience_years: e.target.value }))} placeholder="10" />
                  </Field>
                  <Field label="Teléfono">
                    <input style={inp} value={editing.phone} onChange={e => setEditing(f => f && ({ ...f, phone: e.target.value }))} placeholder="+593 99 000 0000" />
                  </Field>
                  <Field label="Email">
                    <input style={inp} type="email" value={editing.email} onChange={e => setEditing(f => f && ({ ...f, email: e.target.value }))} placeholder="doctor@clinica.com" />
                  </Field>
                  <div style={{ gridColumn: '1/-1' }}>
                    <Field label="Tarifa de consulta">
                      <input style={inp} type="number" min="0" step="0.01" value={editing.consultation_fee} onChange={e => setEditing(f => f && ({ ...f, consultation_fee: e.target.value }))} placeholder="50.00" />
                    </Field>
                  </div>
                </div>
              </div>

              <div style={{ borderTop: '1px solid var(--border)', paddingTop: 20 }}>
                <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.06em', margin: '0 0 14px' }}>Perfil profesional</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <Field label="Formación académica">
                    <textarea style={{ ...inp, resize: 'vertical', lineHeight: 1.5 }} rows={2}
                      value={editing.education} onChange={e => setEditing(f => f && ({ ...f, education: e.target.value }))}
                      placeholder="Universidad Central del Ecuador — Medicina Interna" />
                  </Field>
                  <Field label="Certificaciones y logros">
                    <textarea style={{ ...inp, resize: 'vertical', lineHeight: 1.5 }} rows={2}
                      value={editing.certifications} onChange={e => setEditing(f => f && ({ ...f, certifications: e.target.value }))}
                      placeholder="Especialista en Diabetes · Miembro de ALAMI" />
                  </Field>
                  <Field label="Idiomas (separados por coma)">
                    <input style={inp} value={editing.languages} onChange={e => setEditing(f => f && ({ ...f, languages: e.target.value }))}
                      placeholder="Español, Inglés" />
                  </Field>
                  <Field label="Descripción / bio">
                    <textarea style={{ ...inp, resize: 'vertical', lineHeight: 1.5 }} rows={3}
                      value={editing.bio} onChange={e => setEditing(f => f && ({ ...f, bio: e.target.value }))}
                      placeholder="Breve descripción que verán los pacientes al agendar..." />
                  </Field>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 14px', background: 'var(--surface)', borderRadius: 8, border: '1px solid var(--border)' }}>
                <input type="checkbox" id="doc-active" checked={editing.active} onChange={e => setEditing(f => f && ({ ...f, active: e.target.checked }))} style={{ width: 16, height: 16 }} />
                <label htmlFor="doc-active" style={{ fontSize: 13, cursor: 'pointer', fontWeight: 500 }}>Doctor activo (visible para reservas)</label>
              </div>
            </div>

            {/* Footer */}
            <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: 8, background: '#fff', position: 'sticky', bottom: 0 }}>
              <button className="btn btn-ghost" onClick={closeDrawer}>Cancelar</button>
              <button className="btn btn-primary" style={{ padding: '8px 24px' }} onClick={save}
                disabled={saving || uploading || !editing.name.trim()}>
                {uploading ? 'Subiendo foto...' : saving ? 'Guardando...' : 'Guardar perfil'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Schedule dialog ───────────────────────────────────────────────── */}
      <dialog ref={schedDialogRef} style={{ border: 'none', borderRadius: 12, padding: 0, width: 560, maxWidth: '95vw', boxShadow: '0 20px 60px rgba(0,0,0,.18)' }}>
        <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Horario semanal</h2>
            {scheduleDoctor && <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{scheduleDoctor.name}</p>}
          </div>
          <button onClick={closeSchedule} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--muted)', lineHeight: 1 }}>×</button>
        </div>
        {scheduleDoctor && bookingUrl(scheduleDoctor.id) && (
          <div style={{ padding: '10px 24px', background: '#f8fafc', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 11, color: 'var(--muted)', flexShrink: 0 }}>Link de reserva:</span>
            <span style={{ fontSize: 11, color: '#2563eb', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{bookingUrl(scheduleDoctor.id)}</span>
            <button className="btn btn-ghost btn-sm" style={{ flexShrink: 0, fontSize: 11, color: copiedId === scheduleDoctor.id ? '#16a34a' : undefined }} onClick={() => copyLink(scheduleDoctor.id)}>
              {copiedId === scheduleDoctor.id ? '✓ Copiado' : 'Copiar'}
            </button>
          </div>
        )}
        <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 10, maxHeight: '70vh', overflowY: 'auto' }}>

          {/* ── Consultorios ── */}
          <div style={{ marginBottom: 4 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.06em', margin: 0 }}>Consultorios</p>
              <button className="btn btn-ghost btn-sm" style={{ fontSize: 12 }}
                onClick={() => setEditingLoc({ isNew: true, name: '', address: '', maps_url: '', phone: '' })}>
                + Agregar
              </button>
            </div>

            {locations.length === 0 && !editingLoc && (
              <p style={{ fontSize: 12, color: 'var(--muted)', margin: '0 0 4px' }}>Sin consultorios — el horario no tendrá ubicación asignada.</p>
            )}

            {locations.map(loc => (
              <div key={loc.id} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px', marginBottom: 6, fontSize: 13, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, color: 'var(--text)' }}>📍 {loc.name}</div>
                  {loc.address && <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 1 }}>{loc.address}</div>}
                  {loc.maps_url && <a href={loc.maps_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: '#2563eb' }}>Ver mapa</a>}
                </div>
                <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                  <button className="btn btn-ghost btn-sm" style={{ fontSize: 11 }}
                    onClick={() => setEditingLoc({ ...loc })}>Editar</button>
                  <button className="btn btn-ghost btn-sm" style={{ fontSize: 11, color: '#ef4444' }}
                    onClick={() => deleteLocation(loc.id)}>×</button>
                </div>
              </div>
            ))}

            {editingLoc && (
              <div style={{ border: '1.5px solid #bfdbfe', borderRadius: 8, padding: 12, background: '#f8faff', display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 6 }}>
                <Field label="Nombre del consultorio">
                  <input style={inp} placeholder="Consultorio Central" value={editingLoc.name ?? ''}
                    onChange={e => setEditingLoc(l => l && ({ ...l, name: e.target.value }))} />
                </Field>
                <Field label="Dirección">
                  <input style={inp} placeholder="Av. Principal 123, Piso 2" value={editingLoc.address ?? ''}
                    onChange={e => setEditingLoc(l => l && ({ ...l, address: e.target.value }))} />
                </Field>
                <Field label="Link de Google Maps / Waze">
                  <input style={inp} placeholder="https://maps.google.com/..." value={editingLoc.maps_url ?? ''}
                    onChange={e => setEditingLoc(l => l && ({ ...l, maps_url: e.target.value }))} />
                </Field>
                <Field label="Teléfono del consultorio">
                  <input style={inp} placeholder="+593 99 000 0000" value={editingLoc.phone ?? ''}
                    onChange={e => setEditingLoc(l => l && ({ ...l, phone: e.target.value }))} />
                </Field>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
                  <button className="btn btn-ghost btn-sm" onClick={() => setEditingLoc(null)}>Cancelar</button>
                  <button className="btn btn-primary btn-sm" onClick={saveLocation} disabled={savingLoc || !editingLoc.name?.trim()}>
                    {savingLoc ? 'Guardando...' : 'Guardar'}
                  </button>
                </div>
              </div>
            )}
          </div>

          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14, marginBottom: -4 }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.06em', margin: '0 0 10px' }}>Horario semanal</p>
          </div>

          {DAYS.map((day, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '90px 80px 80px 1fr', gap: 8, alignItems: 'center' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
                <input type="checkbox" checked={schedule[i]?.enabled ?? false}
                  onChange={e => setSchedule(s => s.map((d, idx) => idx === i ? { ...d, enabled: e.target.checked } : d))} />
                {day}
              </label>
              <input type="time" style={{ ...inp, padding: '6px 8px', opacity: schedule[i]?.enabled ? 1 : .35 }} disabled={!schedule[i]?.enabled}
                value={schedule[i]?.start_time ?? '08:00'}
                onChange={e => setSchedule(s => s.map((d, idx) => idx === i ? { ...d, start_time: e.target.value } : d))} />
              <input type="time" style={{ ...inp, padding: '6px 8px', opacity: schedule[i]?.enabled ? 1 : .35 }} disabled={!schedule[i]?.enabled}
                value={schedule[i]?.end_time ?? '17:00'}
                onChange={e => setSchedule(s => s.map((d, idx) => idx === i ? { ...d, end_time: e.target.value } : d))} />
              <select
                style={{ ...inp, padding: '6px 8px', opacity: schedule[i]?.enabled && locations.length > 0 ? 1 : .35, fontSize: 12 }}
                disabled={!schedule[i]?.enabled || locations.length === 0}
                value={schedule[i]?.location_id ?? ''}
                onChange={e => setSchedule(s => s.map((d, idx) => idx === i ? { ...d, location_id: e.target.value } : d))}
              >
                <option value="">{locations.length === 0 ? 'Sin consultorio' : 'Consultorio...'}</option>
                {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </div>
          ))}
          {/* Booking rules */}
          <div style={{ borderTop: '1px solid var(--border)', marginTop: 16, paddingTop: 16 }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.06em', margin: '0 0 12px' }}>Reglas de reserva</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <RuleField
                label="Anticipación mínima" unit="horas"
                hint="Ej: 2 → no se puede agendar con menos de 2h"
                value={bookingRules.min_advance_hours}
                onChange={v => setBookingRules(r => ({ ...r, min_advance_hours: v }))}
              />
              <RuleField
                label="Ventana máxima" unit="días"
                hint="Ej: 30 → solo se ve disponibilidad 30 días adelante"
                value={bookingRules.max_advance_days}
                onChange={v => setBookingRules(r => ({ ...r, max_advance_days: v }))}
              />
              <RuleField
                label="Buffer entre citas" unit="min"
                hint="Ej: 15 → 15 min de descanso después de cada cita"
                value={bookingRules.buffer_minutes}
                onChange={v => setBookingRules(r => ({ ...r, buffer_minutes: v }))}
              />
              <RuleField
                label="Máx. citas por día" unit="citas"
                hint="Ej: 8 → no acepta más de 8 citas en un día"
                value={bookingRules.max_per_day}
                onChange={v => setBookingRules(r => ({ ...r, max_per_day: v }))}
              />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, paddingTop: 16 }}>
            <button className="btn btn-ghost" onClick={closeSchedule}>Cancelar</button>
            <button className="btn btn-primary" style={{ padding: '7px 20px' }} onClick={saveSchedule} disabled={schedSaving}>
              {schedSaving ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </div>
      </dialog>
    </div>
  )
}
