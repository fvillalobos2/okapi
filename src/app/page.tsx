import Link from 'next/link'

export default function Home() {
  return (
    <div style={{ fontFamily: 'system-ui, -apple-system, sans-serif', color: '#111', background: '#fff', overflowX: 'hidden' }}>

      {/* Nav */}
      <nav style={{ position: 'sticky', top: 0, zIndex: 50, background: 'rgba(255,255,255,0.96)', backdropFilter: 'blur(12px)', borderBottom: '1px solid #f0f0f0', padding: '0 32px', height: 60, display: 'flex', alignItems: 'center', justifyContent: 'space-between', maxWidth: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 28, height: 28, borderRadius: 7, background: '#C8102E', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, color: '#fff' }}>O</div>
          <span style={{ fontWeight: 700, fontSize: 15 }}>Okapi Reviews</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <a href="#pricing" style={{ fontSize: 14, fontWeight: 500, color: '#666', textDecoration: 'none', padding: '6px 14px' }}>Precios</a>
          <Link href="/login" style={{ fontSize: 14, fontWeight: 500, color: '#666', textDecoration: 'none', padding: '6px 14px' }}>Entrar</Link>
          <Link href="/login" style={{ padding: '8px 18px', background: '#C8102E', color: '#fff', borderRadius: 8, fontSize: 14, fontWeight: 600, textDecoration: 'none' }}>Empezar gratis</Link>
        </div>
      </nav>

      {/* Hero */}
      <section style={{ background: '#0f0f0f', padding: '96px 32px 80px', textAlign: 'center' }}>
        <div style={{ maxWidth: 640, margin: '0 auto' }}>
          <div style={{ display: 'inline-block', padding: '5px 14px', background: '#1e1e1e', border: '1px solid #333', borderRadius: 20, fontSize: 12, fontWeight: 600, color: '#888', marginBottom: 32, letterSpacing: '0.04em' }}>
            GESTIÓN DE RESEÑAS PARA HOSPITALIDAD
          </div>
          <h1 style={{ fontSize: 'clamp(40px, 6vw, 68px)', fontWeight: 900, color: '#fff', lineHeight: 1.08, marginBottom: 22, letterSpacing: '-0.03em' }}>
            Más reseñas positivas.<br />Menos críticas públicas.
          </h1>
          <p style={{ fontSize: 17, color: '#777', lineHeight: 1.75, marginBottom: 40, maxWidth: 480, margin: '0 auto 40px' }}>
            Tu cliente escanea un QR, califica su experiencia y vos decidís qué llega a Google. Los contentos van a publicar. Los insatisfechos te hablan a vos.
          </p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/login" style={{ padding: '13px 30px', background: '#C8102E', color: '#fff', borderRadius: 10, fontSize: 15, fontWeight: 700, textDecoration: 'none' }}>
              Empezar gratis →
            </Link>
            <a href="#como-funciona" style={{ padding: '13px 24px', background: 'transparent', color: '#888', border: '1px solid #333', borderRadius: 10, fontSize: 15, fontWeight: 500, textDecoration: 'none' }}>
              Cómo funciona
            </a>
          </div>
        </div>

        {/* App mockup */}
        <div style={{ maxWidth: 860, margin: '64px auto 0', display: 'grid', gridTemplateColumns: '1fr 1.8fr', gap: 16, alignItems: 'end' }}>

          {/* Phone */}
          <div style={{ background: '#1a1a1a', borderRadius: 28, padding: '14px 10px', border: '5px solid #222', boxShadow: '0 32px 64px rgba(0,0,0,0.5)', maxWidth: 200, margin: '0 auto', width: '100%' }}>
            <div style={{ background: '#0f0f0f', borderRadius: 20, padding: '18px 14px' }}>
              <div style={{ textAlign: 'center', marginBottom: 14 }}>
                <div style={{ width: 38, height: 38, borderRadius: 10, background: '#C8102E', margin: '0 auto 8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>🍽️</div>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#fff' }}>Fermata Kitchen</div>
                <div style={{ fontSize: 9, color: '#555', marginTop: 3 }}>¿Cómo calificarías tu visita?</div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'center', gap: 3, marginBottom: 16 }}>
                {'★★★★★'.split('').map((s, i) => <span key={i} style={{ fontSize: 20, color: '#f59e0b' }}>{s}</span>)}
              </div>
              <div style={{ fontSize: 9, color: '#555', textAlign: 'center', marginBottom: 10 }}>¿Nos dejás una reseña?</div>
              <div style={{ background: '#4285F4', borderRadius: 7, padding: '8px', fontSize: 9, fontWeight: 700, color: '#fff', textAlign: 'center', marginBottom: 6 }}>G  Dejar reseña en Google</div>
              <div style={{ background: '#1db954', borderRadius: 7, padding: '8px', fontSize: 9, fontWeight: 700, color: '#fff', textAlign: 'center' }}>TA  TripAdvisor</div>
            </div>
          </div>

          {/* Dashboard */}
          <div style={{ background: '#fff', borderRadius: 14, padding: '18px', boxShadow: '0 32px 64px rgba(0,0,0,0.4)', textAlign: 'left' }}>
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
          <div style={{ textAlign: 'center', marginBottom: 48 }}>
            <h2 style={{ fontSize: 'clamp(24px, 3.5vw, 36px)', fontWeight: 800, color: '#111', letterSpacing: '-0.02em', marginBottom: 10 }}>Las reseñas son tu visibilidad en Google</h2>
            <p style={{ fontSize: 15, color: '#777', maxWidth: 440, margin: '0 auto' }}>Google usa las reseñas como señal directa de ranking local. No es opcional.</p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
            {[
              { stat: '64%', desc: 'de los clientes googlea el restaurante antes de visitarlo' },
              { stat: '91%', desc: 'evita restaurantes con menos de 4 estrellas' },
              { stat: '70%', desc: 'menos clicks si tu rating es menor a 4.0' },
              { stat: '126%', desc: 'más tráfico para negocios en el Top 3 de Google Maps' },
            ].map(s => (
              <div key={s.stat} style={{ background: '#fff', border: '1px solid #ebebeb', borderRadius: 14, padding: '24px 18px', textAlign: 'center' }}>
                <div style={{ fontSize: 40, fontWeight: 900, color: '#C8102E', lineHeight: 1, marginBottom: 10, letterSpacing: '-0.02em' }}>{s.stat}</div>
                <div style={{ fontSize: 13, color: '#555', lineHeight: 1.55 }}>{s.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="como-funciona" style={{ padding: '88px 32px', maxWidth: 880, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 56 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#C8102E', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 12 }}>Cómo funciona</div>
          <h2 style={{ fontSize: 'clamp(26px, 3.5vw, 38px)', fontWeight: 800, color: '#111', letterSpacing: '-0.02em' }}>Simple para el cliente. Poderoso para vos.</h2>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 24 }}>
          {[
            { n: '1', icon: '📱', t: 'Escanea el QR', d: 'En la mesa, el menú o la salida. Sin app, sin registro.' },
            { n: '2', icon: '⭐', t: 'Califica su visita', d: '4-5★ lo llevamos a Google. 1-3★ capturamos el feedback en privado.' },
            { n: '3', icon: '🔔', t: 'Vos recibís la alerta', d: 'Email instantáneo con el detalle. WhatsApp si quiere contacto directo.' },
            { n: '4', icon: '📈', t: 'Tu rating sube', d: 'Más reseñas positivas publicadas. Menos críticas en internet.' },
          ].map(s => (
            <div key={s.n} style={{ padding: '28px 0' }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, color: '#555', marginBottom: 16 }}>{s.n}</div>
              <div style={{ fontSize: 26, marginBottom: 12 }}>{s.icon}</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#111', marginBottom: 8 }}>{s.t}</div>
              <div style={{ fontSize: 13, color: '#777', lineHeight: 1.65 }}>{s.d}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section style={{ background: '#f7f7f8', padding: '88px 32px', borderTop: '1px solid #ebebeb' }}>
        <div style={{ maxWidth: 880, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 52 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#C8102E', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 12 }}>Funcionalidades</div>
            <h2 style={{ fontSize: 'clamp(26px, 3.5vw, 38px)', fontWeight: 800, color: '#111', letterSpacing: '-0.02em' }}>Todo incluido desde el primer día</h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 16 }}>
            {[
              { icon: '🔗', t: '6 plataformas integradas', d: 'Google, TripAdvisor, OpenTable, TheFork, Facebook y Yelp.' },
              { icon: '💬', t: 'WhatsApp directo', d: 'El manager recibe el mensaje del cliente listo para responder.' },
              { icon: '📧', t: 'Alertas por email', d: 'Notificación instantánea con categorías y texto del feedback.' },
              { icon: '📊', t: 'Dashboard con estadísticas', d: 'Rating, clicks por plataforma y historial de comentarios.' },
              { icon: '📲', t: 'QR en alta resolución', d: 'Listo para imprimir y poner en mesas, menú o entrada.' },
              { icon: '🏨', t: 'Restaurantes, hoteles y bares', d: 'Categorías de feedback adaptadas al tipo de negocio.' },
            ].map(f => (
              <div key={f.t} style={{ background: '#fff', borderRadius: 12, padding: '22px 20px', border: '1px solid #ebebeb', display: 'flex', gap: 14 }}>
                <span style={{ fontSize: 24, flexShrink: 0 }}>{f.icon}</span>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#111', marginBottom: 6 }}>{f.t}</div>
                  <div style={{ fontSize: 13, color: '#777', lineHeight: 1.6 }}>{f.d}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" style={{ padding: '88px 32px' }}>
        <div style={{ maxWidth: 860, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 48 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#C8102E', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 12 }}>Precios</div>
            <h2 style={{ fontSize: 'clamp(26px, 3.5vw, 38px)', fontWeight: 800, color: '#111', letterSpacing: '-0.02em', marginBottom: 10 }}>Sin contratos. Sin sorpresas.</h2>
            <p style={{ fontSize: 14, color: '#888' }}>Birdeye cobra $299–$599/mes. Nosotros lo hacemos accesible.</p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
            {/* Starter */}
            <div style={{ background: '#fff', borderRadius: 16, padding: '32px 24px', border: '1px solid #e5e7eb' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#888', marginBottom: 16 }}>Starter</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 4 }}>
                <span style={{ fontSize: 40, fontWeight: 900, color: '#111', letterSpacing: '-0.02em' }}>$29</span>
                <span style={{ fontSize: 13, color: '#aaa' }}>/mes</span>
              </div>
              <div style={{ fontSize: 12, color: '#bbb', marginBottom: 24 }}>por local</div>
              <Link href="/login" style={{ display: 'block', padding: '11px 0', background: '#f4f4f5', color: '#111', borderRadius: 8, fontSize: 13, fontWeight: 600, textDecoration: 'none', textAlign: 'center', marginBottom: 24 }}>
                14 días gratis
              </Link>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                {['1 local', 'Hasta 200 scans/mes', 'Google + 1 plataforma', 'Email al manager', 'QR descargable'].map(f => (
                  <div key={f} style={{ display: 'flex', gap: 8 }}>
                    <span style={{ color: '#16a34a', fontSize: 13, flexShrink: 0 }}>✓</span>
                    <span style={{ fontSize: 13, color: '#555' }}>{f}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Pro */}
            <div style={{ background: '#0f0f0f', borderRadius: 16, padding: '32px 24px', border: '2px solid #C8102E', position: 'relative' }}>
              <div style={{ position: 'absolute', top: -11, left: '50%', transform: 'translateX(-50%)', background: '#C8102E', color: '#fff', fontSize: 10, fontWeight: 700, padding: '3px 14px', borderRadius: 20, whiteSpace: 'nowrap', letterSpacing: '0.05em' }}>MÁS POPULAR</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#555', marginBottom: 16 }}>Pro</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 4 }}>
                <span style={{ fontSize: 40, fontWeight: 900, color: '#fff', letterSpacing: '-0.02em' }}>$59</span>
                <span style={{ fontSize: 13, color: '#555' }}>/mes</span>
              </div>
              <div style={{ fontSize: 12, color: '#444', marginBottom: 24 }}>por local</div>
              <Link href="/login" style={{ display: 'block', padding: '11px 0', background: '#C8102E', color: '#fff', borderRadius: 8, fontSize: 13, fontWeight: 700, textDecoration: 'none', textAlign: 'center', marginBottom: 24 }}>
                14 días gratis
              </Link>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                {['1 local', 'Scans ilimitados', '6 plataformas', 'WhatsApp + Email', 'Dashboard completo', 'Categorías por negocio'].map(f => (
                  <div key={f} style={{ display: 'flex', gap: 8 }}>
                    <span style={{ color: '#C8102E', fontSize: 13, flexShrink: 0 }}>✓</span>
                    <span style={{ fontSize: 13, color: '#aaa' }}>{f}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Business */}
            <div style={{ background: '#fff', borderRadius: 16, padding: '32px 24px', border: '1px solid #e5e7eb' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#888', marginBottom: 16 }}>Business</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 4 }}>
                <span style={{ fontSize: 40, fontWeight: 900, color: '#111', letterSpacing: '-0.02em' }}>$129</span>
                <span style={{ fontSize: 13, color: '#aaa' }}>/mes</span>
              </div>
              <div style={{ fontSize: 12, color: '#bbb', marginBottom: 24 }}>hasta 5 locales</div>
              <Link href="/login" style={{ display: 'block', padding: '11px 0', background: '#f4f4f5', color: '#111', borderRadius: 8, fontSize: 13, fontWeight: 600, textDecoration: 'none', textAlign: 'center', marginBottom: 24 }}>
                Hablar con ventas
              </Link>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                {['Hasta 5 locales', 'Scans ilimitados', '6 plataformas', 'WhatsApp + Email', 'Dashboard multi-local', 'Onboarding asistido', 'Soporte prioritario'].map(f => (
                  <div key={f} style={{ display: 'flex', gap: 8 }}>
                    <span style={{ color: '#16a34a', fontSize: 13, flexShrink: 0 }}>✓</span>
                    <span style={{ fontSize: 13, color: '#555' }}>{f}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section style={{ background: '#0f0f0f', padding: '88px 32px', textAlign: 'center' }}>
        <div style={{ maxWidth: 500, margin: '0 auto' }}>
          <h2 style={{ fontSize: 'clamp(28px, 4vw, 44px)', fontWeight: 900, color: '#fff', letterSpacing: '-0.03em', marginBottom: 14 }}>
            Empezá hoy. Gratis.
          </h2>
          <p style={{ fontSize: 15, color: '#555', lineHeight: 1.7, marginBottom: 36 }}>
            14 días de prueba. Sin tarjeta de crédito. Activo en 5 minutos.
          </p>
          <Link href="/login" style={{ padding: '14px 40px', background: '#C8102E', color: '#fff', borderRadius: 10, fontSize: 16, fontWeight: 700, textDecoration: 'none', display: 'inline-block' }}>
            Crear cuenta gratis →
          </Link>
        </div>
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
          <Link href="/login" style={{ fontSize: 12, color: '#444', textDecoration: 'none' }}>Entrar</Link>
        </div>
      </footer>

    </div>
  )
}
