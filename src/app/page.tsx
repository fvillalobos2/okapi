'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'

function useScrollReveal() {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect() } }, { threshold: 0.12 })
    obs.observe(el)
    return () => obs.disconnect()
  }, [])
  return { ref, visible }
}

const FAQS = [
  { q: '¿Necesito instalar algo?', a: 'No. Okapi funciona 100% en el navegador. Vos accedés desde tu computadora y tus clientes desde el celular al escanear el QR. Sin apps, sin descargas.' },
  { q: '¿Cómo acceden mis clientes a la página de reseñas?', a: 'Hay tres formas: escaneando el código QR que generamos para vos, recibiendo el link directo por email o por WhatsApp. Cualquier canal abre la misma página — sin app, sin registro.' },
  { q: '¿Qué pasa con los clientes insatisfechos?', a: 'Si alguien califica con 1-3 estrellas, lo llevamos a un formulario privado donde puede contar qué pasó. Vos recibís esa información por email y si quiere contacto directo, se abre WhatsApp automáticamente.' },
  { q: '¿Puedo conectar múltiples plataformas?', a: 'Sí. Podés activar hasta 6 plataformas: Google, TripAdvisor, OpenTable, TheFork, Facebook y Yelp. Los clientes satisfechos eligen en cuál dejar su reseña.' },
  { q: '¿Es legal hacer esto?', a: 'Sí. Okapi no altera ni elimina reseñas — simplemente filtra el feedback antes de que llegue a publicarse. Es una práctica común en la industria de hospitalidad.' },
  { q: '¿Cuánto tarda en estar activo?', a: 'Menos de 5 minutos. Creás tu cuenta, configurás tu negocio con nuestro wizard paso a paso, y ya tenés tu QR listo para imprimir.' },
  { q: '¿Puedo cancelar cuando quiera?', a: 'Sí, sin contratos ni penalidades. Podés cancelar tu suscripción en cualquier momento desde el dashboard.' },
]

