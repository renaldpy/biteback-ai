// Waste-to-value panels: recovery ladder, close log, impact, forecast, pitch mode.
import { useEffect, useState } from 'react'
import { ArrowLeft, ArrowRight, CalendarCheck, Check, Info, Presentation, X } from 'lucide-react'
import {
  CO2E_PER_KG, FORECAST, KG_PER_UNIT, OPERATING_DAYS, PROMO_SELL_RATE, STAFF_MEAL_CAP, STREAMS,
  SUBSCRIPTION_RM, forecastPrep, sum,
} from './engine'
import { cx, kg, rm, shortName } from './format'
import { Card } from './ui'

const streamById = Object.fromEntries(STREAMS.map((s) => [s.id, s]))

/** Pushes label positions apart so none sit closer than `gap` px, keeping their order. */
function spread(ys, gap) {
  const order = ys.map((y, i) => [y, i]).sort((a, b) => a[0] - b[0])
  const out = [...ys]
  order.forEach(([y, i], n) => {
    out[i] = n === 0 ? y : Math.max(y, out[order[n - 1][1]] + gap)
  })
  return out
}

function RecoverySankey({ flows }) {
  const [hover, setHover] = useState(null)
  const W = 600, H = 260, NODE = 10, GAP = 12, X0 = 112, X1 = W - 150
  const items = [...new Map(flows.map((f) => [f.item.id, f.item])).values()]
  const streams = STREAMS.filter((s) => flows.some((f) => f.stream === s.id))
  const total = sum(flows, (f) => f.units)
  const k = (H - GAP * (Math.max(items.length, streams.length) - 1)) / total

  const stack = (keys, unitsOf) => {
    let y = (H - (total * k + GAP * (keys.length - 1))) / 2
    return Object.fromEntries(keys.map((key) => {
      const node = { y, h: unitsOf(key) * k }
      y += node.h + GAP
      return [key, node]
    }))
  }
  const left = stack(items.map((i) => i.id), (id) => sum(flows.filter((f) => f.item.id === id), (f) => f.units))
  const right = stack(streams.map((s) => s.id), (id) => sum(flows.filter((f) => f.stream === id), (f) => f.units))

  const leftCursor = Object.fromEntries(items.map((i) => [i.id, left[i.id].y]))
  const rightCursor = Object.fromEntries(streams.map((s) => [s.id, right[s.id].y]))
  const links = flows.map((f) => {
    const h = f.units * k
    const y0 = leftCursor[f.item.id]
    const y1 = rightCursor[f.stream]
    leftCursor[f.item.id] += h
    rightCursor[f.stream] += h
    const a = X0 + NODE, b = X1, m = (a + b) / 2
    return { f, d: `M${a},${y0} C${m},${y0} ${m},${y1} ${b},${y1} L${b},${y1 + h} C${m},${y1 + h} ${m},${y0 + h} ${a},${y0 + h} Z` }
  })
  const isLit = (f) => !hover || hover === `i${f.item.id}` || hover === `s${f.stream}`
  const leftLabels = spread(items.map((i) => left[i.id].y + left[i.id].h / 2), 13)
  const rightLabels = spread(streams.map((s) => right[s.id].y + right[s.id].h / 2), 13)

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label="Flow of tonight's surplus portions from each dish to each recovery route">
      {links.map(({ f, d }) => (
        <path
          key={`${f.item.id}-${f.stream}`}
          d={d}
          fill={streamById[f.stream].color}
          fillOpacity={isLit(f) ? 0.38 : 0.08}
          className="transition-[fill-opacity] duration-200"
          onMouseEnter={() => setHover(`s${f.stream}`)}
          onMouseLeave={() => setHover(null)}
        >
          <title>{`${f.item.name} → ${streamById[f.stream].label}: ${f.units} portions (${kg(f.units * KG_PER_UNIT)})`}</title>
        </path>
      ))}
      {items.map((item, n) => (
        <g key={item.id} onMouseEnter={() => setHover(`i${item.id}`)} onMouseLeave={() => setHover(null)}>
          <rect x={X0} y={left[item.id].y} width={NODE} height={Math.max(1, left[item.id].h)} rx={2} className="fill-slate-700" />
          <text x={X0 - 8} y={leftLabels[n]} dy="0.32em" textAnchor="end" className="fill-slate-700 text-[11px]">
            {shortName(item)} <tspan className="fill-slate-400 tabular-nums">{sum(flows.filter((f) => f.item.id === item.id), (f) => f.units)}</tspan>
          </text>
        </g>
      ))}
      {streams.map((s, n) => (
        <g key={s.id} onMouseEnter={() => setHover(`s${s.id}`)} onMouseLeave={() => setHover(null)}>
          <rect x={X1} y={right[s.id].y} width={NODE} height={Math.max(1, right[s.id].h)} rx={2} fill={s.color} />
          <text x={X1 + NODE + 8} y={rightLabels[n]} dy="0.32em" className="fill-slate-800 text-[11px] font-medium">
            {s.label} <tspan className="fill-slate-500 font-normal tabular-nums">{kg(sum(flows.filter((f) => f.stream === s.id), (f) => f.units) * KG_PER_UNIT)}</tspan>
          </text>
        </g>
      ))}
    </svg>
  )
}

