'use client'

import { useState } from 'react'

const GUIDE_SECTIONS = [
  {
    title: 'Métricas Clave — 93 conversaciones analizadas',
    content: `| Métrica | Deals Ganados | Deals Perdidos |
|---|---|---|
| Conversaciones | 47 | 46 |
| Uso de descuento como argumento | 100% de los casos | ~40% |
| Seguimiento post-cotización activo | Siempre, con urgencia | Tardío o inexistente |
| Llamada a la acción post-cotización | Siempre presente | Ausente en >70% |
| Tiempo máximo de seguimiento | 5 días con vigencia explícita | Hasta 3 años sin contacto |`,
    type: 'table',
  },
  {
    title: 'Los 5 Hallazgos Más Críticos',
    content: [
      'El seguimiento es la variable con mayor impacto en conversión. Deals ganados tienen seguimiento activo con urgencia real (descuento con vigencia de 5 días).',
      'Las respuestas con plantilla matan conversaciones. El error más frecuente: cliente pregunta por garantía, instalación y cotización → CS responde con bloque estándar de descuento sin mencionar ninguno.',
      'El cierre activo está ausente en la mayoría de deals perdidos. Cuando el cliente dice "¡Muchas gracias!", el CS ganador propone el siguiente paso. El perdedor responde "con gusto" y espera.',
      'La inflexibilidad ante restricciones de presupuesto genera abandono. No se ofrecen alternativas ante clientes que no pueden pagar de una sola vez.',
      'La apertura automatizada sin personalización genera fricciones. Frases de marketing como "Creamos espacios con alma" sin preguntar qué necesita el cliente retrasan la conversación.',
    ],
    type: 'list',
  },
  {
    title: 'Voz y Tono del Agente',
    rows: [
      ['Formalidad', 'Semi-formal: cortés y profesional, pero cercano y humano. No robótico.'],
      ['Persona gramatical', 'Primera persona plural ("le confirmamos", "le facilitamos") para representar al equipo.'],
      ['Velocidad de respuesta', 'Inmediata o muy rápida. La demora erosiona la confianza.'],
      ['Longitud de mensajes', 'Cortos y directos. Listas cuando hay múltiples opciones.'],
      ['Actitud', 'Proactiva: anticipa dudas, ofrece descuentos antes de que los pidan, propone fechas concretas.'],
      ['Emojis', 'Máximo 1–2 por mensaje. ✅ para confirmar, 😊 en saludos, 📋 al enviar cotizaciones. Nunca en mensajes de precios o problemas.'],
    ],
    type: 'kv',
  },
  {
    title: 'Frases Características (a usar)',
    content: [
      '¡Hola! Bienvenido/a a Innova. Con mucho gusto le atendemos.',
      '¿En qué parte del país requeriría la visita?',
      'La visita no tiene ningún costo.',
      'Le estará atendiendo nuestro asesor Gerardo Chaves.',
      'El plazo de producción es de 8 a 10 días hábiles.',
      'Contamos con un descuento del 20% para pago en efectivo o transferencia.',
      'Gerencia nos aprobó un beneficio adicional del 5%, válido por los próximos 5 días.',
      'Para proceder necesitamos el adelanto del 50%. Le comparto los datos bancarios: [datos].',
      'Le confirmo de recibido el adelanto del 50% de la cotización.',
      'El compañero de operaciones, Esteban Vargas, le estará contactando para coordinar la instalación.',
    ],
    type: 'phrases',
  },
  {
    title: 'Frases PROHIBIDAS',
    content: [
      '"Creamos espacios con alma, hechos a su medida." — frase de marketing como respuesta inicial.',
      '"Con gusto." — como respuesta final sin llamada a la acción.',
      '"Si, es que del tamaño indicado no ofrecemos." — sin proponer alternativa.',
      '"¿Hay algo específico que le gustaría aclarar?" — tras enviar catálogo extenso.',
      'Mensajes de descuento cuando el cliente preguntó por garantía o instalación.',
      'Seguimientos genéricos sin personalización después de semanas de silencio.',
    ],
    type: 'forbidden',
  },
  {
    title: 'Tabla de Objeciones y Respuestas',
    rows: [
      ['¿La visita tiene algún costo?', '"No, la visita no tiene ningún costo."'],
      ['No puedo entre semana', '"¿Le parece bien coordinar para el sábado a las 8 a.m.?"'],
      ['Quiero cambiar las especificaciones', '"Sí, en este caso le vamos a modificar la cotización."'],
      ['¿Qué pasa después del depósito?', '"Le confirmo de recibido, vamos a procesar la orden y operaciones le contactará para la instalación."'],
      ['(Implícita) Cliente no confirma', '"Gerencia nos aprobó un beneficio adicional del 5%, válido por los próximos 5 días."'],
      ['Necesito comprar de 10 en 10 por semana', '"Sin problema, podemos cotizarle por lotes. ¿Le indicamos el precio por m² para que planifique?"'],
      ['Medida no estándar', '"Para esa medida podemos consultarlo con nuestro equipo técnico. ¿Me permite un momento?"'],
      ['Necesito esperar obras en casa', '"Perfecto, quedamos atentos. ¿Aproximadamente en qué fecha estarían listos?"'],
      ['¿Cuál es la garantía?', 'Responder específicamente: plazo, cobertura y proceso de reclamo. NUNCA ignorar.'],
      ['¿Me pueden enviar un catálogo?', 'Enviar catálogo inmediatamente con referencia a las opciones más relevantes para lo que el cliente describió.'],
    ],
    type: 'objections',
  },
  {
    title: 'Protocolo de Seguimiento — 5 Toques',
    steps: [
      {
        label: 'Toque 1 — Hora 0 (entrega de cotización)',
        text: '"[Nombre], aquí le adjunto su cotización por [X producto] para [X área]. El precio incluye [instalación/solo material]. Para aprovechar el descuento del 20% necesitaría confirmar antes del [fecha]. ¿Esto se ajusta a lo que tenía en mente o tiene algún punto que quiera ajustar?"',
      },
      {
        label: 'Toque 2 — 24 horas después',
        text: '"[Nombre], ¿tuvo oportunidad de revisar la cotización de [producto] que le enviamos ayer? Quería asegurarme de que no quedara ninguna duda sobre [garantía / instalación / medidas / tiempo de entrega]."',
      },
      {
        label: 'Toque 3 — 48–72 horas (urgencia legítima)',
        text: '"[Nombre], le escribo porque tenemos disponibilidad de instalación para la próxima semana. ¿Sigue en pie el proyecto o prefiere que lo agendemos para más adelante?"',
      },
      {
        label: 'Toque 4 — 5–7 días (abordar objeción no expresada)',
        text: '"[Nombre], a veces cuando no hay respuesta es porque el precio generó una duda o el presupuesto no cuadra. Si ese es el caso, con gusto exploramos opciones — material alternativo, fases de compra, o ajuste de área."',
      },
      {
        label: 'Toque 5 — 10–14 días (cierre o descarte)',
        text: '"[Nombre], quiero ser directo: ¿sigue interesado en el proyecto de [producto] o prefiero que lo dejemos para cuando sea el momento indicado? No hay ningún problema en ninguna de las dos respuestas."',
      },
    ],
    type: 'steps',
  },
  {
    title: 'Playbook por Producto',
    products: [
      {
        name: 'Toldos (Retráctiles y Verticales)',
        apertura: '¡Hola! Bienvenido/a a Innova. Con mucho gusto le atendemos. Para brindarle la mejor asesoría, nos gustaría coordinar una visita técnica sin ningún costo donde el asesor puede tomar medidas exactas. ¿En qué zona se encuentra el proyecto?',
        pitch: ['Visita técnica gratuita.', 'Descuento del 20% para pago en efectivo o transferencia.', 'Cotización en dólares con especificaciones exactas (desglose por paño).', 'Plazo de producción de 8 a 10 días hábiles.', 'Descuento adicional de gerencia del 5%, válido 5 días (urgencia táctica).', 'Asesor nombrado: "Le estará atendiendo Gerardo Chaves."'],
        cierre: 'Para proceder necesitamos un adelanto del 50%. Le comparto los datos bancarios: [datos]. Una vez confirmado el depósito, ingresamos la orden a producción.',
      },
      {
        name: 'Cortinas y Persianas',
        apertura: '¡Hola! Muchas gracias por contactarnos. Con mucho gusto le asesoramos. Podemos coordinar una visita de nuestro asesor sin ningún costo para tomar medidas y presentarle opciones personalizadas. ¿Le parece bien coordinarlo esta semana?',
        pitch: ['Presentar dos opciones: Opción A y Opción B, ambas con descuento del 20%.', 'Validación social: "Hemos trabajado con varios vecinos del condominio y han quedado muy satisfechos."', 'Urgencia táctica con fecha: "Para instalación el miércoles, necesitamos el adelanto antes del mediodía."', 'Plazo claro: instalación en 10 a 12 días hábiles.'],
        cierre: 'Perfecto, ya modificamos la cotización con esas especificaciones. Para proceder con la instalación esta semana necesitamos el adelanto del 50% antes del mediodía de hoy.',
      },
      {
        name: 'Papel Tapiz',
        apertura: 'Apertura proactiva: enviar catálogo + colecciones + precios + descuento vigente + requerimientos técnicos antes de que el cliente los pida. Luego: "¿En qué parte del país requeriría la visita?"',
        pitch: ['Descuento del 15% durante el mes para pago por transferencia.', 'Descuento adicional de gerencia del 5%.', 'Cotización detallada por área (desglosar por pared, explicar recargos por altura >3.20m).'],
        cierre: 'El cierre puede ser condicional a obra en curso. "Perfecto, entonces quedamos coordinados para cuando terminen los trabajos. ¿Me podría avisar aproximadamente en qué fecha para agendarle la visita?"',
      },
      {
        name: 'Pisos (SPC / Laminado / Deck)',
        apertura: '¡Hola! Con gusto le asesoramos en pisos. ¿Nos puede indicar el tipo de espacio (interior/exterior) y el metraje aproximado?',
        pitch: ['Precio por m² claro desde el inicio.', 'Disponibilidad de perfiladores, rodapiés y accesorios en el mismo presupuesto.', 'Para deck exterior: especificar si es WPC o material alternativo.', 'Instalación incluida o separada: desglosar siempre.', 'Ante compra fraccionada: "Con gusto podemos cotizarle por metros cuadrados. ¿Cuántos m² en esta primera etapa?"'],
        cierre: 'Ante restricción financiera: preguntar presupuesto disponible ahora, plazo para completar inversión, si le interesa reservar el precio actual.',
      },
    ],
    type: 'products',
  },
]

