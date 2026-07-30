export default function Loading() {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div className="skeleton" style={{ height: 20, width: 120 }} />
        <div className="skeleton" style={{ height: 34, width: 130, borderRadius: 7 }} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div className="skeleton" style={{ height: 16, width: 140 }} />
              <div className="skeleton" style={{ height: 14, width: 60 }} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
              {Array.from({ length: 3 }).map((_, j) => (
                <div key={j} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 12 }}>
                  <div className="skeleton" style={{ height: 13, width: '70%', marginBottom: 8 }} />
                  <div className="skeleton" style={{ height: 18, width: '45%', marginBottom: 6 }} />
                  <div className="skeleton" style={{ height: 11, width: '80%' }} />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