function Switch({ checked, onChange, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={onChange}
      className={cx(
        'relative inline-flex h-6 w-10 shrink-0 rounded-full transition-colors duration-200',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/50 focus-visible:ring-offset-2',
        checked ? 'bg-indigo-600' : 'bg-slate-300',
      )}
    >
      <span className={cx('absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow-sm transition-transform duration-200', checked && 'translate-x-4')} />
    </button>
  )
}

export function RecoveryLadder({ flows, summary, partners, onToggle, className }) {
  const pctDiverted = summary.totalKg > 0 ? Math.round((summary.divertedKg / summary.totalKg) * 100) : 0
  return (
    <Card
      id="recovery"
      className={className}
      title="Surplus Recovery Ladder"
      subtitle={summary.totalKg > 0
        ? `If the kitchen closed now: ${kg(summary.divertedKg)} of ${kg(summary.totalKg)} surplus (${pctDiverted}%) stays out of landfill`
        : 'No surplus to route. Every portion has sold.'}
    >
      {summary.totalKg > 0 && <div className="px-3 overflow-x-auto"><div className="min-w-[520px]"><RecoverySankey flows={flows} /></div></div>}
      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 px-5 pb-4 pt-2">
        {STREAMS.map((s, rank) => {
          const routed = summary.byStream[s.id]
          return (
            <li key={s.id} className="flex items-center gap-3 py-2 border-t border-slate-100">
              <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: s.color }} aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">
                  <span className="text-slate-400 tabular-nums mr-1">{rank + 1}.</span>{s.label}
                  <span className="ml-2 text-slate-500 font-normal tabular-nums">{kg(routed.kg)}</span>
                </p>
                <p className="text-xs text-slate-500 truncate">{s.note}</p>
              </div>
              {s.partner
                ? <Switch checked={partners[s.id]} onChange={() => onToggle(s.id)} label={`Route surplus to ${s.label}`} />
                : <span className="text-[11px] uppercase tracking-wide text-slate-400">{s.id === 'sale' ? 'From promos' : 'Fallback'}</span>}
            </li>
          )
        })}
      </ul>
    </Card>
  )
}

function Dumbbell({ label, predicted, actual, max }) {
  const pos = (v) => `${(v / max) * 100}%`
  const hasActual = Number.isFinite(actual)
  const diff = hasActual ? actual - predicted : 0
  return (
    <div>
      <div className="flex justify-between text-xs mb-2">
        <span className="font-medium text-slate-700">{label}</span>
        <span className="tabular-nums text-slate-500">
          {hasActual ? `${diff >= 0 ? '+' : '−'}${kg(Math.abs(diff))} vs forecast` : 'Awaiting log'}
        </span>
      </div>
      <div className="relative h-3">
        <div className="absolute inset-x-0 top-1/2 h-px bg-slate-200" />
        {hasActual && (
          <div className="absolute top-1/2 h-0.5 -translate-y-1/2 bg-slate-400 transition-all duration-300" style={{ left: pos(Math.min(predicted, actual)), width: `${(Math.abs(diff) / max) * 100}%` }} />
        )}
        <div className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-slate-500 bg-white transition-all duration-300" style={{ left: pos(predicted) }} title={`Predicted ${kg(predicted)}`} />
        {hasActual && (
          <div className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-indigo-600 ring-2 ring-white transition-all duration-300" style={{ left: pos(actual) }} title={`Logged ${kg(actual)}`} />
        )}
      </div>
    </div>
  )
}

