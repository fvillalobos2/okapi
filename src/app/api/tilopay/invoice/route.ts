import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const PLAN_LABELS: Record<string, string> = {
  starter: 'Starter',
  pro: 'Pro',
  business: 'Business',
}

const PLAN_PRICES: Record<string, number> = {
  starter: 29,
  pro: 59,
  business: 129,
}

function invoiceNumber(orderRef: string) {
  // Extract timestamp from orderNumber: okapi-{restaurantId}-{plan}-{timestamp}
  const parts = orderRef.split('-')
  const ts = parts[parts.length - 1]
  return `OKP-${ts?.slice(-6) ?? Date.now().toString().slice(-6)}`
}

function formatDate(date: Date) {
  return date.toLocaleDateString('es-CR', { day: '2-digit', month: 'long', year: 'numeric' })
}

export async function POST(req: NextRequest) {
  try {
    const { restaurantId, orderNumber } = await req.json()
    if (!restaurantId || !orderNumber) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
    }

    const { data: rest } = await supabaseAdmin
      .from('restaurants')
      .select('name, billing_email, billing_name, plan, manager_email')
      .eq('id', restaurantId)
      .single()

    if (!rest) return NextResponse.json({ error: 'Restaurant not found' }, { status: 404 })

    const to = rest.billing_email || rest.manager_email
    if (!to) return NextResponse.json({ error: 'No billing email' }, { status: 400 })

    const plan = rest.plan || 'pro'
    const price = PLAN_PRICES[plan]
    const now = new Date()
    const nextMonth = new Date(now)
    nextMonth.setMonth(nextMonth.getMonth() + 1)
    const invNum = invoiceNumber(orderNumber)

    const html = `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f7f7f8;font-family:system-ui,-apple-system,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f7f7f8;padding:40px 20px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.07);">

        <!-- Header -->
        <tr>
          <td style="background:#0f0f0f;padding:28px 36px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td>
                  <span style="display:inline-block;width:32px;height:32px;background:#C8102E;border-radius:8px;text-align:center;line-height:32px;color:#fff;font-weight:800;font-size:14px;">O</span>
                  <span style="color:#fff;font-weight:700;font-size:16px;vertical-align:middle;margin-left:10px;">Okapi Reviews</span>
                </td>
                <td align="right">
                  <span style="color:#555;font-size:13px;">Factura</span>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Invoice info -->
        <tr>
          <td style="padding:32px 36px 0;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td>
                  <div style="font-size:12px;color:#aaa;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:4px;">Número de factura</div>
                  <div style="font-size:18px;font-weight:800;color:#111;">${invNum}</div>
                </td>
                <td align="right">
                  <div style="font-size:12px;color:#aaa;margin-bottom:4px;">Fecha de emisión</div>
                  <div style="font-size:14px;color:#111;font-weight:600;">${formatDate(now)}</div>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Divider -->
        <tr><td style="padding:20px 36px;"><hr style="border:none;border-top:1px solid #ebebeb;margin:0;"></td></tr>

        <!-- Bill to -->
        <tr>
          <td style="padding:0 36px 24px;">
            <div style="font-size:12px;color:#aaa;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:8px;">Facturado a</div>
            <div style="font-size:15px;font-weight:700;color:#111;">${rest.billing_name || rest.name}</div>
            <div style="font-size:13px;color:#666;margin-top:2px;">${to}</div>
          </td>
        </tr>

        <!-- Line items -->
        <tr>
          <td style="padding:0 36px;">
            <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #ebebeb;border-radius:10px;overflow:hidden;">
              <tr style="background:#f7f7f8;">
                <td style="padding:12px 16px;font-size:12px;font-weight:700;color:#888;text-transform:uppercase;letter-spacing:0.05em;">Descripción</td>
                <td align="right" style="padding:12px 16px;font-size:12px;font-weight:700;color:#888;text-transform:uppercase;letter-spacing:0.05em;">Monto</td>
              </tr>
              <tr style="border-top:1px solid #ebebeb;">
                <td style="padding:16px;">
                  <div style="font-size:14px;font-weight:600;color:#111;">Okapi Reviews — Plan ${PLAN_LABELS[plan]}</div>
                  <div style="font-size:12px;color:#888;margin-top:3px;">Suscripción mensual · ${formatDate(now)} – ${formatDate(nextMonth)}</div>
                </td>
                <td align="right" style="padding:16px;font-size:14px;font-weight:600;color:#111;">$${price}.00 USD</td>
              </tr>
              <tr style="background:#f7f7f8;border-top:1px solid #ebebeb;">
                <td style="padding:14px 16px;font-size:14px;font-weight:800;color:#111;">Total</td>
                <td align="right" style="padding:14px 16px;font-size:18px;font-weight:900;color:#111;">$${price}.00 USD</td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Order ref -->
        <tr>
          <td style="padding:20px 36px 0;">
            <div style="font-size:12px;color:#bbb;">Referencia de pago: <span style="font-family:monospace;">${orderNumber}</span></div>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding:32px 36px;text-align:center;">
            <div style="font-size:12px;color:#bbb;line-height:1.7;">
              Gracias por usar Okapi Reviews.<br>
              ¿Preguntas? Escríbenos a <a href="mailto:hola@projectokapi.com" style="color:#C8102E;text-decoration:none;">hola@projectokapi.com</a>
            </div>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`

    const resend = new Resend(process.env.RESEND_API_KEY)
    await resend.emails.send({
      from: 'Okapi Reviews <facturacion@projectokapi.com>',
      to,
      subject: `Factura ${invNum} — Plan ${PLAN_LABELS[plan]} $${price}/mes`,
      html,
    })

    return NextResponse.json({ ok: true, invoiceNumber: invNum })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
