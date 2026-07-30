export default function Loading() {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div className="skeleton" style={{ height: 20, width: 140 }} />
        <div style={{ display: 'flex', gap: 8 }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="skeleton" style={{ height: 30, width: 80, borderRadius: 99 }} />
          ))}
        </div>
      </div>
      <div className="card" style={{ padding: 0 }}>
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} style={{ display: 'flex', gap: 14, padding: '13px 16px', borderBottom: '1px solid var(--border)', alignItems: 'center' }}>
            <div className="skeleton" style={{ width: 36, height: 36, borderRadius: '50%', flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div className="skeleton" style={{ height: 13, width: '50%', marginBottom: 5 }} />
              <div className="skeleton" style={{ height: 11, width: '75%' }} />
            </div>
            <div className="skeleton" style={{ width: 70, height: 20, borderRadius: 99 }} />
            <div className="skeleton" style={{ width: 28, height: 11 }} />
          </div>
        ))}
      </div>
    </div>
  )
}
