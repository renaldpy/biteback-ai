// Shared UI primitives used by App.jsx and Recovery.jsx.

import { cx } from './format'

export function Card({ id, title, subtitle, action, children, className }) {
  return (
    <section id={id} className={cx('bg-white rounded-xl shadow-sm border border-slate-200 scroll-mt-24', className)}>
      <div className="flex flex-wrap items-start justify-between gap-3 px-5 pt-4 pb-3">
        <div>
          <h2 className="font-semibold tracking-tight">{title}</h2>
          {subtitle && <p className="text-sm text-slate-500">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}

export function Metric({ label, value, className }) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-wide opacity-70">{label}</dt>
      <dd className={cx('font-semibold tabular-nums', className)}>{value}</dd>
    </div>
  )
}
