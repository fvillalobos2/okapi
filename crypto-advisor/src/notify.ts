import twilio from 'twilio'
import { requireEnv } from './config.js'

/** Send a WhatsApp message via Twilio (same provider as okapi-agents). */
export async function sendWhatsApp(body: string): Promise<string> {
  const client = twilio(requireEnv('TWILIO_ACCOUNT_SID'), requireEnv('TWILIO_AUTH_TOKEN'))
  const msg = await client.messages.create({
    from: requireEnv('TWILIO_WHATSAPP_FROM'),
    to: requireEnv('ALERT_WHATSAPP_TO'),
    body,
  })
  return msg.sid
}