const toKg = (raw) => (raw === '' ? NaN : Math.max(0, Number(raw)))

export function CloseLog({ summary, log, onLog, className }) {
  const binned = toKg(log.binned)
  const donated = toKg(log.donated)
  const rows = [
    { key: 'binned', label: 'Binned to landfill', predicted: summary.byStream.landfill.kg, actual: binned },
    { key: 'donated', label: 'Collected by food bank', predicted: summary.byStream.donate.kg, actual: donated },
  ]
  const max = Math.max(1, ...rows.flatMap((r) => [r.predicted, Number.isFinite(r.actual) ? r.actual : 0])) * 1.1

  return (
    <Card id="close-log" className={className} title="End-of-day Waste Log" subtitle="Weigh what was actually binned and donated. Impact switches from predicted to measured.">
      <div className="px-5 pb-5 flex flex-col gap-5">
        <div className="grid grid-cols-2 gap-3">
          {rows.map((r) => (
            <label key={r.key} className="text-xs font-medium text-slate-600">
              {r.key === 'binned' ? 'Binned (kg)' : 'Donated (kg)'}
              <input
                type="number"
                inputMode="decimal"
                min={0}
                step={0.1}
                placeholder={r.predicted.toFixed(1)}
                value={log[r.key]}
                onChange={(e) => onLog({ ...log, [r.key]: e.target.value })}
                className="mt-1 w-full rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-sm tabular-nums shadow-xs transition focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/30"
              />
            </label>
          ))}
        </div>
        {rows.map((r) => <Dumbbell key={r.key} {...r} max={max} />)}
        <div className="flex items-center gap-4 text-xs text-slate-500">
          <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full border-2 border-slate-500" /> Predicted</span>
          <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-indigo-600" /> Logged</span>
        </div>
      </div>
    </Card>
  )
}

const ASSUMPTIONS = [
  ['Portion weight', `${KG_PER_UNIT} kg`],
  ['Flash-sale sell-through', `${PROMO_SELL_RATE * 100}% of promo stock`],
  ['Staff meals per close', `${STAFF_MEAL_CAP} portions`],
  ['Emission factor', `${CO2E_PER_KG} kg CO2e per kg kept from landfill`],
  ['Subscription price', `${rm(SUBSCRIPTION_RM)} per outlet per month`],
  ['Operating days', `${OPERATING_DAYS} per month`],
]

