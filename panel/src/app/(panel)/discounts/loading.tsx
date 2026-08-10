export default function Loading() {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div className="skeleton" style={{ height: 20, width: 100 }} />
        <div className="skeleton" style={{ height: 34, width: 130, borderRadius: 7 }} />
      </div>
      <div className="card" style={{ padding: 0 }}>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} style={{ display: 'flex', gap: 16, padding: '14px 16px', borderBottom: '1px solid var(--border)', alignItems: 'center' }}>
            <div style={{ flex: 2 }}>
              <div className="skeleton" style={{ height: 14, width: '45%', marginBottom: 5 }} />
              <div className="skeleton" style={{ height: 11, width: '60%' }} />
            </div>
            <div className="skeleton" style={{ width: 60, height: 20, borderRadius: 99 }} />
            <div className="skeleton" style={{ width: 36, height: 20, borderRadius: 99 }} />
            <div className="skeleton" style={{ width: 32, height: 18, borderRadius: 5 }} />
          </div>
        ))}
      </div>
    </div>
  )
}
