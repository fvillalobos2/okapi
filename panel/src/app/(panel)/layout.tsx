import Sidebar from '@/components/Sidebar'
import MobileTopBar from '@/components/MobileTopBar'

export default function PanelLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar />
      <MobileTopBar />
      <div className="main">
        <div style={{ padding: '28px', flex: 1, maxWidth: 1280 }}>
          {children}
        </div>
      </div>
    </div>
  )
}
