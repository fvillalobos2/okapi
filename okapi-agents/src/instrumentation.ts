// Runs once at server startup — schedules the follow-up + SLA cron every hour
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return

  const INTERVAL_MS = 60 * 60 * 1000 // 1 hour

  const runCron = async () => {
    try {
      const baseUrl = process.env.APP_URL ?? 'http://localhost:3000'
      const res = await fetch(`${baseUrl}/api/cron/followup`, {
        method: 'POST',
        headers: { 'x-cron-secret': process.env.CRON_SECRET ?? '' },
      })
      const data = await res.json() as { sent?: number; slaAlerts?: number }
      console.log(`[cron] follow-up complete: ${data.sent ?? 0} sent, ${data.slaAlerts ?? 0} SLA alerts`)
    } catch (e) {
      console.error('[cron] follow-up error:', e)
    }
  }

  // Wait 60s after startup before first run (give Next.js time to fully initialize)
  setTimeout(() => {
    runCron()
    setInterval(runCron, INTERVAL_MS)
  }, 60_000)
}
