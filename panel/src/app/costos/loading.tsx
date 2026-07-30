export default function Loading() {
  return (
    <div>
      <div className="skeleton" style={{ height: 20, width: 160, marginBottom: 24 }} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12, marginBottom: 28 }}>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="kpi-card">
            <div className="skeleton" style={{ height: 11, width: '55%', marginBottom: 12 }} />
            <div className="skeleton" style={{ height: 26, width: '50%' }} />
          </div>
        ))}
      </div>
      <div className="card" style={{ padding: 0 }}>
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} style={{ display: 'flex', gap: 16, padding: '12px 14px', borderBottom: '1px solid var(--border)' }}>
            <div className="skeleton" style={{ flex: 2, height: 13 }} />
            <div className="skeleton" style={{ flex: 1, height: 13 }} />
            <div className="skeleton" style={{ flex: 1, height: 13 }} />
            <div className="skeleton" style={{ flex: 1, height: 13 }} />
          </div>
        ))}
      </div>
    </div>
  )
}
