// Reporting-month selector for the management pages.
//
// Deliberately a plain native <select>, matching every other period
// selector in the portal (AuditDigest's rolling-period dropdown is the
// model). No custom popover: the option list is short, native selects
// get keyboard and screen-reader behavior for free, and they render
// correctly on the phones supervisors actually use on the floor.
//
// Not gated by role — historical data is no more sensitive than current
// data, and the department wall already scopes what any caller can see.
// Page-level access is unchanged (Scorecard and Audit Digest remain
// heads-only routes; this just doesn't add a second gate).
export default function MonthPicker({ value, onChange, options, disabled = false, id }) {
  return (
    <select
      id={id}
      value={value}
      onChange={e => onChange(e.target.value)}
      disabled={disabled || !options?.length}
      aria-label="Reporting month"
      className="px-3 py-2 rounded-lg text-sm outline-none"
      style={{
        background: 'var(--color-brand-surface)',
        border: '1px solid var(--color-brand-border)',
        color: 'var(--color-brand-text)',
        opacity: disabled || !options?.length ? 0.5 : 1,
      }}
    >
      {(options ?? []).map(o => (
        <option key={o.key} value={o.key}>{o.label}</option>
      ))}
    </select>
  )
}