export function ImpactPanel({ projection, className }) {
  const tiles = [
    { label: 'Value recovered', value: rm(projection.recoveredRm), note: 'Flash-sale revenue on food already paid for + staff food cost saved' },
    { label: 'Food kept from landfill', value: kg(projection.divertedKg), note: 'Every route except the bin' },
    { label: 'Meals donated', value: projection.meals.toLocaleString('en-MY'), note: 'Portions collected by the food bank' },
    { label: 'Emissions avoided', value: `${kg(projection.co2eKg)} CO2e`, note: 'Estimate, see assumptions' },
  ]
  const scaleMax = Math.max(projection.recoveredRm, SUBSCRIPTION_RM) * 1.15
  const covers = projection.paybackMultiple >= 1

  return (
    <Card
      id="impact"
      className={className}
      title="30-day Impact & Payback"
      subtitle="Today's close, repeated for a month at this outlet"
      action={
        <span className={cx('rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset', projection.isMeasured ? 'bg-indigo-50 text-indigo-700 ring-indigo-600/20' : 'bg-slate-100 text-slate-600 ring-slate-500/20')}>
          {projection.isMeasured ? 'Measured: close log' : 'Predicted'}
        </span>
      }
    >
      <dl className="grid grid-cols-2 xl:grid-cols-4 gap-px bg-slate-100 border-y border-slate-100">
        {tiles.map((t) => (
          <div key={t.label} className="bg-white px-5 py-4">
            <dt className="text-xs text-slate-500">{t.label}</dt>
            <dd className="mt-1 text-xl font-semibold tracking-tight tabular-nums">{t.value}</dd>
            <dd className="text-[11px] text-slate-500">{t.note}</dd>
          </div>
        ))}
      </dl>

      <div className="px-5 py-4">
        <div className="flex flex-wrap justify-between gap-2 text-sm mb-2">
          <span className="font-medium">Payback vs. {rm(SUBSCRIPTION_RM)}/month subscription</span>
          <span className={cx('font-semibold tabular-nums', covers ? 'text-emerald-700' : 'text-rose-700')}>
            {covers ? `Pays for itself ${projection.paybackMultiple.toFixed(1)}×` : `Covers ${Math.round(projection.paybackMultiple * 100)}% of cost`}
          </span>
        </div>
        <div className="relative h-4 rounded-md bg-slate-100" role="img" aria-label={`Monthly value ${rm(projection.recoveredRm)} against subscription ${rm(SUBSCRIPTION_RM)}`}>
          <div className="h-full rounded-md bg-indigo-500 transition-[width] duration-300 ease-out" style={{ width: `${(projection.recoveredRm / scaleMax) * 100}%` }} />
          <div className="absolute -top-1 -bottom-1 w-0.5 bg-slate-900" style={{ left: `${(SUBSCRIPTION_RM / scaleMax) * 100}%` }} />
        </div>
        <div className="mt-1.5 flex gap-4 text-xs text-slate-500">
          <span className="flex items-center gap-1.5"><span className="h-2 w-3 rounded-sm bg-indigo-500" /> Monthly value</span>
          <span className="flex items-center gap-1.5"><span className="h-3 w-0.5 bg-slate-900" /> Subscription</span>
        </div>

        <details className="group mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
          <summary className="flex cursor-pointer items-center gap-2 font-medium marker:content-none">
            <Info size={15} /> Assumptions: replace with sourced figures before the pitch
          </summary>
          <dl className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1">
            {ASSUMPTIONS.map(([k, v]) => (
              <div key={k} className="flex justify-between gap-3 border-t border-amber-200/70 py-1">
                <dt>{k}</dt><dd className="tabular-nums font-medium">{v}</dd>
              </div>
            ))}
          </dl>
        </details>
      </div>
    </Card>
  )
}

export function ForecastPanel({ inventory, onApply, className }) {
  const rows = inventory.map((item) => ({ item, today: item.prep, next: forecastPrep(item) }))
  const W = 300, H = 230, P = { t: 22, b: 12 }, XL = 44, XR = W - 110
  const max = Math.max(1, ...rows.flatMap((r) => [r.today, r.next]))
  const sy = (v) => H - P.b - (v / max) * (H - P.t - P.b)
  const leftY = spread(rows.map((r) => sy(r.today)), 12)
  const rightY = spread(rows.map((r) => sy(r.next)), 12)
  const todayTotal = sum(rows, (r) => r.today)
  const nextTotal = sum(rows, (r) => r.next)
  const cut = todayTotal - nextTotal

  return (
    <Card
      id="forecast"
      className={className}
      title="Tomorrow's Prep Plan"
      subtitle={`Today's demand + ${FORECAST.buffer * 100}% buffer, in batches of ${FORECAST.batch}. Sell-outs get +${FORECAST.soldOutUplift * 100}%.`}
    >
      <div className="px-3">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label="Slope chart of portions prepped today versus planned for tomorrow, per dish">
          <text x={XL} y={10} textAnchor="middle" className="fill-slate-500 text-[10px] uppercase tracking-wider">Today</text>
          <text x={XR} y={10} textAnchor="middle" className="fill-slate-500 text-[10px] uppercase tracking-wider">Tomorrow</text>
          <line x1={XL} x2={XL} y1={P.t - 4} y2={H - P.b} className="stroke-slate-200" />
          <line x1={XR} x2={XR} y1={P.t - 4} y2={H - P.b} className="stroke-slate-200" />
          {rows.map((r, n) => {
            const down = r.next < r.today
            return (
              <g key={r.item.id}>
                <line x1={XL} y1={sy(r.today)} x2={XR} y2={sy(r.next)} strokeWidth={2} className={cx(down ? 'stroke-indigo-500' : 'stroke-slate-400', 'transition-all duration-300')} />
                <circle cx={XL} cy={sy(r.today)} r={4} className="fill-slate-400 stroke-white" strokeWidth={2} />
                <circle cx={XR} cy={sy(r.next)} r={4} className={cx(down ? 'fill-indigo-500' : 'fill-slate-400', 'stroke-white')} strokeWidth={2} />
                <text x={XL - 8} y={leftY[n]} dy="0.32em" textAnchor="end" className="fill-slate-500 text-[10px] tabular-nums">{r.today}</text>
                <text x={XR + 8} y={rightY[n]} dy="0.32em" className="fill-slate-800 text-[10px]">
                  <tspan className="font-semibold tabular-nums">{r.next}</tspan> {shortName(r.item)}
                </text>
              </g>
            )
          })}
        </svg>
      </div>
      <div className="px-5 pb-5">
        <p className="text-sm text-slate-600">
          Prep <span className="font-semibold text-slate-900 tabular-nums">{nextTotal}</span> portions
          {cut > 0
            ? <> (<span className="tabular-nums">−{cut}</span>), about <span className="font-semibold text-slate-900">{kg(cut * KG_PER_UNIT)}</span> less food at risk.</>
            : <> (<span className="tabular-nums">+{-cut}</span>) to avoid stockouts.</>}
        </p>
        <button
          type="button"
          onClick={() => onApply(rows)}
          className="mt-3 w-full flex items-center justify-center gap-2 rounded-lg bg-slate-900 text-white px-3 py-2 text-sm font-semibold shadow-sm hover:bg-slate-800 active:scale-[0.98] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/50 focus-visible:ring-offset-2"
        >
          <CalendarCheck size={16} /> Start tomorrow with this plan
        </button>
      </div>
    </Card>
  )
}

