import { Sidebar, MobileNav } from '@/components/shared/Sidebar'
import { getFarmName } from '@/lib/data/supabase'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  let farmName = 'Establecimiento'
  try { farmName = await getFarmName() } catch {}

  return (
    <div className="flex h-full min-h-screen">
      <Sidebar farmName={farmName} />
      <div className="flex flex-col flex-1 min-w-0">
        <MobileNav />
        <main className="flex-1 p-5 md:p-7 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
