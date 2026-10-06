// Business-side controls: AI rules, menu pricing, add dish, per-deal push options, live deal editing.
// Liberal by design: any value is allowed; risky ones (selling below cost) warn instead of block.
import { useState } from 'react'
import { Clock, Minus, Pause, Play, Plus, RotateCcw, SlidersHorizontal, Trash2, TriangleAlert } from 'lucide-react'
import { DEFAULT_RULES, priceAfter } from './engine'
import { cx, rm } from './format'
import { Card } from './ui'

const DURATIONS = [30, 60, 90, 120, 180, 240]
const QUICK_DISCOUNTS = [15, 30, 40, 50, 70]
const CATEGORIES = ['Mains', 'Noodles', 'Sides', 'Drinks', 'Desserts']

const RULE_FIELDS = [
  { group: 'Lunch (12 PM)', key: 'understockAt', label: 'Stockout warning at', min: 0.5, max: 1, step: 0.01, fmt: (v) => `${Math.round(v * 100)}% sold` },
  { group: 'Lunch (12 PM)', key: 'expectedNoon', label: 'Normal sell-through by noon', min: 0.1, max: 0.9, step: 0.05, fmt: (v) => `${Math.round(v * 100)}%` },
  { group: 'Lunch (12 PM)', key: 'prepBoost', label: 'Auto-Prep adds', min: 5, max: 100, step: 5, fmt: (v) => `${v} portions` },
  { group: 'Pre-dinner (5:30 PM)', key: 'surplusAt', label: 'Surplus when more than', min: 0, max: 60, step: 1, fmt: (v) => `${v} left` },
  { group: 'Pre-dinner (5:30 PM)', key: 'surplusDiscount', label: 'Suggested discount', min: 5, max: 90, step: 5, fmt: (v) => `${v}% off` },
  { group: 'Closing (9 PM)', key: 'criticalAt', label: 'Critical when more than', min: 0, max: 60, step: 1, fmt: (v) => `${v} left` },
  { group: 'Closing (9 PM)', key: 'criticalDiscount', label: 'Suggested flash sale', min: 5, max: 90, step: 5, fmt: (v) => `${v}% off` },
  { group: 'Closing (9 PM)', key: 'bagDiscount', label: 'Mystery Bag discount', min: 10, max: 95, step: 5, fmt: (v) => `${v}% off` },
  { group: 'Deals', key: 'promoMinutes', label: 'Default deal lifetime', min: 15, max: 240, step: 15, fmt: (v) => `${v} min` },
]

const field = 'rounded-md border border-slate-200 bg-white px-2 py-1 text-sm tabular-nums shadow-xs transition focus:outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-500/30'
const smallBtn = 'grid place-items-center size-7 rounded-md border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900 active:scale-95 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50 disabled:opacity-40'

export function Slider({ label, value, min, max, step, onChange, display, tone = 'violet', id }) {
  return (
    <label className="block" htmlFor={id}>
      <span className="flex justify-between gap-3 text-xs">
        <span className="text-slate-600">{label}</span>
        <span className="font-semibold tabular-nums text-slate-900">{display ?? value}</span>
      </span>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className={cx('mt-1.5 w-full cursor-pointer', tone === 'emerald' ? 'accent-emerald-600' : tone === 'rose' ? 'accent-rose-600' : 'accent-violet-600')}
      />
    </label>
  )
}

/** Red margin line shown whenever a price drops below food cost. Allowed, never blocked. */
export function MarginNote({ price, cost }) {
  const margin = price - cost
  if (margin >= 0) return <p className="text-xs text-slate-500 tabular-nums">Margin {rm(margin)} per portion</p>
  return (
    <p className="flex items-center gap-1 text-xs font-medium text-rose-700 tabular-nums">
      <TriangleAlert size={12} /> Below cost: {rm(margin)} per portion (still beats binning it)
    </p>
  )
}

export function PricingRules({ rules, onRules, className }) {
  const groups = [...new Set(RULE_FIELDS.map((f) => f.group))]
  const isDefault = Object.entries(DEFAULT_RULES).every(([k, v]) => rules[k] === v)
  return (
    <Card
      id="pricing"
      className={className}
      title={<span className="flex items-center gap-2"><SlidersHorizontal size={17} className="text-violet-600" /> Pricing & AI Rules</span>}
      subtitle="Tune when the engine raises alerts and what it suggests. Changes apply instantly."
      action={
        <button type="button" disabled={isDefault} onClick={() => onRules(DEFAULT_RULES)} className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-slate-600 hover:bg-slate-100 disabled:opacity-40 transition">
          <RotateCcw size={13} /> Defaults
        </button>
      }
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-5 px-5 pb-5">
        {groups.map((g) => (
          <fieldset key={g} className="flex flex-col gap-3">
            <legend className="mb-1 text-[11px] font-medium uppercase tracking-wider text-slate-500">{g}</legend>
            {RULE_FIELDS.filter((f) => f.group === g).map((f) => (
              <Slider
                key={f.key}
                id={`rule-${f.key}`}
                label={f.label}
                value={rules[f.key]}
                min={f.min}
                max={f.max}
                step={f.step}
                display={f.fmt(rules[f.key])}
                onChange={(v) => onRules({ ...rules, [f.key]: v })}
              />
            ))}
          </fieldset>
        ))}
      </div>
    </Card>
  )
}

