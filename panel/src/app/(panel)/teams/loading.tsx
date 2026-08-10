export default function Loading() {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div className="skeleton" style={{ height: 20, width: 110 }} />
        <div className="skeleton" style={{ height: 34, width: 120, borderRadius: 7 }} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="card">
            <div className="skeleton" style={{ height: 16, width: '55%', marginBottom: 12 }} />
            <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
              {Array.from({ length: 3 }).map((_, j) => (
                <div key={j}>
                  <div className="skeleton" style={{ height: 20, width: 36, marginBottom: 4 }} />
                  <div className="skeleton" style={{ height: 10, width: 40 }} />
                </div>
              ))}
            </div>
            <div className="skeleton" style={{ height: 11, width: '40%', marginBottom: 8 }} />
            {Array.from({ length: 2 }).map((_, j) => (
              <div key={j} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <div className="skeleton" style={{ width: 24, height: 24, borderRadius: '50%' }} />
                <div className="skeleton" style={{ height: 12, width: '50%' }} />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
