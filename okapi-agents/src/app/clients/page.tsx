import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default function ClientsPage() {
  redirect(`/clients/${process.env.DEFAULT_BUSINESS_SLUG ?? 'innova'}`)
}
