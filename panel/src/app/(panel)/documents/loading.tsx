export default function Loading() {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div className="skeleton" style={{ height: 20, width: 130 }} />
        <div className="skeleton" style={{ height: 34, width: 130, borderRadius: 7 }} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="card" style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div className="skeleton" style={{ width: 36, height: 36, borderRadius: 8, flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div className="skeleton" style={{ height: 13, width: '45%', marginBottom: 5 }} />
              <div className="skeleton" style={{ height: 11, width: '30%' }} />
            </div>
            <div className="skeleton" style={{ width: 60, height: 28, borderRadius: 7 }} />
          </div>
        ))}
      </div>
    </div>
  )
}