export function MenuPricing({ inventory, onBulkPrice, onAddDish, className }) {
  const [pct, setPct] = useState(10)
  const [scope, setScope] = useState('All')
  const [dish, setDish] = useState({ name: '', category: 'Mains', price: '', cost: '', prep: '' })
  const categories = ['All', ...new Set(inventory.map((i) => i.category))]

  const addDish = (e) => {
    e.preventDefault()
    const name = dish.name.trim()
    if (!name) return
    onAddDish({ name, category: dish.category, price: Math.max(0, Number(dish.price) || 0), cost: Math.max(0, Number(dish.cost) || 0), prep: Math.max(0, Math.floor(Number(dish.prep) || 0)) })
    setDish({ name: '', category: dish.category, price: '', cost: '', prep: '' })
  }

  return (
    <Card id="menu-pricing" className={className} title="Menu Pricing" subtitle="Bulk price changes and new dishes">
      <div className="px-5 pb-5 flex flex-col gap-5">
        <div className="rounded-lg border border-slate-200 p-3">
          <p className="text-sm font-medium">Adjust prices</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <label className="sr-only" htmlFor="bulk-scope">Category</label>
            <select id="bulk-scope" value={scope} onChange={(e) => setScope(e.target.value)} className={field}>
              {categories.map((c) => <option key={c}>{c}</option>)}
            </select>
            <label className="sr-only" htmlFor="bulk-pct">Percent</label>
            <input id="bulk-pct" type="number" min={1} max={100} value={pct} onChange={(e) => setPct(Math.max(0, Number(e.target.value) || 0))} className={cx(field, 'w-16')} />
            <span className="text-sm text-slate-500">%</span>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <button type="button" onClick={() => onBulkPrice(scope, -pct)} className="flex items-center justify-center gap-1 rounded-md border border-slate-200 px-2 py-1.5 text-sm hover:bg-slate-50 active:scale-[0.98] transition"><Minus size={14} /> Lower</button>
            <button type="button" onClick={() => onBulkPrice(scope, pct)} className="flex items-center justify-center gap-1 rounded-md border border-slate-200 px-2 py-1.5 text-sm hover:bg-slate-50 active:scale-[0.98] transition"><Plus size={14} /> Raise</button>
          </div>
        </div>

        <form onSubmit={addDish} className="rounded-lg border border-slate-200 p-3 flex flex-col gap-2">
          <p className="text-sm font-medium">Add a dish</p>
          <input required aria-label="Dish name" placeholder="Dish name" value={dish.name} onChange={(e) => setDish({ ...dish, name: e.target.value })} className={field} />
          <div className="grid grid-cols-2 gap-2">
            <select aria-label="Category" value={dish.category} onChange={(e) => setDish({ ...dish, category: e.target.value })} className={field}>
              {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
            </select>
            <input aria-label="Portions prepped" type="number" min={0} placeholder="Prepped" value={dish.prep} onChange={(e) => setDish({ ...dish, prep: e.target.value })} className={field} />
            <input aria-label="Price (RM)" type="number" min={0} step={0.1} placeholder="Price RM" value={dish.price} onChange={(e) => setDish({ ...dish, price: e.target.value })} className={field} />
            <input aria-label="Cost (RM)" type="number" min={0} step={0.1} placeholder="Cost RM" value={dish.cost} onChange={(e) => setDish({ ...dish, cost: e.target.value })} className={field} />
          </div>
          <button type="submit" className="mt-1 flex items-center justify-center gap-1.5 rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800 active:scale-[0.98] transition"><Plus size={15} /> Add to menu</button>
        </form>
      </div>
    </Card>
  )
}

/** Push options on an AI card: discount, how many portions, how long. */
export function PushControls({ item, discount, onDiscount, units, onUnits, minutes, onMinutes, tone }) {
  const surplus = Math.max(0, item.prep - item.sold)
  return (
    <div className="mt-3 flex flex-col gap-3 rounded-lg bg-white/70 p-3 ring-1 ring-inset ring-black/5">
      <Slider id={`push-discount-${item.id}`} label="Discount" value={discount} min={0} max={95} step={5} display={`${discount}% off · ${rm(priceAfter(item.price, discount))}`} onChange={onDiscount} tone={tone} />
      <div className="flex flex-wrap gap-1">
        {QUICK_DISCOUNTS.map((d) => (
          <button key={d} type="button" aria-pressed={d === discount} onClick={() => onDiscount(d)} className={cx('rounded-full px-2 py-0.5 text-xs tabular-nums transition', d === discount ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50')}>{d}%</button>
        ))}
      </div>
      <MarginNote price={priceAfter(item.price, discount)} cost={item.cost} />
      <div className="grid grid-cols-2 gap-2">
        <label className="text-xs text-slate-600">
          Portions to list
          <input type="number" min={1} max={surplus} value={units} onChange={(e) => onUnits(Math.max(0, Math.floor(Number(e.target.value) || 0)))} className={cx(field, 'mt-1 w-full')} />
        </label>
        <label className="text-xs text-slate-600">
          Live for
          <select value={minutes} onChange={(e) => onMinutes(Number(e.target.value))} className={cx(field, 'mt-1 w-full')}>
            {DURATIONS.map((m) => <option key={m} value={m}>{m} min</option>)}
          </select>
        </label>
      </div>
    </div>
  )
}

/** One live deal with full controls: reprice, restock, extend, pause, end. */
export function LiveDealRow({ promo, now, onEdit, onEnd }) {
  const [isOpen, setIsOpen] = useState(false)
  const minsLeft = Math.max(0, Math.round((promo.expiresAt - now) / 60_000))
  return (
    <li className={cx('card-in rounded-lg px-2 py-2.5', isOpen ? 'bg-slate-50 ring-1 ring-slate-200' : 'hover:bg-slate-50')}>
      <div className="flex items-center gap-3">
        <span className={cx('grid place-items-center size-9 shrink-0 rounded-lg text-xs font-semibold tabular-nums', promo.paused ? 'bg-slate-100 text-slate-500' : 'bg-emerald-50 text-emerald-700')}>-{promo.discount}%</span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium truncate">{promo.name}{promo.paused && <span className="ml-1.5 text-xs font-normal text-slate-500">(paused)</span>}</p>
          <p className="text-xs text-slate-500 tabular-nums">{promo.units} left at {rm(promo.promoPrice)} · {minsLeft} min left</p>
        </div>
        <button type="button" aria-expanded={isOpen} onClick={() => setIsOpen(!isOpen)} className="rounded-md px-2 py-1 text-xs text-violet-700 hover:bg-violet-50 transition">{isOpen ? 'Done' : 'Edit'}</button>
      </div>
      {isOpen && (
        <div className="mt-3 flex flex-col gap-3 px-1 pb-1">
          <Slider id={`live-discount-${promo.id}`} label="Live discount" value={promo.discount} min={0} max={95} step={5} display={`${promo.discount}% · ${rm(promo.promoPrice)}`} onChange={(d) => onEdit({ discount: d })} tone="emerald" />
          <MarginNote price={promo.promoPrice} cost={promo.cost} />
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-slate-600">Portions</span>
            <button type="button" aria-label="One fewer portion" disabled={promo.units <= 0} onClick={() => onEdit({ units: promo.units - 1 })} className={smallBtn}><Minus size={13} /></button>
            <span className="w-7 text-center text-sm font-semibold tabular-nums">{promo.units}</span>
            <button type="button" aria-label="One more portion" onClick={() => onEdit({ units: promo.units + 1 })} className={smallBtn}><Plus size={13} /></button>
            <button type="button" onClick={() => onEdit({ units: promo.units + 5 })} className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs hover:bg-slate-50 transition">+5</button>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <button type="button" onClick={() => onEdit({ expiresAt: Math.max(promo.expiresAt, now) + 30 * 60_000 })} className="flex items-center justify-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs hover:bg-slate-50 transition"><Clock size={13} /> +30 min</button>
            <button type="button" onClick={() => onEdit({ paused: !promo.paused })} className="flex items-center justify-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs hover:bg-slate-50 transition">
              {promo.paused ? <><Play size={13} /> Resume</> : <><Pause size={13} /> Pause</>}
            </button>
            <button type="button" onClick={onEnd} className="flex items-center justify-center gap-1 rounded-md border border-rose-200 bg-white px-2 py-1.5 text-xs text-rose-700 hover:bg-rose-50 transition"><Trash2 size={13} /> End</button>
          </div>
        </div>
      )}
    </li>
  )
}
