'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type Restaurant = {
  name: string
  logo_url: string | null
  slug: string
}

export default function PrintPage() {
  const { slug } = useParams<{ slug: string }>()
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null)

  useEffect(() => {
    supabase.from('restaurants').select('name, logo_url, slug').eq('slug', slug).single()
      .then(({ data }) => {
        if (data) setRestaurant(data)
      })
  }, [slug])

  useEffect(() => {
    if (restaurant) {
      setTimeout(() => window.print(), 800)
    }
  }, [restaurant])

  if (!restaurant) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui' }}>
      <div style={{ color: '#888', fontSize: 14 }}>Preparando PDF…</div>
    </div>
  )

  const reviewUrl = `https://reviews.projectokapi.com/r/${restaurant.slug}`
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(reviewUrl)}&bgcolor=ffffff&color=1a1a1a&margin=10`

  return (
    <>
      <style>{`
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { background: #fff; }
        @media print {
          @page { size: A4; margin: 0; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .no-print { display: none !important; }
        }
      `}</style>

      {/* Print hint */}
      <div className="no-print" style={{ background: '#1a1a1a', color: '#fff', padding: '12px 20px', fontSize: 13, textAlign: 'center', fontFamily: 'system-ui' }}>
        El diálogo de impresión se abre automáticamente. Elegí "Guardar como PDF" para descargar.
      </div>

      {/* A4 page */}
      <div style={{
        width: '210mm',
        minHeight: '297mm',
        margin: '0 auto',
        background: '#fff',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20mm',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        position: 'relative',
      }}>

        {/* Top accent */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 8, background: '#C8102E' }} />

        {/* Logo or name */}
        {restaurant.logo_url ? (
          <img src={restaurant.logo_url} alt={restaurant.name}
            style={{ maxHeight: 80, maxWidth: 200, objectFit: 'contain', marginBottom: 24 }} />
        ) : (
          <div style={{ fontSize: 28, fontWeight: 800, color: '#111', marginBottom: 24, textAlign: 'center' }}>
            {restaurant.name}
          </div>
        )}

        {/* Headline */}
        <div style={{ fontSize: 15, fontWeight: 600, color: '#555', marginBottom: 8, textAlign: 'center', letterSpacing: '0.02em' }}>
          ¿Cómo fue tu experiencia?
        </div>
        <div style={{ fontSize: 13, color: '#999', marginBottom: 40, textAlign: 'center', maxWidth: 280, lineHeight: 1.6 }}>
          Escaneá el código con tu teléfono y dejanos tu opinión. ¡Solo toma 30 segundos!
        </div>

        {/* QR */}
        <div style={{
          background: '#fff',
          border: '3px solid #1a1a1a',
          borderRadius: 20,
          padding: 16,
          marginBottom: 32,
          boxShadow: '0 8px 40px rgba(0,0,0,0.10)',
        }}>
          <img src={qrUrl} alt="QR Code" style={{ width: 200, height: 200, display: 'block' }} />
        </div>

        {/* Restaurant name if logo exists */}
        {restaurant.logo_url && (
          <div style={{ fontSize: 20, fontWeight: 800, color: '#111', marginBottom: 8, textAlign: 'center' }}>
            {restaurant.name}
          </div>
        )}

        {/* URL */}
        <div style={{ fontSize: 11, color: '#bbb', marginBottom: 48, letterSpacing: '0.04em' }}>
          {reviewUrl}
        </div>

        {/* Steps */}
        <div style={{ display: 'flex', gap: 32, marginBottom: 40 }}>
          {[
            { icon: '📱', text: 'Abrí la cámara' },
            { icon: '🔍', text: 'Apuntá al QR' },
            { icon: '⭐', text: 'Dejá tu opinión' },
          ].map(s => (
            <div key={s.text} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 24, marginBottom: 6 }}>{s.icon}</div>
              <div style={{ fontSize: 11, color: '#888', fontWeight: 600 }}>{s.text}</div>
            </div>
          ))}
        </div>

        {/* Bottom branding */}
        <div style={{ position: 'absolute', bottom: 16, display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 18, height: 18, borderRadius: 4, background: '#C8102E', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 800, color: '#fff' }}>O</div>
          <span style={{ fontSize: 10, color: '#ccc', fontWeight: 600 }}>Powered by Okapi Reviews</span>
        </div>
      </div>
    </>
  )
}
