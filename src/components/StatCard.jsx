export default function StatCard({ label, value, sub, icon: Icon, accent, small = false }) {
  return (
    <div
      className="rounded-xl p-4 flex flex-col gap-2"
      style={{
        background: 'var(--color-brand-card)',
        border: `1px solid ${accent ?? 'var(--color-brand-border)'}`,
      }}
    >
      <div className="flex items-center justify-between">
        <span
          className="text-xs font-medium uppercase tracking-widest"
          style={{ color: 'var(--color-brand-muted)' }}
        >
          {label}
        </span>
        {Icon && (
          <Icon size={16} style={{ color: accent ?? 'var(--color-brand-muted)' }} />
        )}
      </div>
      <div>
        <span
          className={`font-bold font-mono ${small ? 'text-xl' : 'text-3xl'}`}
          style={{ color: accent ?? 'var(--color-brand-text)' }}
        >
          {value}
        </span>
        {sub && (
          <p className="text-xs mt-0.5" style={{ color: 'var(--color-brand-muted)' }}>
            {sub}
          </p>
        )}
      </div>
    </div>
  )
}
