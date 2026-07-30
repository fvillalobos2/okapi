export default function Loading() {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div className="skeleton" style={{ height: 20, width: 100 }} />
        <div className="skeleton" style={{ height: 34, width: 110, borderRadius: 7 }} />
      </div>
      <div className="card" style={{ padding: 0 }}>
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} style={{ display: 'flex', gap: 14, padding: '13px 16px', borderBottom: '1px solid var(--border)', alignItems: 'center' }}>
            <div className="skeleton" style={{ width: 32, height: 32, borderRadius: '50%', flexShrink: 0 }} />
            <div style={{ flex: 2 }}>
              <div className="skeleton" style={{ height: 13, width: '55%', marginBottom: 5 }} />
              <div className="skeleton" style={{ height: 11, width: '40%' }} />
            </div>
            <div className="skeleton" style={{ flex: 1, height: 13 }} />
            <div className="skeleton" style={{ width: 70, height: 20, borderRadius: 99 }} />
            <div className="skeleton" style={{ width: 60, height: 20, borderRadius: 99 }} />
          </div>
        ))}
      </div>
    </div>
  )
}