function FAQ() {
  const [open, setOpen] = useState<number | null>(null)
  return (
    <section style={{ padding: '88px 32px', maxWidth: 720, margin: '0 auto' }}>
      <Reveal>
        <div style={{ textAlign: 'center', marginBottom: 56 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#C8102E', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 12 }}>FAQ</div>
          <h2 style={{ fontSize: 'clamp(26px, 3.5vw, 38px)', fontWeight: 800, color: '#111', letterSpacing: '-0.02em' }}>Preguntas frecuentes</h2>
        </div>
      </Reveal>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
        {FAQS.map((faq, i) => (
          <Reveal key={i} delay={i * 40}>
            <div style={{ borderBottom: '1px solid #ebebeb', overflow: 'hidden' }}>
              <button
                onClick={() => setOpen(open === i ? null : i)}
                style={{ width: '100%', background: 'none', border: 'none', padding: '20px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, cursor: 'pointer', textAlign: 'left' }}>
                <span style={{ fontSize: 15, fontWeight: 600, color: '#111', lineHeight: 1.4 }}>{faq.q}</span>
                <span style={{ fontSize: 20, color: '#aaa', flexShrink: 0, transform: open === i ? 'rotate(45deg)' : 'none', transition: 'transform 0.2s ease', lineHeight: 1 }}>+</span>
              </button>
              <div style={{ maxHeight: open === i ? 200 : 0, overflow: 'hidden', transition: 'max-height 0.35s ease' }}>
                <p style={{ fontSize: 14, color: '#666', lineHeight: 1.75, paddingBottom: 20, margin: 0 }}>{faq.a}</p>
              </div>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  )
}

function Reveal({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const { ref, visible } = useScrollReveal()
  return (
    <div ref={ref} style={{ opacity: visible ? 1 : 0, transform: visible ? 'translateY(0)' : 'translateY(28px)', transition: `opacity 0.6s ease ${delay}ms, transform 0.6s ease ${delay}ms` }}>
      {children}
    </div>
  )
}

export default function Home() {
  const [hoveredFeature, setHoveredFeature] = useState<string | null>(null)
  const [hoveredPlan, setHoveredPlan] = useState<string | null>(null)

  return (
    <div style={{ fontFamily: 'system-ui, -apple-system, sans-serif', color: '#111', background: '#fff', overflowX: 'hidden' }}>
      <style>{`
        @keyframes fadeUp { from { opacity: 0; transform: translateY(32px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes float { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-8px); } }
        .hero-title { animation: fadeUp 0.7s ease 0.1s both; }
        .hero-sub   { animation: fadeUp 0.7s ease 0.25s both; }
        .hero-cta   { animation: fadeUp 0.7s ease 0.4s both; }
        .hero-mock  { animation: fadeUp 0.8s ease 0.55s both; }
        .float-notif { animation: float 3.5s ease-in-out infinite; }
        .nav-link:hover { color: #fff !important; }
        .btn-ghost:hover { background: rgba(255,255,255,0.1) !important; color: #fff !important; }
        a, button { transition: all 0.18s ease; }
      `}</style>

      {/* Nav */}
      <nav style={{ position: 'sticky', top: 0, zIndex: 50, background: 'rgba(10,10,10,0.92)', backdropFilter: 'blur(16px)', borderBottom: '1px solid #1e1e1e', padding: '0 32px', height: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: '#C8102E', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 900, color: '#fff' }}>O</div>
          <span style={{ fontWeight: 700, fontSize: 15, color: '#fff' }}>Okapi Reviews</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <a href="#como-funciona" className="nav-link" style={{ fontSize: 13, fontWeight: 500, color: '#777', textDecoration: 'none', padding: '7px 14px', borderRadius: 8 }}>Cómo funciona</a>
          <a href="#pricing" className="nav-link" style={{ fontSize: 13, fontWeight: 500, color: '#777', textDecoration: 'none', padding: '7px 14px', borderRadius: 8 }}>Precios</a>
          <div style={{ width: 1, height: 20, background: '#2a2a2a', margin: '0 8px' }} />
          <Link href="/login" className="nav-link" style={{ fontSize: 13, fontWeight: 500, color: '#777', textDecoration: 'none', padding: '7px 14px', borderRadius: 8 }}>Login</Link>
          <Link href="/login" style={{ padding: '8px 18px', background: '#C8102E', color: '#fff', borderRadius: 8, fontSize: 13, fontWeight: 600, textDecoration: 'none' }}
            onMouseEnter={e => (e.currentTarget.style.background = '#a80d26')}
            onMouseLeave={e => (e.currentTarget.style.background = '#C8102E')}>
            Empezar gratis
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section style={{ background: '#0f0f0f', padding: '96px 32px 80px', textAlign: 'center' }}>
        <div style={{ maxWidth: 640, margin: '0 auto' }}>
          <div className="hero-title" style={{ display: 'inline-block', padding: '5px 14px', background: '#1e1e1e', border: '1px solid #333', borderRadius: 20, fontSize: 12, fontWeight: 600, color: '#777', marginBottom: 32, letterSpacing: '0.05em' }}>
            GESTIÓN DE RESEÑAS PARA HOSPITALIDAD
          </div>
          <h1 className="hero-title" style={{ fontSize: 'clamp(40px, 6vw, 68px)', fontWeight: 900, color: '#fff', lineHeight: 1.08, marginBottom: 22, letterSpacing: '-0.03em' }}>
            Más reseñas positivas.<br />Menos críticas públicas.
          </h1>
          <p className="hero-sub" style={{ fontSize: 17, color: '#666', lineHeight: 1.75, marginBottom: 40, maxWidth: 480, margin: '0 auto 40px' }}>
            Tu cliente accede vía QR, email o WhatsApp, califica su experiencia y vos decidís qué llega a Google. Los contentos publican una reseña. Los insatisfechos te hablan a vos.
          </p>
          <div className="hero-cta" style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/login" style={{ padding: '13px 30px', background: '#C8102E', color: '#fff', borderRadius: 10, fontSize: 15, fontWeight: 700, textDecoration: 'none', boxShadow: '0 4px 20px rgba(200,16,46,0.35)' }}
              onMouseEnter={e => { e.currentTarget.style.background = '#a80d26'; e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 28px rgba(200,16,46,0.45)' }}
              onMouseLeave={e => { e.currentTarget.style.background = '#C8102E'; e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 20px rgba(200,16,46,0.35)' }}>
              Empezar gratis →
            </Link>
            <a href="#como-funciona" className="btn-ghost" style={{ padding: '13px 24px', background: 'transparent', color: '#777', border: '1px solid #2a2a2a', borderRadius: 10, fontSize: 15, fontWeight: 500, textDecoration: 'none' }}>
              Cómo funciona
            </a>
          </div>
        </div>

        {/* Mockup */}
        <div className="hero-mock" style={{ maxWidth: 860, margin: '64px auto 0', display: 'grid', gridTemplateColumns: '1fr 1.8fr', gap: 16, alignItems: 'end' }}>
          <div style={{ background: '#1a1a1a', borderRadius: 28, padding: '14px 10px', border: '5px solid #222', boxShadow: '0 32px 64px rgba(0,0,0,0.6)', maxWidth: 200, margin: '0 auto', width: '100%' }}>
            <div style={{ background: '#0f0f0f', borderRadius: 20, padding: '18px 14px' }}>
              <div style={{ textAlign: 'center', marginBottom: 14 }}>
                <div style={{ width: 38, height: 38, borderRadius: 10, background: '#C8102E', margin: '0 auto 8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>🍽️</div>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#fff' }}>Fermata Kitchen</div>
                <div style={{ fontSize: 9, color: '#444', marginTop: 3 }}>¿Cómo calificarías tu visita?</div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'center', gap: 3, marginBottom: 16 }}>
                {'★★★★★'.split('').map((s, i) => <span key={i} style={{ fontSize: 20, color: '#f59e0b' }}>{s}</span>)}
              </div>
              <div style={{ fontSize: 9, color: '#444', textAlign: 'center', marginBottom: 10 }}>¿Nos dejás una reseña?</div>
              <div style={{ background: '#4285F4', borderRadius: 7, padding: '8px', fontSize: 9, fontWeight: 700, color: '#fff', textAlign: 'center', marginBottom: 6 }}>G  Dejar reseña en Google</div>
              <div style={{ background: '#00AF87', borderRadius: 7, padding: '8px', fontSize: 9, fontWeight: 700, color: '#fff', textAlign: 'center' }}>TA  TripAdvisor</div>
            </div>
          </div>

          <div style={{ background: '#fff', borderRadius: 14, padding: '18px', boxShadow: '0 32px 64px rgba(0,0,0,0.5)', textAlign: 'left', position: 'relative' }}>
            <div className="float-notif" style={{ position: 'absolute', top: -18, right: 16, background: '#fff', borderRadius: 10, padding: '8px 14px', boxShadow: '0 4px 20px rgba(0,0,0,0.15)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 24, height: 24, borderRadius: '50%', background: '#22c55e', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11 }}>★</div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#111' }}>Nueva reseña 5★ en Google</div>
                <div style={{ fontSize: 10, color: '#aaa' }}>hace 2 minutos</div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 14, paddingBottom: 12, borderBottom: '1px solid #f0f0f0' }}>
              <div style={{ width: 20, height: 20, borderRadius: 5, background: '#C8102E', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 800, color: '#fff' }}>O</div>
              <span style={{ fontSize: 12, fontWeight: 700 }}>Okapi Reviews — Fermata Kitchen</span>
              <div style={{ marginLeft: 'auto', width: 7, height: 7, borderRadius: '50%', background: '#22c55e' }} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 14 }}>
              {[{ l: 'Total', v: '124', c: '#111' }, { l: 'Promedio', v: '4.7★', c: '#f59e0b' }, { l: 'Positivas', v: '108', c: '#16a34a' }, { l: 'Privadas', v: '16', c: '#C8102E' }].map(s => (
                <div key={s.l} style={{ background: '#f8f8f8', borderRadius: 8, padding: '10px' }}>
                  <div style={{ fontSize: 18, fontWeight: 800, color: s.c }}>{s.v}</div>
                  <div style={{ fontSize: 9, color: '#999', marginTop: 2 }}>{s.l}</div>
                </div>
              ))}
            </div>
            <div style={{ background: '#f8f8f8', borderRadius: 8, padding: '12px', marginBottom: 10 }}>
              <div style={{ fontSize: 10, fontWeight: 700, marginBottom: 10 }}>Clicks por plataforma</div>
              {[{ l: 'Google', p: 72, c: '#4285F4' }, { l: 'TripAdvisor', p: 28, c: '#00AF87' }].map(p => (
                <div key={p.l} style={{ marginBottom: 7 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                    <span style={{ fontSize: 9, color: '#666' }}>{p.l}</span>
                    <span style={{ fontSize: 9, fontWeight: 700, color: p.c }}>{p.p}%</span>
                  </div>
                  <div style={{ height: 4, background: '#e5e7eb', borderRadius: 2 }}>
                    <div style={{ height: '100%', width: `${p.p}%`, background: p.c, borderRadius: 2 }} />
                  </div>
                </div>
              ))}
            </div>
            <div style={{ background: '#fef2f2', borderRadius: 8, padding: '10px 12px', border: '1px solid #fecaca', display: 'flex', gap: 10, alignItems: 'center' }}>
              <span style={{ fontSize: 14 }}>⚠️</span>
              <div>
                <div style={{ fontSize: 9, fontWeight: 700, color: '#C8102E', marginBottom: 3 }}>Nuevo feedback privado · hace 5 min</div>
                <div style={{ fontSize: 9, color: '#666' }}>"El tiempo de espera fue demasiado largo…"</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section style={{ background: '#f7f7f8', padding: '72px 32px', borderTop: '1px solid #ebebeb', borderBottom: '1px solid #ebebeb' }}>
        <div style={{ maxWidth: 880, margin: '0 auto' }}>
          <Reveal>
            <div style={{ textAlign: 'center', marginBottom: 48 }}>
              <h2 style={{ fontSize: 'clamp(24px, 3.5vw, 36px)', fontWeight: 800, color: '#111', letterSpacing: '-0.02em', marginBottom: 10 }}>Las reseñas son tu visibilidad en Google</h2>
              <p style={{ fontSize: 15, color: '#777', maxWidth: 440, margin: '0 auto' }}>Google usa las reseñas como señal directa de ranking local. No es opcional.</p>
            </div>
          </Reveal>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
            {[
              { stat: '64%', desc: 'de los clientes googlea el restaurante antes de visitarlo' },
              { stat: '91%', desc: 'evita restaurantes con menos de 4 estrellas' },
              { stat: '70%', desc: 'menos clicks si tu rating es menor a 4.0' },
              { stat: '126%', desc: 'más tráfico para negocios en el Top 3 de Google Maps' },
            ].map((s, i) => (
              <Reveal key={s.stat} delay={i * 80}>
                <div style={{ background: '#fff', border: '1px solid #ebebeb', borderRadius: 14, padding: '24px 18px', textAlign: 'center', transition: 'transform 0.2s, box-shadow 0.2s' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-4px)'; (e.currentTarget as HTMLDivElement).style.boxShadow = '0 8px 24px rgba(0,0,0,0.08)' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)'; (e.currentTarget as HTMLDivElement).style.boxShadow = 'none' }}>
                  <div style={{ fontSize: 40, fontWeight: 900, color: '#C8102E', lineHeight: 1, marginBottom: 10, letterSpacing: '-0.02em' }}>{s.stat}</div>
                  <div style={{ fontSize: 13, color: '#555', lineHeight: 1.55 }}>{s.desc}</div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="como-funciona" style={{ background: '#0f0f0f', padding: '88px 32px' }}>
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
          <Reveal>
            <div style={{ textAlign: 'center', marginBottom: 64 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#C8102E', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 12 }}>Cómo funciona</div>
              <h2 style={{ fontSize: 'clamp(26px, 3.5vw, 38px)', fontWeight: 800, color: '#fff', letterSpacing: '-0.02em' }}>Simple para el cliente. Poderoso para vos.</h2>
            </div>
          </Reveal>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 2 }}>
            {[
              { n: '01', icon: '📱', t: 'Accede al link', d: 'Escaneando el QR en la mesa, o recibiendo el link directo por correo o WhatsApp. Sin app, sin descarga.', color: '#4285F4' },
              { n: '02', icon: '⭐', t: 'Califica su visita', d: '4-5★ va a Google. 1-3★ el feedback queda privado para vos.', color: '#f59e0b' },
              { n: '03', icon: '🔔', t: 'Recibís la alerta', d: 'Email al instante con el detalle. WhatsApp si quiere hablar.', color: '#C8102E' },
              { n: '04', icon: '📈', t: 'Tu rating sube', d: 'Más reseñas 5★ publicadas. Menos críticas en internet.', color: '#22c55e' },
            ].map((s, i) => (
              <Reveal key={s.n} delay={i * 80}>
                <div style={{ padding: '36px 28px', borderLeft: i > 0 ? '1px solid #1e1e1e' : 'none', position: 'relative' }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: s.color, letterSpacing: '0.1em', marginBottom: 20 }}>{s.n}</div>
                  <div style={{ width: 48, height: 48, borderRadius: 14, background: '#1a1a1a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, marginBottom: 20, border: `1px solid #2a2a2a` }}>{s.icon}</div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#fff', marginBottom: 10 }}>{s.t}</div>
                  <div style={{ fontSize: 13, color: '#555', lineHeight: 1.7 }}>{s.d}</div>
                  <div style={{ position: 'absolute', bottom: 0, left: 28, right: 28, height: 2, background: s.color, borderRadius: 2, opacity: 0.4 }} />
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section style={{ background: '#f7f7f8', padding: '88px 32px', borderTop: '1px solid #ebebeb' }}>
        <div style={{ maxWidth: 880, margin: '0 auto' }}>
          <Reveal>
            <div style={{ textAlign: 'center', marginBottom: 52 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#C8102E', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 12 }}>Funcionalidades</div>
              <h2 style={{ fontSize: 'clamp(26px, 3.5vw, 38px)', fontWeight: 800, color: '#111', letterSpacing: '-0.02em' }}>Todo incluido desde el primer día</h2>
            </div>
          </Reveal>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 12 }}>
            {[
              { icon: '🔗', t: '6 plataformas integradas', d: 'Google, TripAdvisor, OpenTable, TheFork, Facebook y Yelp.' },
              { icon: '💬', t: 'WhatsApp directo', d: 'El manager recibe el mensaje del cliente listo para responder.' },
              { icon: '📧', t: 'Alertas por email', d: 'Notificación instantánea con categorías y texto del feedback.' },
              { icon: '📊', t: 'Dashboard con estadísticas', d: 'Rating, clicks por plataforma y historial de comentarios.' },
              { icon: '📲', t: 'QR en alta resolución', d: 'Listo para imprimir y poner en mesas, menú o entrada.' },
              { icon: '🏨', t: 'Multi-negocio', d: 'Restaurantes, hoteles y bares con categorías específicas.' },
            ].map((f, i) => (
              <Reveal key={f.t} delay={i * 60}>
                <div style={{ background: hoveredFeature === f.t ? '#fff' : '#fff', borderRadius: 12, padding: '20px', border: `1px solid ${hoveredFeature === f.t ? '#d1d5db' : '#ebebeb'}`, display: 'flex', gap: 14, cursor: 'default', transform: hoveredFeature === f.t ? 'translateY(-3px)' : 'none', boxShadow: hoveredFeature === f.t ? '0 6px 20px rgba(0,0,0,0.07)' : 'none', transition: 'all 0.2s ease' }}
                  onMouseEnter={() => setHoveredFeature(f.t)}
                  onMouseLeave={() => setHoveredFeature(null)}>
                  <span style={{ fontSize: 22, flexShrink: 0 }}>{f.icon}</span>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#111', marginBottom: 5 }}>{f.t}</div>
                    <div style={{ fontSize: 13, color: '#777', lineHeight: 1.6 }}>{f.d}</div>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" style={{ padding: '88px 32px' }}>
        <div style={{ maxWidth: 860, margin: '0 auto' }}>
          <Reveal>
            <div style={{ textAlign: 'center', marginBottom: 48 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#C8102E', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 12 }}>Precios</div>
              <h2 style={{ fontSize: 'clamp(26px, 3.5vw, 38px)', fontWeight: 800, color: '#111', letterSpacing: '-0.02em', marginBottom: 10 }}>Sin contratos. Sin sorpresas.</h2>
              <p style={{ fontSize: 14, color: '#888' }}>Birdeye cobra $299–$599/mes. Nosotros lo hacemos accesible.</p>
            </div>
          </Reveal>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
            {[
              { id: 'starter', label: 'Starter', price: '$29', sub: 'por local', dark: false, popular: false, cta: '14 días gratis', features: ['1 local', 'Hasta 200 scans/mes', 'Google + 1 plataforma', 'Email al manager', 'QR descargable'] },
              { id: 'pro', label: 'Pro', price: '$59', sub: 'por local', dark: true, popular: true, cta: '14 días gratis', features: ['1 local', 'Scans ilimitados', '6 plataformas', 'WhatsApp + Email', 'Dashboard completo', 'Categorías por negocio'] },
              { id: 'biz', label: 'Business', price: '$129', sub: 'hasta 5 locales', dark: false, popular: false, cta: 'Hablar con ventas', features: ['Hasta 5 locales', 'Scans ilimitados', '6 plataformas', 'WhatsApp + Email', 'Dashboard multi-local', 'Onboarding asistido', 'Soporte prioritario'] },
            ].map((plan, i) => (
              <Reveal key={plan.id} delay={i * 80}>
                <div style={{ background: plan.dark ? '#0f0f0f' : '#fff', borderRadius: 16, padding: '32px 24px', border: plan.popular ? '2px solid #C8102E' : '1px solid #e5e7eb', position: 'relative', height: '100%', boxSizing: 'border-box', transform: hoveredPlan === plan.id && !plan.popular ? 'translateY(-4px)' : 'none', boxShadow: hoveredPlan === plan.id ? '0 12px 32px rgba(0,0,0,0.1)' : 'none', transition: 'all 0.2s ease' }}
                  onMouseEnter={() => setHoveredPlan(plan.id)}
                  onMouseLeave={() => setHoveredPlan(null)}>
                  {plan.popular && <div style={{ position: 'absolute', top: -11, left: '50%', transform: 'translateX(-50%)', background: '#C8102E', color: '#fff', fontSize: 10, fontWeight: 700, padding: '3px 14px', borderRadius: 20, whiteSpace: 'nowrap', letterSpacing: '0.05em' }}>MÁS POPULAR</div>}
                  <div style={{ fontSize: 13, fontWeight: 600, color: plan.dark ? '#555' : '#888', marginBottom: 16 }}>{plan.label}</div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 4 }}>
                    <span style={{ fontSize: 40, fontWeight: 900, color: plan.dark ? '#fff' : '#111', letterSpacing: '-0.02em' }}>{plan.price}</span>
                    <span style={{ fontSize: 13, color: plan.dark ? '#555' : '#aaa' }}>/mes</span>
                  </div>
                  <div style={{ fontSize: 12, color: plan.dark ? '#444' : '#bbb', marginBottom: 24 }}>{plan.sub}</div>
                  <Link href="/login" style={{ display: 'block', padding: '11px 0', background: plan.popular ? '#C8102E' : plan.dark ? '#1e1e1e' : '#f4f4f5', color: plan.popular ? '#fff' : plan.dark ? '#fff' : '#111', borderRadius: 8, fontSize: 13, fontWeight: 600, textDecoration: 'none', textAlign: 'center', marginBottom: 24 }}
                    onMouseEnter={e => { e.currentTarget.style.opacity = '0.85' }}
                    onMouseLeave={e => { e.currentTarget.style.opacity = '1' }}>
                    {plan.cta}
                  </Link>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                    {plan.features.map(f => (
                      <div key={f} style={{ display: 'flex', gap: 8 }}>
                        <span style={{ color: plan.popular ? '#C8102E' : '#16a34a', fontSize: 13, flexShrink: 0 }}>✓</span>
                        <span style={{ fontSize: 13, color: plan.dark ? '#aaa' : '#555' }}>{f}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <FAQ />

      {/* CTA */}
      <section style={{ background: '#0f0f0f', padding: '88px 32px', textAlign: 'center' }}>
        <Reveal>
          <div style={{ maxWidth: 500, margin: '0 auto' }}>
            <h2 style={{ fontSize: 'clamp(28px, 4vw, 44px)', fontWeight: 900, color: '#fff', letterSpacing: '-0.03em', marginBottom: 14 }}>Empezá hoy. Gratis.</h2>
            <p style={{ fontSize: 15, color: '#555', lineHeight: 1.7, marginBottom: 36 }}>14 días de prueba. Sin tarjeta de crédito. Activo en 5 minutos.</p>
            <Link href="/login" style={{ padding: '14px 40px', background: '#C8102E', color: '#fff', borderRadius: 10, fontSize: 16, fontWeight: 700, textDecoration: 'none', display: 'inline-block', boxShadow: '0 4px 20px rgba(200,16,46,0.35)' }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 28px rgba(200,16,46,0.45)' }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 20px rgba(200,16,46,0.35)' }}>
              Crear cuenta gratis →
            </Link>
          </div>
        </Reveal>
      </section>

      {/* Footer */}
      <footer style={{ background: '#0a0a0a', borderTop: '1px solid #1a1a1a', padding: '28px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 22, height: 22, borderRadius: 5, background: '#C8102E', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800, color: '#fff' }}>O</div>
          <span style={{ fontWeight: 700, fontSize: 13, color: '#fff' }}>Okapi Reviews</span>
        </div>
        <p style={{ fontSize: 12, color: '#3a3a3a', margin: 0 }}>© 2026 Okapi Reviews</p>
        <div style={{ display: 'flex', gap: 20 }}>
          <a href="#pricing" style={{ fontSize: 12, color: '#444', textDecoration: 'none' }}>Precios</a>
          <Link href="/login" style={{ fontSize: 12, color: '#444', textDecoration: 'none' }}>Login</Link>
        </div>
      </footer>
    </div>
  )
}