export function PitchButton({ onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-2 rounded-full bg-slate-900 text-white px-3 py-1.5 text-sm font-medium shadow-sm hover:bg-slate-800 active:scale-[0.97] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/50 focus-visible:ring-offset-2"
    >
      <Presentation size={15} /> <span className="hidden sm:inline">Pitch mode</span>
    </button>
  )
}

export function PitchBar({ steps, step, onStep, onExit }) {
  const current = steps[step]
  const isLast = step === steps.length - 1

  useEffect(() => {
    const onKey = (e) => {
      if (e.target.closest?.('input, select, textarea')) return
      if (e.key === 'ArrowRight' && !isLast) onStep(step + 1)
      if (e.key === 'ArrowLeft' && step > 0) onStep(step - 1)
      if (e.key === 'Escape') onExit()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [step, isLast, onStep, onExit])

  const navBtn = 'grid place-items-center size-9 rounded-full transition active:scale-[0.94] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 disabled:opacity-30 disabled:pointer-events-none'
  return (
    <div className="fixed inset-x-0 bottom-4 z-40 flex justify-center px-4 pointer-events-none">
      <div role="region" aria-label="Pitch walkthrough" className="glass-dark pointer-events-auto w-full max-w-2xl rounded-2xl bg-slate-900/90 backdrop-blur-md text-white shadow-2xl shadow-slate-900/30 ring-1 ring-white/10 p-3 pl-5 flex items-center gap-4">
        <div key={step} className="card-in min-w-0 flex-1" aria-live="polite">
          <p className="text-[11px] uppercase tracking-wider text-indigo-300 tabular-nums">Step {step + 1} of {steps.length} · {current.title}</p>
          <p className="text-sm text-slate-100 leading-snug">{current.caption}</p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button type="button" aria-label="Previous step" disabled={step === 0} onClick={() => onStep(step - 1)} className={cx(navBtn, 'hover:bg-white/10')}>
            <ArrowLeft size={17} />
          </button>
          <button type="button" aria-label={isLast ? 'Finish pitch' : 'Next step'} onClick={() => (isLast ? onExit() : onStep(step + 1))} className={cx(navBtn, 'bg-indigo-500 hover:bg-indigo-400')}>
            {isLast ? <Check size={17} /> : <ArrowRight size={17} />}
          </button>
          <button type="button" aria-label="Exit pitch mode" onClick={onExit} className={cx(navBtn, 'text-slate-400 hover:text-white hover:bg-white/10')}>
            <X size={15} />
          </button>
        </div>
      </div>
    </div>
  )
}
