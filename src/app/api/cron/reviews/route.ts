import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

async function refreshGoogleToken(refreshToken: string): Promise<string | null> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      grant_type: 'refresh_token',
    }),
  })
  const data = await res.json()
  return data.access_token || null
}

async function getReviews(accessToken: string, accountId: string, locationId: string) {
  const res = await fetch(
    `https://mybusiness.googleapis.com/v4/${accountId}/${locationId}/reviews?pageSize=50`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  )
  if (!res.ok) return []
  const data = await res.json()
  return data.reviews || []
}

async function postReply(accessToken: string, accountId: string, locationId: string, reviewId: string, comment: string) {
  const res = await fetch(
    `https://mybusiness.googleapis.com/v4/${accountId}/${locationId}/reviews/${reviewId}/reply`,
    {
      method: 'PUT',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ comment }),
    }
  )
  return res.ok
}

async function generateReply(restaurantName: string, reviewerName: string, rating: number, reviewText: string): Promise<string> {
  const msg = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 200,
    messages: [{
      role: 'user',
      content: `Eres el dueño de "${restaurantName}". Escribe una respuesta breve, cálida y profesional en español para esta reseña de Google.

Reseñador: ${reviewerName}
Calificación: ${rating}/5 estrellas
Reseña: ${reviewText || '(Sin comentario)'}

Reglas:
- Máximo 3 oraciones
- Agradece por la visita y la calificación
- Menciona el nombre del reseñador
- No uses emojis en exceso (máximo 1)
- Invita a regresar
- Tono cálido pero profesional
- Solo devuelve el texto de la respuesta, sin comillas ni explicaciones`,
    }],
  })
  return (msg.content[0] as { text: string }).text.trim()
}

// GET /api/cron/reviews — called by Vercel Cron every 30 min
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let queued = 0
  let sent = 0
  let errors = 0

  try {
    // --- PHASE 1: Fetch new reviews and queue responses ---
    const { data: restaurants } = await supabaseAdmin
      .from('restaurants')
      .select('id, name, google_access_token, google_refresh_token, google_account_id, google_location_id, plan, subscription_status')
      .eq('auto_reply_enabled', true)
      .eq('plan', 'business')
      .eq('subscription_status', 'active')
      .not('google_account_id', 'is', null)
      .not('google_location_id', 'is', null)

    for (const restaurant of restaurants || []) {
      try {
        let accessToken = restaurant.google_access_token

        // Refresh token if needed
        if (restaurant.google_refresh_token) {
          const fresh = await refreshGoogleToken(restaurant.google_refresh_token)
          if (fresh) {
            accessToken = fresh
            await supabaseAdmin.from('restaurants').update({ google_access_token: fresh }).eq('id', restaurant.id)
          }
        }

        if (!accessToken) continue

        const reviews = await getReviews(accessToken, restaurant.google_account_id, restaurant.google_location_id)

        for (const review of reviews) {
          const rating = review.starRating === 'FIVE' ? 5 : review.starRating === 'FOUR' ? 4 : review.starRating === 'THREE' ? 3 : review.starRating === 'TWO' ? 2 : 1
          if (rating <= 3) continue
          if (review.reviewReply) continue // already has a reply

          const reviewId = review.reviewId
          const reviewerName = review.reviewer?.displayName || 'Cliente'
          const reviewText = review.comment || ''

          // Schedule response 30-60 min from now
          const delayMin = Math.floor(Math.random() * 31) + 30 // 30-60
          const scheduledFor = new Date(Date.now() + delayMin * 60 * 1000)

          await supabaseAdmin.from('pending_review_responses').upsert({
            restaurant_id: restaurant.id,
            review_id: reviewId,
            reviewer_name: reviewerName,
            rating,
            review_text: reviewText,
            scheduled_for: scheduledFor.toISOString(),
            status: 'pending',
          }, { onConflict: 'restaurant_id,review_id', ignoreDuplicates: true })

          queued++
        }
      } catch {
        errors++
      }
    }

    // --- PHASE 2: Send responses that are ready ---
    const { data: pendingResponses } = await supabaseAdmin
      .from('pending_review_responses')
      .select('*, restaurants(name, google_access_token, google_refresh_token, google_account_id, google_location_id, auto_reply_enabled, plan, subscription_status)')
      .eq('status', 'pending')
      .lte('scheduled_for', new Date().toISOString())
      .limit(20)

    for (const pending of pendingResponses || []) {
      const restaurant = pending.restaurants as Record<string, string>
      if (!restaurant || restaurant.auto_reply_enabled === 'false' || restaurant.plan !== 'business' || restaurant.subscription_status !== 'active') {
        await supabaseAdmin.from('pending_review_responses').update({ status: 'skipped' }).eq('id', pending.id)
        continue
      }

      try {
        let accessToken = restaurant.google_access_token
        if (restaurant.google_refresh_token) {
          const fresh = await refreshGoogleToken(restaurant.google_refresh_token)
          if (fresh) {
            accessToken = fresh
            await supabaseAdmin.from('restaurants').update({ google_access_token: fresh }).eq('id', pending.restaurant_id)
          }
        }

        const responseText = await generateReply(restaurant.name, pending.reviewer_name, pending.rating, pending.review_text)

        const ok = await postReply(
          accessToken,
          restaurant.google_account_id,
          restaurant.google_location_id,
          pending.review_id,
          responseText
        )

        await supabaseAdmin.from('pending_review_responses').update({
          status: ok ? 'sent' : 'failed',
          response_text: responseText,
          sent_at: ok ? new Date().toISOString() : null,
        }).eq('id', pending.id)

        if (ok) sent++
        else errors++
      } catch {
        await supabaseAdmin.from('pending_review_responses').update({ status: 'failed' }).eq('id', pending.id)
        errors++
      }
    }

    return NextResponse.json({ queued, sent, errors })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
