export default function Loading() {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div className="skeleton" style={{ height: 20, width: 80 }} />
        <div style={{ display: 'flex', gap: 8 }}>
          <div className="skeleton" style={{ height: 34, width: 100, borderRadius: 7 }} />
          <div className="skeleton" style={{ height: 34, width: 80, borderRadius: 7 }} />
        </div>
      </div>
      <div className="card" style={{ padding: 0 }}>
        <div style={{ padding: '8px 0' }}>
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} style={{ display: 'flex', gap: 16, padding: '11px 14px', borderBottom: '1px solid var(--border)' }}>
              <div style={{ flex: 2 }}>
                <div className="skeleton" style={{ height: 13, width: '65%', marginBottom: 5 }} />
                <div className="skeleton" style={{ height: 11, width: '40%' }} />
              </div>
              <div className="skeleton" style={{ flex: 1, height: 13 }} />
              <div className="skeleton" style={{ flex: 2, height: 13 }} />
              <div className="skeleton" style={{ width: 70, height: 20, borderRadius: 99 }} />
              <div className="skeleton" style={{ width: 28, height: 13 }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