type Section = typeof GUIDE_SECTIONS[number]

function SectionContent({ section }: { section: Section }) {
  const s = section as any

  if (s.type === 'table') {
    const lines = s.content.split('\n').filter((l: string) => l.trim() && !l.match(/^[\|\-\s]+$/))
    const rows = lines.map((l: string) => l.split('|').map((c: string) => c.trim()).filter(Boolean))
    const [head, ...body] = rows
    return (
      <div className="table-wrap" style={{ marginTop: 0 }}>
        <table>
          <thead><tr>{head.map((h: string, i: number) => <th key={i}>{h}</th>)}</tr></thead>
          <tbody>{body.map((r: string[], i: number) => <tr key={i}>{r.map((c: string, j: number) => <td key={j}>{c}</td>)}</tr>)}</tbody>
        </table>
      </div>
    )
  }

  if (s.type === 'list') {
    return (
      <ol style={{ margin: '8px 0 0', paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {s.content.map((item: string, i: number) => (
          <li key={i} style={{ fontSize: 13, lineHeight: 1.55, color: 'var(--text)' }}>{item}</li>
        ))}
      </ol>
    )
  }

  if (s.type === 'kv') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
        {s.rows.map(([k, v]: [string, string], i: number) => (
          <div key={i} style={{ display: 'flex', gap: 10, fontSize: 13 }}>
            <span style={{ color: 'var(--muted)', minWidth: 160, flexShrink: 0, fontWeight: 600 }}>{k}</span>
            <span style={{ color: 'var(--text)', lineHeight: 1.5 }}>{v}</span>
          </div>
        ))}
      </div>
    )
  }

  if (s.type === 'phrases') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
        {s.content.map((phrase: string, i: number) => (
          <div key={i} style={{ background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.18)', borderRadius: 6, padding: '6px 10px', fontSize: 13, color: 'var(--text)', lineHeight: 1.5 }}>
            {phrase}
          </div>
        ))}
      </div>
    )
  }

  if (s.type === 'forbidden') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
        {s.content.map((phrase: string, i: number) => (
          <div key={i} style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 6, padding: '6px 10px', fontSize: 13, color: '#fca5a5', lineHeight: 1.5 }}>
            ❌ {phrase}
          </div>
        ))}
      </div>
    )
  }

  if (s.type === 'objections') {
    return (
      <div className="table-wrap" style={{ marginTop: 0 }}>
        <table>
          <thead><tr><th>Objeción</th><th>Respuesta</th></tr></thead>
          <tbody>
            {s.rows.map(([obj, res]: [string, string], i: number) => (
              <tr key={i}>
                <td style={{ color: 'var(--muted)', fontStyle: 'italic', width: '38%' }}>{obj}</td>
                <td style={{ fontSize: 12 }}>{res}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  if (s.type === 'steps') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 4 }}>
        {s.steps.map((step: { label: string; text: string }, i: number) => (
          <div key={i} style={{ display: 'flex', gap: 12 }}>
            <div style={{ width: 22, height: 22, borderRadius: '50%', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#fff', flexShrink: 0, marginTop: 2 }}>
              {i + 1}
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', marginBottom: 4 }}>{step.label}</div>
              <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.55, background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.15)', borderRadius: 6, padding: '6px 10px' }}>{step.text}</div>
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (s.type === 'products') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 4 }}>
        {s.products.map((p: { name: string; apertura: string; pitch: string[]; cierre: string }, i: number) => (
          <div key={i} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', borderRadius: 8, padding: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10, color: 'var(--accent)' }}>{p.name}</div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 4 }}>Apertura</div>
            <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.5, marginBottom: 10 }}>{p.apertura}</div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 4 }}>Pitch</div>
            <ul style={{ margin: '0 0 10px', paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 3 }}>
              {p.pitch.map((pt, j) => <li key={j} style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.45 }}>{pt}</li>)}
            </ul>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 4 }}>Cierre</div>
            <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.5 }}>{p.cierre}</div>
          </div>
        ))}
      </div>
    )
  }

  return null
}

