import { NextRequest, NextResponse } from 'next/server'

const TWILIO_SID = process.env.TWILIO_ACCOUNT_SID!
const TWILIO_TOKEN = process.env.TWILIO_AUTH_TOKEN!
const FROM = process.env.TWILIO_WA_NUMBER!

export async function sendWhatsApp(to: string, body: string) {
  const url = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${TWILIO_SID}:${TWILIO_TOKEN}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ From: FROM, To: to, Body: body }).toString(),
  })
  return res.ok
}

// Internal endpoint for testing
export async function POST(req: NextRequest) {
  const { to, body } = await req.json()
  const ok = await sendWhatsApp(to, body)
  return NextResponse.json({ ok })
}
