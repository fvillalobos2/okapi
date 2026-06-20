import Link from 'next/link'

export default function Home() {
  return (
    <div style={{ fontFamily: 'system-ui, -apple-system, sans-serif', color: '#111', background: '#fff' }}>

      {/* Nav */}
      <nav style={{ position: 'sticky', top: 0, zIndex: 50, background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(12px)', borderBottom: '1px solid #f0f0f0', padding: '0 24px', height: 60, display: 'flex', alignItems: 'center', justifyContent: 'space-between', maxWidth: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 30, height: 30, borderRadius: 8, background: '#C8102E', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 800, color: '#fff' }}>O</div>
          <span style={{ fontWeight: 700, fontSize: 16, color: '#111' }}>Okapi Reviews</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Link href="/login" style={{ fontSize: 14, fontWeight: 500, color: '#555', textDecoration: 'none' }}>Entrar</Link>
          <Link href="/login" style={{ padding: '8px 18px', background: '#C8102E', color: '#fff', borderRadius: 8, fontSize: 14, fontWeight: 600, textDecoration: 'none' }}>Empezar gratis</Link>
        </div>
      </nav>

      {/* Hero */}
      <section style={{ background: 'linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 60%, #1a1a1a 100%)', padding: '80px 24px 100px', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: '10%', left: '15%', width: 300, height: 300, borderRadius: '50%', background: 'rgba(200,16,46,0.12)', filter: 'blur(60px)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: '5%', right: '10%', width: 200, height: 200, borderRadius: '50%', background: 'rgba(200,16,46,0.08)', filter: 'blur(40px)', pointerEvents: 'none' }} />
        <div style={{ maxWidth: 680, margin: '0 auto', position: 'relative' }}>
          <div style={{ display: 'inline-block', padding: '6px 16px', background: 'rgba(200,16,46,0.2)', border: '1px solid rgba(200,16,46,0.4)', borderRadius: 20, fontSize: 13, fontWeight: 600, color: '#ff6b6b', marginBottom: 24 }}>
            Nuevo · Plataforma de gestión de reseñas
          </div>
          <h1 style={{ fontSize: 'clamp(36px, 6vw, 60px)', fontWeight: 800, color: '#fff', lineHeight: 1.1, marginBottom: 20, letterSpacing: '-0.02em' }}>
            Más reseñas positivas.<br />
            <span style={{ color: '#C8102E' }}>Menos críticas públicas.</span>
          </h1>
          <p style={{ fontSize: 18, color: 'rgba(255,255,255,0.65)', lineHeight: 1.7, marginBottom: 40, maxWidth: 520, margin: '0 auto 40px' }}>
            Filtrá el feedback antes de que llegue a Google o TripAdvisor. Capturá las opiniones negativas en privado y redirigí a tus clientes satisfechos a dejar reseñas públicas.
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/login" style={{ padding: '14px 32px', background: '#C8102E', color: '#fff', borderRadius: 12, fontSize: 16, fontWeight: 700, textDecoration: 'none', display: 'inline-block' }}>
              Crear mi cuenta gratis
            </Link>
            <a href="#como-funciona" style={{ padding: '14px 32px', background: 'rgba(255,255,255,0.08)', color: '#fff', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 12, fontSize: 16, fontWeight: 600, textDecoration: 'none', display: 'inline-block' }}>
              Ver cómo funciona
            </a>
          </div>
        </div>
      </section>

      {/* Social proof bar */}
      <section style={{ background: '#f7f7f8', padding: '20px 24px', borderBottom: '1px solid #ebebeb' }}>
        <div style={{ maxWidth: 800, margin: '0 auto', display: 'flex', justifyContent: 'center', gap: 48, flexWrap: 'wrap', alignItems: 'center' }}>
          {[
            { value: 'Google', label: 'TripAdvisor · OpenTable · Yelp · más' },
            { value: '5 min', label: 'para estar activo' },
            { value: 'Sin apps', label: 'funciona desde el navegador' },
          ].map(s => (
            <div key={s.value} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#111' }}>{s.value}</div>
              <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="como-funciona" style={{ padding: '80px 24px', maxWidth: 900, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 56 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#C8102E', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 12 }}>Cómo funciona</div>
          <h2 style={{ fontSize: 'clamp(28px, 4vw, 42px)', fontWeight: 800, color: '#111', letterSpacing: '-0.02em', lineHeight: 1.2 }}>Tres pasos. Sin fricción.</h2>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 24 }}>
          {[
            { step: '01', icon: '📱', title: 'El cliente escanea el QR', desc: 'Poné el código QR en la mesa, el menú o la salida. El cliente lo escanea con su celular.' },
            { step: '02', icon: '⭐', title: 'Califica su experiencia', desc: 'Si la experiencia fue buena (4-5 estrellas), lo redirigimos a Google, TripAdvisor u otras plataformas. Si no, capturamos su feedback en privado.' },
            { step: '03', icon: '🔔', title: 'Vos recibís la alerta', desc: 'Te llega un email con el detalle del feedback negativo al instante. Si el cliente quiere hablar, lo conectamos por WhatsApp.' },
          ].map(s => (
            <div key={s.step} style={{ background: '#fff', border: '1px solid #ebebeb', borderRadius: 16, padding: 28 }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: '#C8102E', letterSpacing: '0.1em', marginBottom: 16 }}>{s.step}</div>
              <div style={{ fontSize: 32, marginBottom: 14 }}>{s.icon}</div>
              <h3 style={{ fontSize: 17, fontWeight: 700, color: '#111', marginBottom: 10 }}>{s.title}</h3>
              <p style={{ fontSize: 14, color: '#666', lineHeight: 1.65 }}>{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section style={{ background: '#f7f7f8', padding: '80px 24px' }}>
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 56 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#C8102E', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 12 }}>Funcionalidades</div>
            <h2 style={{ fontSize: 'clamp(28px, 4vw, 42px)', fontWeight: 800, color: '#111', letterSpacing: '-0.02em' }}>Todo lo que necesitás</h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
            {[
              { icon: '🔗', title: 'Multi-plataforma', desc: 'Google, TripAdvisor, OpenTable, TheFork, Facebook y Yelp en un solo lugar.' },
              { icon: '💬', title: 'WhatsApp directo', desc: 'Clientes insatisfechos pueden contactar al manager directamente por WhatsApp.' },
              { icon: '📧', title: 'Alertas por email', desc: 'Recibí notificaciones instantáneas cuando alguien deja feedback negativo.' },
              { icon: '📊', title: 'Dashboard simple', desc: 'Mirá tus estadísticas, ratings y comentarios en un panel claro y fácil.' },
              { icon: '📲', title: 'QR descargable', desc: 'Generamos tu código QR listo para imprimir y poner en las mesas.' },
              { icon: '⚡', title: 'Listo en 5 minutos', desc: 'Configurá tu restaurante con un wizard paso a paso sin necesitar soporte.' },
            ].map(f => (
              <div key={f.title} style={{ background: '#fff', borderRadius: 14, padding: '22px 20px', border: '1px solid #ebebeb' }}>
                <div style={{ fontSize: 28, marginBottom: 12 }}>{f.icon}</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#111', marginBottom: 8 }}>{f.title}</div>
                <div style={{ fontSize: 13, color: '#777', lineHeight: 1.6 }}>{f.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* For who */}
      <section style={{ padding: '80px 24px', maxWidth: 800, margin: '0 auto', textAlign: 'center' }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#C8102E', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 12 }}>¿Para quién es?</div>
        <h2 style={{ fontSize: 'clamp(28px, 4vw, 42px)', fontWeight: 800, color: '#111', letterSpacing: '-0.02em', marginBottom: 48 }}>Diseñado para negocios de hospitalidad</h2>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 16, flexWrap: 'wrap' }}>
          {[
            { icon: '🍽️', label: 'Restaurantes' },
            { icon: '🏨', label: 'Hoteles' },
            { icon: '🍹', label: 'Bares y Cafés' },
          ].map(b => (
            <div key={b.label} style={{ padding: '20px 32px', background: '#fff', border: '2px solid #ebebeb', borderRadius: 16, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, minWidth: 140 }}>
              <span style={{ fontSize: 36 }}>{b.icon}</span>
              <span style={{ fontSize: 15, fontWeight: 700, color: '#111' }}>{b.label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section style={{ background: 'linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%)', padding: '80px 24px', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: '20%', right: '15%', width: 250, height: 250, borderRadius: '50%', background: 'rgba(200,16,46,0.15)', filter: 'blur(50px)', pointerEvents: 'none' }} />
        <div style={{ maxWidth: 560, margin: '0 auto', position: 'relative' }}>
          <h2 style={{ fontSize: 'clamp(28px, 4vw, 44px)', fontWeight: 800, color: '#fff', letterSpacing: '-0.02em', marginBottom: 16 }}>
            Empezá hoy, gratis.
          </h2>
          <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.6)', lineHeight: 1.7, marginBottom: 36 }}>
            Configurá tu restaurante en menos de 5 minutos y comenzá a capturar feedback antes de que llegue a internet.
          </p>
          <Link href="/login" style={{ padding: '16px 40px', background: '#C8102E', color: '#fff', borderRadius: 12, fontSize: 17, fontWeight: 700, textDecoration: 'none', display: 'inline-block' }}>
            Crear mi cuenta gratis →
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ background: '#111', padding: '32px 24px', textAlign: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 16 }}>
          <div style={{ width: 24, height: 24, borderRadius: 6, background: '#C8102E', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, color: '#fff' }}>O</div>
          <span style={{ fontWeight: 700, fontSize: 14, color: '#fff' }}>Okapi Reviews</span>
        </div>
        <p style={{ fontSize: 12, color: '#555', margin: 0 }}>© 2026 Okapi Reviews · Todos los derechos reservados</p>
      </footer>

    </div>
  )
}
