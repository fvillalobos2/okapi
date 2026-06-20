import Link from 'next/link'

export default function Home() {
  return (
    <div style={{ fontFamily: 'system-ui, -apple-system, sans-serif', color: '#111', background: '#fff', overflowX: 'hidden' }}>

      {/* Nav */}
      <nav style={{ position: 'sticky', top: 0, zIndex: 50, background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(12px)', borderBottom: '1px solid #f0f0f0', padding: '0 24px', height: 60, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 30, height: 30, borderRadius: 8, background: '#C8102E', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 800, color: '#fff' }}>O</div>
          <span style={{ fontWeight: 700, fontSize: 16 }}>Okapi Reviews</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <a href="#pricing" style={{ fontSize: 14, fontWeight: 500, color: '#555', textDecoration: 'none', padding: '6px 12px' }}>Precios</a>
          <Link href="/login" style={{ fontSize: 14, fontWeight: 500, color: '#555', textDecoration: 'none', padding: '6px 12px' }}>Entrar</Link>
          <Link href="/login" style={{ padding: '8px 18px', background: '#C8102E', color: '#fff', borderRadius: 8, fontSize: 14, fontWeight: 600, textDecoration: 'none' }}>Empezar gratis</Link>
        </div>
      </nav>

      {/* Hero */}
      <section style={{ background: 'linear-gradient(160deg, #0f0f0f 0%, #1e1e1e 50%, #0f0f0f 100%)', padding: '72px 24px 0', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: '0%', left: '50%', transform: 'translateX(-50%)', width: 700, height: 400, background: 'radial-gradient(ellipse, rgba(200,16,46,0.2) 0%, transparent 70%)', pointerEvents: 'none' }} />

        <div style={{ maxWidth: 1000, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', maxWidth: 700, margin: '0 auto' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 16px', background: 'rgba(200,16,46,0.15)', border: '1px solid rgba(200,16,46,0.35)', borderRadius: 20, fontSize: 13, fontWeight: 600, color: '#ff7070', marginBottom: 28 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#ff7070', display: 'inline-block' }} />
              Plataforma de gestión de reseñas para hospitalidad
            </div>

            <h1 style={{ fontSize: 'clamp(38px, 6vw, 64px)', fontWeight: 900, color: '#fff', lineHeight: 1.05, marginBottom: 24, letterSpacing: '-0.03em' }}>
              Protegé tu reputación.<br />
              <span style={{ WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundImage: 'linear-gradient(90deg, #C8102E, #ff4757)', backgroundClip: 'text' }}>
                Multiplicá tus reseñas.
              </span>
            </h1>

            <p style={{ fontSize: 18, color: 'rgba(255,255,255,0.6)', lineHeight: 1.75, marginBottom: 40, maxWidth: 520, margin: '0 auto 40px' }}>
              Tu cliente escanea un QR, califica su experiencia y vos controlás qué llega a Google. Los felices van a dejar reseña. Los insatisfechos te hablan a vos.
            </p>

            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 56 }}>
              <Link href="/login" style={{ padding: '14px 32px', background: '#C8102E', color: '#fff', borderRadius: 10, fontSize: 16, fontWeight: 700, textDecoration: 'none' }}>
                Empezar gratis →
              </Link>
              <a href="#como-funciona" style={{ padding: '14px 28px', background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.85)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, fontSize: 16, fontWeight: 500, textDecoration: 'none' }}>
                Ver demo
              </a>
            </div>
          </div>

          {/* Hero visual — mockup de la app */}
          <div style={{ position: 'relative', maxWidth: 780, margin: '0 auto', display: 'flex', gap: 16, alignItems: 'flex-end', justifyContent: 'center' }}>

            {/* Phone mockup — review page */}
            <div style={{ width: 200, background: '#1a1a1a', borderRadius: 32, padding: '12px 8px', border: '6px solid #2a2a2a', boxShadow: '0 40px 80px rgba(0,0,0,0.6)', flexShrink: 0 }}>
              <div style={{ background: 'linear-gradient(135deg, #1a1a1a, #2d2d2d)', borderRadius: 22, padding: '16px 12px', minHeight: 340 }}>
                <div style={{ textAlign: 'center', marginBottom: 12 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 8, background: '#C8102E', margin: '0 auto 6px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>🍽️</div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#fff' }}>Fermata Kitchen</div>
                </div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)', textAlign: 'center', marginBottom: 14 }}>¿Cómo calificarías tu visita?</div>
                <div style={{ display: 'flex', justifyContent: 'center', gap: 4, marginBottom: 16 }}>
                  {'★★★★★'.split('').map((s, i) => (
                    <span key={i} style={{ fontSize: 22, color: '#f59e0b' }}>{s}</span>
                  ))}
                </div>
                <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 8, padding: '10px', marginBottom: 8 }}>
                  <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)', marginBottom: 6 }}>¿Nos dejás una reseña?</div>
                  <div style={{ background: '#4285F4', borderRadius: 6, padding: '7px 10px', fontSize: 9, fontWeight: 700, color: '#fff', textAlign: 'center', marginBottom: 6 }}>G Dejar reseña en Google</div>
                  <div style={{ background: '#34E0A1', borderRadius: 6, padding: '7px 10px', fontSize: 9, fontWeight: 700, color: '#111', textAlign: 'center' }}>TA TripAdvisor</div>
                </div>
              </div>
            </div>

            {/* Dashboard mockup */}
            <div style={{ flex: 1, background: '#fff', borderRadius: 16, padding: 16, boxShadow: '0 40px 80px rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)', maxWidth: 420 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 14 }}>
                <div style={{ width: 20, height: 20, borderRadius: 5, background: '#C8102E', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 800, color: '#fff' }}>O</div>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#111' }}>Okapi Reviews</span>
                <div style={{ marginLeft: 'auto', width: 8, height: 8, borderRadius: '50%', background: '#22c55e' }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
                {[
                  { label: 'Total', value: '124', color: '#111' },
                  { label: 'Promedio', value: '4.7★', color: '#f59e0b' },
                  { label: 'Positivas', value: '108', color: '#16a34a' },
                  { label: 'Privadas', value: '16', color: '#C8102E' },
                ].map(s => (
                  <div key={s.label} style={{ background: '#f7f7f8', borderRadius: 8, padding: '10px 12px' }}>
                    <div style={{ fontSize: 16, fontWeight: 800, color: s.color }}>{s.value}</div>
                    <div style={{ fontSize: 9, color: '#888', marginTop: 2 }}>{s.label}</div>
                  </div>
                ))}
              </div>
              <div style={{ background: '#f7f7f8', borderRadius: 8, padding: 10, marginBottom: 10 }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: '#111', marginBottom: 8 }}>Clicks por plataforma</div>
                {[{ label: 'Google', pct: 72, color: '#4285F4' }, { label: 'TripAdvisor', pct: 28, color: '#34E0A1' }].map(p => (
                  <div key={p.label} style={{ marginBottom: 6 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                      <span style={{ fontSize: 8, color: '#555' }}>{p.label}</span>
                      <span style={{ fontSize: 8, fontWeight: 700, color: p.color }}>{p.pct}%</span>
                    </div>
                    <div style={{ height: 4, background: '#e5e7eb', borderRadius: 2 }}>
                      <div style={{ height: '100%', width: `${p.pct}%`, background: p.color, borderRadius: 2 }} />
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ background: '#fef2f2', borderRadius: 8, padding: 10, border: '1px solid #fecaca' }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: '#C8102E', marginBottom: 4 }}>⚠ Nuevo feedback privado</div>
                <div style={{ fontSize: 8, color: '#666' }}>"El tiempo de espera fue demasiado largo…"</div>
                <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
                  <span style={{ fontSize: 7, padding: '2px 6px', background: '#fee2e2', color: '#C8102E', borderRadius: 3, fontWeight: 600 }}>Tiempo de espera</span>
                  <span style={{ fontSize: 7, padding: '2px 6px', background: '#fee2e2', color: '#C8102E', borderRadius: 3, fontWeight: 600 }}>Servicio</span>
                </div>
              </div>
            </div>

            {/* Notification float */}
            <div style={{ position: 'absolute', top: -24, right: -10, background: '#fff', borderRadius: 12, padding: '10px 14px', boxShadow: '0 8px 32px rgba(0,0,0,0.2)', display: 'flex', alignItems: 'center', gap: 8, minWidth: 180 }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#22c55e', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0 }}>★</div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#111' }}>Nueva reseña 5★ en Google</div>
                <div style={{ fontSize: 10, color: '#888' }}>hace 2 minutos</div>
              </div>
            </div>

            <div style={{ position: 'absolute', bottom: 20, left: -20, background: '#fff', borderRadius: 12, padding: '10px 14px', boxShadow: '0 8px 32px rgba(0,0,0,0.2)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 20 }}>💬</span>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#111' }}>Cliente quiere hablar</div>
                <div style={{ fontSize: 10, color: '#888' }}>WhatsApp · ahora</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Trust bar */}
      <section style={{ background: '#f7f7f8', padding: '24px', borderBottom: '1px solid #ebebeb' }}>
        <div style={{ maxWidth: 800, margin: '0 auto', display: 'flex', justifyContent: 'center', gap: 40, flexWrap: 'wrap', alignItems: 'center' }}>
          {[
            { icon: '⭐', text: 'Google · TripAdvisor · OpenTable · Yelp · TheFork · Facebook' },
            { icon: '⚡', text: 'Activo en menos de 5 minutos' },
            { icon: '📲', text: 'Sin apps — funciona en cualquier celular' },
          ].map(s => (
            <div key={s.text} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 16 }}>{s.icon}</span>
              <span style={{ fontSize: 13, color: '#555', fontWeight: 500 }}>{s.text}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Problem / Solution */}
      <section style={{ padding: '88px 24px', maxWidth: 1000, margin: '0 auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 32, alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#C8102E', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 12 }}>El problema</div>
            <h2 style={{ fontSize: 'clamp(26px, 3.5vw, 38px)', fontWeight: 800, color: '#111', letterSpacing: '-0.02em', lineHeight: 1.2, marginBottom: 20 }}>Una mala reseña le cuesta a tu negocio más de lo que creés</h2>
            <p style={{ fontSize: 15, color: '#555', lineHeight: 1.75, marginBottom: 24 }}>El 93% de los consumidores leen reseñas online antes de ir a un restaurante. Una sola reseña negativa en Google puede bajar tu promedio y hacerte perder decenas de clientes por mes.</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[
                'Clientes insatisfechos van directo a Google',
                'Los contentos raramente dejan reseñas sin que se los pidas',
                'No podés controlar lo que se publica antes de que ya sea tarde',
              ].map(t => (
                <div key={t} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <span style={{ color: '#C8102E', fontSize: 16, marginTop: 1, flexShrink: 0 }}>✕</span>
                  <span style={{ fontSize: 14, color: '#555', lineHeight: 1.5 }}>{t}</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#16a34a', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 12 }}>La solución</div>
            <h2 style={{ fontSize: 'clamp(26px, 3.5vw, 38px)', fontWeight: 800, color: '#111', letterSpacing: '-0.02em', lineHeight: 1.2, marginBottom: 20 }}>Okapi captura el feedback antes de que llegue a internet</h2>
            <p style={{ fontSize: 15, color: '#555', lineHeight: 1.75, marginBottom: 24 }}>Con un simple QR en la mesa interceptás la opinión del cliente antes de que vaya a publicarla. Los que están felices van directo a Google. Los que no, te hablan a vos.</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[
                'Redirigís clientes satisfechos a dejar reseña pública',
                'Capturás el feedback negativo en privado para resolverlo',
                'Recibís alertas inmediatas por email y WhatsApp',
              ].map(t => (
                <div key={t} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <span style={{ color: '#16a34a', fontSize: 16, marginTop: 1, flexShrink: 0 }}>✓</span>
                  <span style={{ fontSize: 14, color: '#555', lineHeight: 1.5 }}>{t}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="como-funciona" style={{ background: '#f7f7f8', padding: '88px 24px' }}>
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 56 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#C8102E', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 12 }}>Cómo funciona</div>
            <h2 style={{ fontSize: 'clamp(28px, 4vw, 42px)', fontWeight: 800, color: '#111', letterSpacing: '-0.02em' }}>Simple para el cliente. Poderoso para vos.</h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 2 }}>
            {[
              { step: '1', icon: '📱', title: 'Cliente escanea el QR', desc: 'En la mesa, el menú o la salida. Sin app, sin registro. Solo la cámara del celular.', color: '#4285F4' },
              { step: '2', icon: '⭐', title: 'Califica su experiencia', desc: '4-5 estrellas → lo llevamos a Google, TripAdvisor u otras. 1-3 estrellas → formulario privado para vos.', color: '#f59e0b' },
              { step: '3', icon: '🔔', title: 'Vos recibís la alerta', desc: 'Email instantáneo con el detalle. Si quiere hablar, abre WhatsApp con el mensaje listo.', color: '#C8102E' },
              { step: '4', icon: '📈', title: 'Tu rating sube', desc: 'Más reseñas positivas, menos negativas públicas. Tu promedio en Google mejora semana a semana.', color: '#16a34a' },
            ].map((s, i) => (
              <div key={s.step} style={{ background: '#fff', padding: '28px 24px', borderRadius: 0, borderRight: i < 3 ? '1px solid #ebebeb' : 'none', position: 'relative' }}>
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: s.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, color: '#fff', marginBottom: 16 }}>{s.step}</div>
                <div style={{ fontSize: 28, marginBottom: 12 }}>{s.icon}</div>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: '#111', marginBottom: 10 }}>{s.title}</h3>
                <p style={{ fontSize: 13, color: '#666', lineHeight: 1.65 }}>{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features grid */}
      <section style={{ padding: '88px 24px', maxWidth: 960, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 56 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#C8102E', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 12 }}>Funcionalidades</div>
          <h2 style={{ fontSize: 'clamp(28px, 4vw, 42px)', fontWeight: 800, color: '#111', letterSpacing: '-0.02em' }}>Todo lo que necesitás incluido</h2>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 1, border: '1px solid #ebebeb', borderRadius: 16, overflow: 'hidden' }}>
          {[
            { icon: '🔗', title: '6 plataformas', desc: 'Google, TripAdvisor, OpenTable, TheFork, Facebook y Yelp.' },
            { icon: '💬', title: 'WhatsApp directo', desc: 'Manager recibe el mensaje del cliente listo para responder.' },
            { icon: '📧', title: 'Email instantáneo', desc: 'Alerta al manager con todos los detalles del feedback.' },
            { icon: '📊', title: 'Dashboard con stats', desc: 'Rating promedio, clicks por plataforma, comentarios recientes.' },
            { icon: '📲', title: 'QR descargable', desc: 'Código listo para imprimir en alta resolución.' },
            { icon: '🏨', title: 'Multi-negocio', desc: 'Restaurantes, hoteles, bares y cafés con categorías específicas.' },
          ].map((f, i) => (
            <div key={f.title} style={{ background: '#fff', padding: '28px 24px', borderRight: (i % 3 !== 2) ? '1px solid #ebebeb' : 'none', borderBottom: i < 3 ? '1px solid #ebebeb' : 'none' }}>
              <div style={{ fontSize: 30, marginBottom: 14 }}>{f.icon}</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#111', marginBottom: 8 }}>{f.title}</div>
              <div style={{ fontSize: 13, color: '#777', lineHeight: 1.6 }}>{f.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" style={{ background: '#f7f7f8', padding: '88px 24px' }}>
        <div style={{ maxWidth: 860, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#C8102E', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 12 }}>Precios</div>
            <h2 style={{ fontSize: 'clamp(28px, 4vw, 42px)', fontWeight: 800, color: '#111', letterSpacing: '-0.02em', marginBottom: 12 }}>Sin sorpresas. Sin contratos.</h2>
            <p style={{ fontSize: 15, color: '#666', maxWidth: 440, margin: '0 auto' }}>Competidores como Birdeye cobran $299–$599/mes. Nosotros lo hacemos simple y accesible.</p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 20, marginTop: 48 }}>

            {/* Starter */}
            <div style={{ background: '#fff', borderRadius: 16, padding: '32px 28px', border: '1px solid #ebebeb' }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#555', marginBottom: 8 }}>Starter</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 6 }}>
                <span style={{ fontSize: 42, fontWeight: 900, color: '#111' }}>$29</span>
                <span style={{ fontSize: 14, color: '#888' }}>/mes</span>
              </div>
              <div style={{ fontSize: 12, color: '#aaa', marginBottom: 24 }}>por local · facturado mensualmente</div>
              <Link href="/login" style={{ display: 'block', padding: '12px 0', background: '#111', color: '#fff', borderRadius: 10, fontSize: 14, fontWeight: 600, textDecoration: 'none', textAlign: 'center', marginBottom: 28 }}>
                Empezar gratis 14 días
              </Link>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {['1 local', 'Hasta 200 scans/mes', 'Google + 1 plataforma', 'Email al manager', 'QR descargable', 'Dashboard básico'].map(f => (
                  <div key={f} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span style={{ color: '#16a34a', fontSize: 14 }}>✓</span>
                    <span style={{ fontSize: 13, color: '#444' }}>{f}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Pro — destacado */}
            <div style={{ background: '#111', borderRadius: 16, padding: '32px 28px', border: '2px solid #C8102E', position: 'relative' }}>
              <div style={{ position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)', background: '#C8102E', color: '#fff', fontSize: 11, fontWeight: 700, padding: '4px 16px', borderRadius: 20, whiteSpace: 'nowrap' }}>MÁS POPULAR</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'rgba(255,255,255,0.6)', marginBottom: 8 }}>Pro</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 6 }}>
                <span style={{ fontSize: 42, fontWeight: 900, color: '#fff' }}>$59</span>
                <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.4)' }}>/mes</span>
              </div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', marginBottom: 24 }}>por local · facturado mensualmente</div>
              <Link href="/login" style={{ display: 'block', padding: '12px 0', background: '#C8102E', color: '#fff', borderRadius: 10, fontSize: 14, fontWeight: 700, textDecoration: 'none', textAlign: 'center', marginBottom: 28 }}>
                Empezar gratis 14 días
              </Link>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {['1 local', 'Scans ilimitados', 'Todas las plataformas (6)', 'WhatsApp al manager', 'Email al manager', 'Dashboard completo', 'Categorías por tipo de negocio'].map(f => (
                  <div key={f} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span style={{ color: '#C8102E', fontSize: 14 }}>✓</span>
                    <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)' }}>{f}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Business */}
            <div style={{ background: '#fff', borderRadius: 16, padding: '32px 28px', border: '1px solid #ebebeb' }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#555', marginBottom: 8 }}>Business</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 6 }}>
                <span style={{ fontSize: 42, fontWeight: 900, color: '#111' }}>$129</span>
                <span style={{ fontSize: 14, color: '#888' }}>/mes</span>
              </div>
              <div style={{ fontSize: 12, color: '#aaa', marginBottom: 24 }}>hasta 5 locales · facturado mensualmente</div>
              <Link href="/login" style={{ display: 'block', padding: '12px 0', background: '#111', color: '#fff', borderRadius: 10, fontSize: 14, fontWeight: 600, textDecoration: 'none', textAlign: 'center', marginBottom: 28 }}>
                Hablar con ventas
              </Link>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {['Hasta 5 locales', 'Scans ilimitados', 'Todas las plataformas', 'WhatsApp + Email', 'Dashboard multi-local', 'Soporte prioritario', 'Onboarding asistido'].map(f => (
                  <div key={f} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span style={{ color: '#16a34a', fontSize: 14 }}>✓</span>
                    <span style={{ fontSize: 13, color: '#444' }}>{f}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Competitor comparison */}
          <div style={{ marginTop: 32, background: '#fff', borderRadius: 12, padding: '16px 20px', border: '1px solid #ebebeb', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', justifyContent: 'center' }}>
            <span style={{ fontSize: 13, color: '#888' }}>vs. la competencia:</span>
            <span style={{ fontSize: 13, color: '#555' }}>Birdeye <strong style={{ color: '#111' }}>$299–$449/mes</strong></span>
            <span style={{ fontSize: 13, color: '#555' }}>Podium <strong style={{ color: '#111' }}>$299+/mes</strong></span>
            <span style={{ fontSize: 13, color: '#555' }}>Grade.us <strong style={{ color: '#111' }}>$60/local/mes</strong></span>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#16a34a' }}>Okapi: desde $29/mes ✓</span>
          </div>
        </div>
      </section>

      {/* For who */}
      <section style={{ padding: '88px 24px', maxWidth: 860, margin: '0 auto', textAlign: 'center' }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#C8102E', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 12 }}>Ideal para</div>
        <h2 style={{ fontSize: 'clamp(28px, 4vw, 42px)', fontWeight: 800, color: '#111', letterSpacing: '-0.02em', marginBottom: 48 }}>Negocios de hospitalidad de todos los tamaños</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16 }}>
          {[
            { icon: '🍽️', label: 'Restaurantes', desc: 'Fine dining, casual, comida rápida' },
            { icon: '🏨', label: 'Hoteles', desc: 'Boutique, cadenas, hostels' },
            { icon: '🍹', label: 'Bares y Cafés', desc: 'Bares, cafeterías, lounges' },
          ].map(b => (
            <div key={b.label} style={{ padding: '28px 20px', background: '#fff', border: '1px solid #ebebeb', borderRadius: 16, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 40 }}>{b.icon}</span>
              <span style={{ fontSize: 16, fontWeight: 700, color: '#111' }}>{b.label}</span>
              <span style={{ fontSize: 13, color: '#888' }}>{b.desc}</span>
            </div>
          ))}
        </div>
      </section>

      {/* CTA final */}
      <section style={{ background: 'linear-gradient(135deg, #0f0f0f 0%, #1e1e1e 100%)', padding: '88px 24px', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 500, height: 300, background: 'radial-gradient(ellipse, rgba(200,16,46,0.2) 0%, transparent 70%)', pointerEvents: 'none' }} />
        <div style={{ maxWidth: 560, margin: '0 auto', position: 'relative' }}>
          <h2 style={{ fontSize: 'clamp(30px, 4vw, 48px)', fontWeight: 900, color: '#fff', letterSpacing: '-0.02em', marginBottom: 16 }}>
            Empezá a proteger tu reputación hoy.
          </h2>
          <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.55)', lineHeight: 1.7, marginBottom: 36 }}>
            14 días gratis. Sin tarjeta de crédito. Activo en 5 minutos.
          </p>
          <Link href="/login" style={{ padding: '16px 44px', background: '#C8102E', color: '#fff', borderRadius: 12, fontSize: 17, fontWeight: 700, textDecoration: 'none', display: 'inline-block' }}>
            Crear cuenta gratis →
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ background: '#0a0a0a', padding: '32px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 24, height: 24, borderRadius: 6, background: '#C8102E', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, color: '#fff' }}>O</div>
          <span style={{ fontWeight: 700, fontSize: 14, color: '#fff' }}>Okapi Reviews</span>
        </div>
        <p style={{ fontSize: 12, color: '#444', margin: 0 }}>© 2026 Okapi Reviews · Todos los derechos reservados</p>
        <div style={{ display: 'flex', gap: 20 }}>
          <a href="#pricing" style={{ fontSize: 12, color: '#555', textDecoration: 'none' }}>Precios</a>
          <Link href="/login" style={{ fontSize: 12, color: '#555', textDecoration: 'none' }}>Entrar</Link>
        </div>
      </footer>

    </div>
  )
}