function Accordion({ section }: { section: Section }) {
  const [open, setOpen] = useState(false)
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 16px', background: 'var(--surface)', border: 'none', cursor: 'pointer',
          fontSize: 13, fontWeight: 600, color: 'var(--text)', textAlign: 'left',
        }}
      >
        {section.title}
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2"
          style={{ flexShrink: 0, transition: 'transform .2s', transform: open ? 'rotate(180deg)' : 'none' }}>
          <path d="M2 5l5 5 5-5"/>
        </svg>
      </button>
      {open && (
        <div style={{ padding: '12px 16px 14px', background: 'rgba(0,0,0,0.15)', borderTop: '1px solid var(--border)' }}>
          <SectionContent section={section} />
        </div>
      )}
    </div>
  )
}

export default function PromptClient({ initialPrompt }: { initialPrompt: string }) {
  const [tab, setTab] = useState<'prompt' | 'guide'>('prompt')
  const [prompt, setPrompt] = useState(initialPrompt)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  async function save() {
    setSaving(true)
    setSaved(false)
    await fetch('/api/prompt', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ system_prompt: prompt }),
    })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  return (
    <div>
      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {(['prompt', 'guide'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`btn btn-sm ${tab === t ? 'btn-primary' : 'btn-ghost'}`}
          >
            {t === 'prompt' ? 'Instrucciones del Agente' : 'Guía de Ventas'}
          </button>
        ))}
      </div>

      {tab === 'prompt' && (
        <div>
          <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 14 }}>
            El agente recibe estas instrucciones en cada conversación de WhatsApp. Edita y guarda para actualizar el comportamiento del bot en tiempo real.
          </p>
          <textarea
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            className="form-control"
            style={{ width: '100%', minHeight: 500, fontFamily: 'monospace', fontSize: 13, lineHeight: 1.6, resize: 'vertical' }}
            spellCheck={false}
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 14 }}>
            <button
              onClick={save}
              disabled={saving}
              className="btn btn-primary"
            >
              {saving ? 'Guardando…' : 'Guardar instrucciones'}
            </button>
            {saved && <span style={{ fontSize: 13, color: '#4ade80' }}>✓ Guardado</span>}
          </div>
        </div>
      )}

      {tab === 'guide' && (
        <div>
          <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 16 }}>
            Análisis de 93 conversaciones reales de Innova (47 ganadas / 46 perdidas). Tasa de conversión actual: ~50.5%.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {GUIDE_SECTIONS.map((section, i) => (
              <Accordion key={i} section={section} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
