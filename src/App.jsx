import { useEffect, useRef, useState } from 'react'
import {
  Boxes, CalendarClock, ChefHat, CircleCheck, Clock, Flame, Gift, LayoutDashboard, Leaf, LogOut, MapPin,
  Menu, Recycle, RefreshCw, RotateCcw, Send, Smartphone, Sparkles, TrendingDown, TrendingUp, TriangleAlert,
  Wallet, X, Zap,
} from 'lucide-react'
import {
  BAG_DISCOUNT, KG_PER_UNIT, analyzeStock, makePromo, projectMonthly, routeSurplus, sellThrough, sum,
  summarizeRecovery,
} from './engine'
import { CloseLog, ForecastPanel, ImpactPanel, PitchButton, RecoveryLadder } from './Recovery'
import { cx, rm, shortName } from './format'
import { EMPTY_LOG } from './store'
import { Card, Metric } from './ui'

const TIMES = ['12:00 PM', '5:30 PM', '9:00 PM']
const SERVICE_PHASE = { '12:00 PM': 'Lunch rush', '5:30 PM': 'Pre-dinner', '9:00 PM': 'Closing window' }
const DISCOUNTS = [15, 30, 40, 50]
const BRANCHES = ['Mid Valley', 'Sunway Pyramid', 'KLCC']

const NAV = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'inventory', label: 'Live Inventory', icon: Boxes },
  { id: 'sync', label: 'Live Promos', icon: RefreshCw },
  { id: 'recovery', label: 'Recovery Ladder', icon: Recycle },
  { id: 'impact', label: 'Impact', icon: Leaf },
  { id: 'forecast', label: "Tomorrow's Prep", icon: CalendarClock },
]

const STATUS_BADGE = {
  optimal: { label: 'Optimal', className: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20' },
  understock: { label: 'Low stock', className: 'bg-amber-50 text-amber-800 ring-amber-600/25' },
  overstock: { label: 'Surplus', className: 'bg-rose-50 text-rose-700 ring-rose-600/20' },
  overstock_critical: { label: 'Critical', className: 'bg-violet-600 text-white ring-violet-700' },
}

const clampInt = (raw, max = Infinity) => Math.min(max, Math.max(0, Math.floor(Number(raw) || 0)))

export default function RestaurantDashboard({ store }) {
  const {
    timeOfDay, setTimeOfDay, inventory, setInventory, activePromos, setActivePromos, notify,
    discounts, setDiscounts, category, setCategory, partners, setPartners, closeLog, setCloseLog,
    pitchStep, resetDemo, goToPitchStep, setCurrentView,
  } = store
  const [activeNav, setActiveNav] = useState('dashboard')
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  const analyses = inventory.map((item) => ({ item, status: analyzeStock(item, timeOfDay) }))
  const promoById = new Map(activePromos.map((p) => [p.id, p]))
  const insights = analyses.filter(({ item, status }) => status.type !== 'optimal' || promoById.has(item.id))

  const updateItem = (id, field, raw) =>
    setInventory((inv) => inv.map((item) => {
      if (item.id !== id) return item
      if (field === 'sold') return { ...item, sold: clampInt(raw, item.prep) }
      const prep = clampInt(raw)
      return { ...item, prep, sold: Math.min(item.sold, prep) }
    }))

  const autoPrep = (id) =>
    setInventory((inv) => inv.map((item) => (item.id === id ? { ...item, prep: item.prep + 20 } : item)))

  const flows = routeSurplus(inventory, activePromos, partners)
  const recovery = summarizeRecovery(flows)
  const projection = projectMonthly(recovery, closeLog.binned === '' ? NaN : Math.max(0, Number(closeLog.binned)))

  const pushPromo = (item, discount, isBag = false) => {
    if (promoById.has(item.id)) return
    const promo = makePromo(item, isBag ? BAG_DISCOUNT : discount, timeOfDay, { isBag })
    setActivePromos((promos) => [...promos, promo])
    notify('Live on the BiteBack customer app', `${promo.name} · ${promo.discount}% off`)
  }

  const endPromo = (promo) => {
    setActivePromos((promos) => promos.filter((p) => p.id !== promo.id))
    notify('Promo withdrawn from the customer app', promo.name)
  }

  const startTomorrow = (rows) => {
    setInventory(rows.map(({ item, next }) => ({ ...item, prep: next, sold: 0 })))
    setActivePromos([])
    setCloseLog(EMPTY_LOG)
    setDiscounts({})
    setTimeOfDay('12:00 PM')
    notify("Tomorrow's prep plan loaded", `${sum(rows, (r) => r.next)} portions across ${rows.length} dishes`)
    window.scrollTo({ top: 0 })
  }

  return (
    <div className="min-h-screen bg-slate-50 flex text-slate-900">
      <Sidebar active={activeNav} onNavigate={setActiveNav} onReset={resetDemo} onSwitch={setCurrentView} />
      <MobileNav
        open={isMenuOpen}
        onClose={() => setIsMenuOpen(false)}
        active={activeNav}
        onNavigate={setActiveNav}
        onReset={resetDemo}
        onSwitch={setCurrentView}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <Header
          timeOfDay={timeOfDay}
          onTimeChange={setTimeOfDay}
          onMenu={() => setIsMenuOpen(true)}
          onPitch={() => goToPitchStep(0)}
        />

        <main id="dashboard" className="flex-1 px-4 sm:px-6 lg:px-8 py-6 scroll-mt-24">
          <KpiRow inventory={inventory} activePromos={activePromos} />

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
            <div className="lg:col-span-2 flex flex-col gap-6 min-w-0">
              <InventoryTable
                analyses={analyses}
                category={category}
                onCategory={setCategory}
                onUpdate={updateItem}
              />
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                <MenuMatrix inventory={inventory} />
                <WasteExposure inventory={inventory} />
              </div>
            </div>

            <div className="flex flex-col gap-6 min-w-0">
              <ActionCenter
                insights={insights}
                promoById={promoById}
                discounts={discounts}
                onDiscount={(id, pct) => setDiscounts((d) => ({ ...d, [id]: pct }))}
                onPrep={autoPrep}
                onPush={pushPromo}
              />
              <SyncPanel activePromos={activePromos} onEnd={endPromo} />
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 items-start gap-6 mt-6">
            <RecoveryLadder
              className="lg:col-span-2 min-w-0"
              flows={flows}
              summary={recovery}
              partners={partners}
              onToggle={(id) => setPartners((p) => ({ ...p, [id]: !p[id] }))}
            />
            <CloseLog className="min-w-0" summary={recovery} log={closeLog} onLog={setCloseLog} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 items-start gap-6 mt-6">
            <ImpactPanel className="lg:col-span-2 min-w-0" projection={projection} />
            <ForecastPanel className="min-w-0" inventory={inventory} onApply={startTomorrow} />
          </div>
          {pitchStep !== null && <div className="h-28" aria-hidden />}
        </main>
      </div>

    </div>
  )
}

function Sidebar(props) {
  return (
    <aside className="hidden lg:flex w-64 shrink-0 flex-col bg-slate-900 text-slate-300 sticky top-0 h-screen">
      <SidebarBody {...props} />
    </aside>
  )
}

// Native <dialog> gives Escape-to-close, focus trapping and an inert page for free.
function MobileNav({ open, onClose, onNavigate, ...props }) {
  const ref = useRef(null)

  useEffect(() => {
    const dialog = ref.current
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      aria-label="Navigation"
      onClose={onClose}
      onClick={(e) => e.target === e.currentTarget && onClose()}
      className="drawer-in lg:hidden m-0 h-dvh max-h-none w-72 max-w-[85vw] open:flex flex-col bg-slate-900 text-slate-300 backdrop:bg-slate-900/40 backdrop:backdrop-blur-sm"
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Close menu"
        className="absolute top-4 right-3 rounded-md p-1.5 text-slate-400 hover:text-white hover:bg-white/10 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
      >
        <X size={18} />
      </button>
      <SidebarBody
        {...props}
        onNavigate={(id) => { onNavigate(id); onClose() }}
      />
    </dialog>
  )
}

function SidebarBody({ active, onNavigate, onReset, onSwitch }) {
  return (
    <>
      <div className="flex items-center gap-2.5 px-5 h-16 border-b border-white/5">
        <span className="grid place-items-center size-8 rounded-lg bg-violet-600 text-white">
          <ChefHat size={18} />
        </span>
        <span className="font-semibold tracking-tight text-white">BiteBack <span className="text-violet-400">AI</span></span>
      </div>

      <nav aria-label="Primary" className="flex flex-col gap-1 p-3">
        {NAV.map(({ id, label, icon: Icon }) => (
          <a
            key={id}
            href={`#${id}`}
            onClick={() => onNavigate(id)}
            aria-current={active === id ? 'page' : undefined}
            className={cx(
              'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400',
              active === id ? 'bg-violet-600 text-white' : 'hover:bg-white/5 hover:text-white',
            )}
          >
            <Icon size={17} />
            {label}
          </a>
        ))}
      </nav>

      <div className="mt-auto p-4 flex flex-col gap-3">
        <div className="rounded-xl bg-white/5 p-3 text-xs">
          <div className="flex items-center gap-2 text-slate-200 font-medium">
            <span className="size-2 rounded-full bg-emerald-400 shadow-[0_0_0_3px] shadow-emerald-400/20" />
            Customer app connected
          </div>
          <p className="mt-1 text-slate-400">Live feed · Partner #MV-0412</p>
        </div>
        <button
          type="button"
          onClick={() => onSwitch('customer')}
          className="flex items-center justify-center gap-2 rounded-lg bg-emerald-500/15 px-3 py-2 text-xs font-medium text-emerald-300 hover:bg-emerald-500/25 active:scale-[0.98] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
        >
          <Smartphone size={14} /> Open customer app
        </button>
        <button
          type="button"
          onClick={onReset}
          className="flex items-center justify-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs text-slate-300 hover:bg-white/5 hover:text-white active:scale-[0.98] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
        >
          <RotateCcw size={14} /> Reset demo
        </button>
        <button
          type="button"
          onClick={() => onSwitch('auth')}
          className="flex items-center justify-center gap-2 rounded-lg px-3 py-1.5 text-xs text-slate-400 hover:text-white transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
        >
          <LogOut size={14} /> Log out
        </button>
      </div>
    </>
  )
}

function Header({ timeOfDay, onTimeChange, onMenu, onPitch }) {
  const [branch, setBranch] = useState(BRANCHES[0])
  return (
    <header className="glass sticky top-0 z-20 bg-slate-50/80 backdrop-blur-md border-b border-slate-200/70">
      <div className="flex flex-wrap items-center justify-between gap-4 px-4 sm:px-6 lg:px-8 h-auto min-h-16 py-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onMenu}
            aria-label="Open menu"
            className="lg:hidden -ml-1 rounded-lg p-2 text-slate-600 hover:bg-slate-200/60 hover:text-slate-900 active:scale-[0.96] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50"
          >
            <Menu size={20} />
          </button>
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
              <span className="lg:hidden text-violet-600">BiteBack AI · </span>{SERVICE_PHASE[timeOfDay]}
            </p>
            <h1 className="text-xl font-semibold tracking-tight">
              <label htmlFor="branch" className="sr-only">Branch</label>
              <span className="relative inline-flex items-center">
                <MapPin size={16} className="absolute left-0 text-violet-600 pointer-events-none" aria-hidden />
                <select
                  id="branch"
                  value={branch}
                  onChange={(e) => setBranch(e.target.value)}
                  className="appearance-none bg-transparent pl-5 pr-1 font-semibold tracking-tight rounded-md cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50"
                >
                  {BRANCHES.map((b, i) => <option key={b} value={b} disabled={i > 0}>{b} Outlet{i > 0 ? ' (onboarding)' : ''}</option>)}
                </select>
              </span>
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Clock size={16} className="text-slate-400" aria-hidden />
          <div role="group" aria-label="Simulated time of day" className="bg-white border border-slate-200 rounded-full p-1 flex shadow-sm">
            {TIMES.map((time) => (
              <button
                key={time}
                type="button"
                aria-pressed={time === timeOfDay}
                onClick={() => onTimeChange(time)}
                className={cx(
                  'rounded-full px-3 py-1.5 text-sm tabular-nums transition active:scale-[0.97]',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50',
                  time === timeOfDay ? 'bg-violet-100 text-violet-700 font-medium' : 'text-slate-600 hover:text-slate-900',
                )}
              >
                {time}
              </button>
            ))}
          </div>
          <PitchButton onClick={onPitch} />
        </div>
      </div>
    </header>
  )
}

function KpiRow({ inventory, activePromos }) {
  const units = sum(activePromos, (p) => p.units)
  const cards = [
    { label: 'Gross Revenue', value: rm(sum(inventory, (i) => i.sold * i.price)), note: `${sum(inventory, (i) => i.sold)} portions sold`, icon: TrendingUp, tint: 'bg-violet-50 text-violet-600' },
    { label: 'Waste Diverted', value: `${(units * KG_PER_UNIT).toFixed(1)} kg food saved`, note: `${units} portions on promo`, icon: Leaf, tint: 'bg-emerald-50 text-emerald-600' },
    { label: 'Recovered Margin', value: rm(sum(activePromos, (p) => p.units * p.promoPrice)), note: 'If promo stock sells through', icon: Wallet, tint: 'bg-sky-50 text-sky-600' },
    { label: 'Live App Promos', value: activePromos.length, note: activePromos.length ? 'Live on the customer app' : 'None live yet', icon: Zap, tint: 'bg-violet-50 text-violet-600' },
  ]
  return (
    <section aria-label="Key metrics" className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      {cards.map(({ label, value, note, icon: Icon, tint }) => (
        <div key={label} className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-500">{label}</span>
            <span className={cx('grid place-items-center size-8 rounded-lg', tint)}><Icon size={16} /></span>
          </div>
          <span className="text-2xl font-semibold tracking-tight tabular-nums">{value}</span>
          <span className="text-xs text-slate-500">{note}</span>
        </div>
      ))}
    </section>
  )
}

function StatusBadge({ type }) {
  const { label, className } = STATUS_BADGE[type]
  return <span className={cx('inline-flex rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset whitespace-nowrap', className)}>{label}</span>
}

function NumberInput({ label, value, max, onChange }) {
  return (
    <input
      type="number"
      inputMode="numeric"
      min={0}
      max={max}
      aria-label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-16 rounded-md border border-slate-200 bg-white px-2 py-1 text-sm tabular-nums shadow-xs transition focus:outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-500/30"
    />
  )
}

function InventoryTable({ analyses, category, onCategory, onUpdate }) {
  const categories = ['All', ...new Set(analyses.map(({ item }) => item.category))]
  const rows = analyses.filter(({ item }) => category === 'All' || item.category === category)
  const chips = (
    <div role="group" aria-label="Filter by category" className="flex flex-wrap gap-1.5">
      {categories.map((c) => (
        <button
          key={c}
          type="button"
          aria-pressed={c === category}
          onClick={() => onCategory(c)}
          className={cx(
            'rounded-full px-2.5 py-1 text-xs transition active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50',
            c === category ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
          )}
        >
          {c}
        </button>
      ))}
    </div>
  )

  return (
    <Card id="inventory" title="Inventory Manager" subtitle="Edit prepped and sold counts. Insights update live." action={chips}>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-y border-slate-100 bg-slate-50/60 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
              {['Item', 'Cost', 'Price', 'Prepped', 'Sold', 'Remaining', 'Status'].map((h) => (
                <th key={h} scope="col" className="px-3 py-2.5 font-medium first:pl-5 last:pr-5">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map(({ item, status }) => {
              const pct = Math.round(sellThrough(item) * 100)
              return (
                <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="pl-5 pr-3 py-3">
                    <div className="font-medium whitespace-nowrap">{item.name}</div>
                    <div className="text-xs text-slate-500">{item.category}</div>
                  </td>
                  <td className="px-3 py-3 tabular-nums text-slate-500">{rm(item.cost)}</td>
                  <td className="px-3 py-3 tabular-nums">{rm(item.price)}</td>
                  <td className="px-3 py-3">
                    <NumberInput label={`${item.name} prepped`} value={item.prep} onChange={(v) => onUpdate(item.id, 'prep', v)} />
                  </td>
                  <td className="px-3 py-3">
                    <NumberInput label={`${item.name} sold`} value={item.sold} max={item.prep} onChange={(v) => onUpdate(item.id, 'sold', v)} />
                  </td>
                  <td className="px-3 py-3 min-w-32">
                    <div className="flex justify-between text-xs tabular-nums mb-1">
                      <span className="font-medium">{item.prep - item.sold} left</span>
                      <span className="text-slate-500">{pct}% sold</span>
                    </div>
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden" role="progressbar" aria-label={`${item.name} sell-through`} aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
                      <div className="bg-violet-500 h-full rounded-full transition-[width] duration-300 ease-out" style={{ width: `${pct}%` }} />
                    </div>
                  </td>
                  <td className="pl-3 pr-5 py-3"><StatusBadge type={status.type} /></td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

function MenuMatrix({ inventory }) {
  const [hoverId, setHoverId] = useState(null)
  const W = 340, H = 240, P = { l: 38, r: 12, t: 14, b: 32 }
  const points = inventory.map((item) => ({ item, x: sellThrough(item) * 100, y: item.price - item.cost }))
  const yMax = Math.ceil(Math.max(...points.map((p) => p.y), 1) / 5) * 5
  const avgX = sum(points, (p) => p.x) / points.length
  const avgY = sum(points, (p) => p.y) / points.length
  const sx = (v) => P.l + (v / 100) * (W - P.l - P.r)
  const sy = (v) => H - P.b - (v / yMax) * (H - P.t - P.b)
  const hovered = points.find((p) => p.item.id === hoverId)
  const quadrants = [
    { label: 'Puzzles', x: P.l + 6, y: P.t + 12, anchor: 'start' },
    { label: 'Stars', x: W - P.r - 6, y: P.t + 12, anchor: 'end' },
    { label: 'Dogs', x: P.l + 6, y: H - P.b - 8, anchor: 'start' },
    { label: 'Plowhorses', x: W - P.r - 6, y: H - P.b - 8, anchor: 'end' },
  ]

  return (
    <Card title="Menu Engineering Matrix" subtitle="Unit margin vs. sell-through. Dashed lines mark the menu average.">
      <div className="relative px-3 pb-4">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label="Scatter plot of unit margin against sell-through for each menu item">
          {[0, yMax / 2, yMax].map((t) => (
            <g key={t}>
              <line x1={P.l} x2={W - P.r} y1={sy(t)} y2={sy(t)} className="stroke-slate-100" />
              <text x={P.l - 6} y={sy(t)} dy="0.32em" textAnchor="end" className="fill-slate-400 text-[10px] tabular-nums">RM{t}</text>
            </g>
          ))}
          {[0, 50, 100].map((t) => (
            <text key={t} x={sx(t)} y={H - P.b + 14} textAnchor="middle" className="fill-slate-400 text-[10px] tabular-nums">{t}%</text>
          ))}
          <text x={(P.l + W - P.r) / 2} y={H - 4} textAnchor="middle" className="fill-slate-500 text-[10px]">Sell-through</text>
          <line x1={sx(avgX)} x2={sx(avgX)} y1={P.t} y2={H - P.b} className="stroke-slate-300" strokeDasharray="3 3" />
          <line x1={P.l} x2={W - P.r} y1={sy(avgY)} y2={sy(avgY)} className="stroke-slate-300" strokeDasharray="3 3" />
          {quadrants.map((q) => (
            <text key={q.label} x={q.x} y={q.y} textAnchor={q.anchor} className="fill-slate-400 text-[10px] font-medium uppercase tracking-wider">{q.label}</text>
          ))}
          {points.map(({ item, x, y }) => {
            const right = x < 60
            return (
              <g key={item.id} onMouseEnter={() => setHoverId(item.id)} onMouseLeave={() => setHoverId(null)} className="cursor-default">
                <circle cx={sx(x)} cy={sy(y)} r={14} fill="transparent" />
                <circle cx={sx(x)} cy={sy(y)} r={hoverId === item.id ? 6.5 : 5} className="fill-violet-500 stroke-white transition-all" strokeWidth={2} />
                <text x={sx(x) + (right ? 9 : -9)} y={sy(y)} dy="0.32em" textAnchor={right ? 'start' : 'end'} className="fill-slate-700 text-[10px] font-medium">{shortName(item)}</text>
              </g>
            )
          })}
        </svg>
        {hovered && (
          <div
            className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-lg bg-slate-900 px-2.5 py-1.5 text-xs text-white shadow-lg"
            style={{ left: `${(sx(hovered.x) / W) * 100}%`, top: `calc(${(sy(hovered.y) / H) * 100}% - 10px)` }}
          >
            <div className="font-medium whitespace-nowrap">{hovered.item.name}</div>
            <div className="text-slate-300 tabular-nums whitespace-nowrap">{rm(hovered.y)} margin · {Math.round(hovered.x)}% sold</div>
          </div>
        )}
      </div>
    </Card>
  )
}

function WasteExposure({ inventory }) {
  const rows = inventory
    .map((item) => ({ item, left: item.prep - item.sold, risk: (item.prep - item.sold) * item.cost }))
    .sort((a, b) => b.risk - a.risk)
  const max = Math.max(...rows.map((r) => r.risk), 1)

  return (
    <Card title="Waste Exposure" subtitle={`${rm(sum(rows, (r) => r.risk))} of unsold food cost on hand`}>
      <ul className="px-5 pb-5 flex flex-col gap-3">
        {rows.map(({ item, left, risk }) => (
          <li key={item.id} className="group">
            <div className="flex justify-between text-xs mb-1">
              <span className="font-medium text-slate-700">{shortName(item)}</span>
              <span className="tabular-nums text-slate-900 font-medium">{rm(risk)}</span>
            </div>
            <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
              <div className="h-full rounded-full bg-slate-700 group-hover:bg-violet-500 transition-[width,background-color] duration-300 ease-out" style={{ width: `${(risk / max) * 100}%` }} />
            </div>
            <p className="mt-1 text-[11px] text-slate-500 tabular-nums">{left} portions × {rm(item.cost)} cost</p>
          </li>
        ))}
      </ul>
    </Card>
  )
}

function ActionCenter({ insights, promoById, discounts, onDiscount, onPrep, onPush }) {
  return (
    <Card
      id="insights"
      title={<span className="flex items-center gap-2">AI Insights Engine <Sparkles size={18} className="text-violet-500 animate-pulse" aria-hidden /></span>}
      subtitle={`${insights.length} ${insights.length === 1 ? 'action' : 'actions'} recommended`}
    >
      <div className="px-4 pb-4 flex flex-col gap-3" aria-live="polite">
        {insights.length === 0 && (
          <div className="card-in rounded-xl border border-dashed border-slate-200 p-6 text-center">
            <CircleCheck className="mx-auto text-emerald-500" size={24} />
            <p className="mt-2 text-sm font-medium">All stock looks good</p>
            <p className="text-xs text-slate-500">Change the time or edit counts to see new suggestions.</p>
          </div>
        )}
        {insights.map(({ item, status }) => {
          const promo = promoById.get(item.id)
          return status.type === 'understock' && !promo
            ? <UnderstockCard key={item.id} item={item} status={status} onPrep={onPrep} />
            : <OverstockCard key={item.id} item={item} status={status} promo={promo} discount={discounts[item.id] ?? status.discount ?? 15} onDiscount={onDiscount} onPush={onPush} />
        })}
      </div>
    </Card>
  )
}

function UnderstockCard({ item, status, onPrep }) {
  return (
    <article className="card-in rounded-xl border border-amber-200 bg-amber-50 p-4">
      <div className="flex items-start gap-3">
        <span className="grid place-items-center size-8 shrink-0 rounded-lg bg-amber-100 text-amber-700"><TriangleAlert size={16} /></span>
        <div className="min-w-0">
          <h3 className="font-medium leading-snug">{item.name}</h3>
          <p className="text-sm text-amber-900">{status.message} Suggestion: {status.suggestedAction}.</p>
        </div>
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-2 text-sm text-amber-950">
        <Metric label="Sell-through" value={`${Math.round(sellThrough(item) * 100)}%`} />
        <Metric label="Left" value={`${item.prep - item.sold} portions`} />
      </dl>
      <button
        type="button"
        onClick={() => onPrep(item.id)}
        className="mt-3 w-full flex items-center justify-center gap-2 rounded-lg bg-amber-500 text-amber-950 px-3 py-2 text-sm font-semibold shadow-sm hover:bg-amber-400 active:scale-[0.98] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/50 focus-visible:ring-offset-2"
      >
        <ChefHat size={16} /> Auto-Prep +20
      </button>
    </article>
  )
}

function OverstockCard({ item, status, promo, discount, onDiscount, onPush }) {
  const isCritical = status.type === 'overstock_critical'
  const left = promo ? promo.units : item.prep - item.sold
  const pct = promo ? promo.discount : discount
  const Icon = isCritical ? Flame : TrendingDown
  const selectId = `discount-${item.id}`
  const tone = isCritical
    ? { card: 'border-violet-200 bg-violet-50', icon: 'bg-violet-100 text-violet-700', text: 'text-violet-900', ink: 'text-violet-950', field: 'border-violet-200 focus:ring-violet-500/30' }
    : { card: 'border-rose-200 bg-rose-50', icon: 'bg-rose-100 text-rose-700', text: 'text-rose-900', ink: 'text-rose-950', field: 'border-rose-200 focus:ring-rose-500/30' }
  const pushBtn = 'w-full flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold shadow-sm active:scale-[0.98] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2'

  return (
    <article className={cx('card-in rounded-xl border p-4', tone.card)}>
      <div className="flex items-start gap-3">
        <span className={cx('grid place-items-center size-8 shrink-0 rounded-lg', tone.icon)}><Icon size={16} /></span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-medium leading-snug">{item.name}</h3>
            {isCritical && <StatusBadge type="overstock_critical" />}
          </div>
          <p className={cx('text-sm', tone.text)}>
            {promo ? `${promo.isBag ? 'Mystery Bag' : 'Flash sale'} live since ${promo.pushedAt}.` : `${status.message} Suggestion: ${status.suggestedAction}.`}
          </p>
        </div>
      </div>

      <dl className={cx('mt-3 grid grid-cols-3 gap-2 text-sm', tone.ink)}>
        <Metric label="Loss risk" value={rm(left * item.cost)} />
        <Metric label="Surplus" value={left} />
        <Metric label="App price" value={rm(Math.round(item.price * (100 - pct)) / 100)} />
      </dl>

      {!promo && (
        <div className="mt-3 flex items-center gap-2">
          <label htmlFor={selectId} className={cx('text-xs font-medium', tone.text)}>Discount</label>
          <select
            id={selectId}
            value={pct}
            onChange={(e) => onDiscount(item.id, Number(e.target.value))}
            className={cx('flex-1 rounded-md border bg-white px-2 py-1.5 text-sm tabular-nums focus:outline-none focus:ring-2', tone.field)}
          >
            {DISCOUNTS.map((d) => (
              <option key={d} value={d}>{d}% off{d === status.discount ? ' (suggested)' : ''}</option>
            ))}
          </select>
        </div>
      )}

      {promo ? (
        <button type="button" disabled className="mt-3 w-full flex items-center justify-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 px-3 py-2 text-sm font-semibold cursor-not-allowed">
          <CircleCheck size={16} /> Live on App · {promo.units} left
        </button>
      ) : (
        <div className="mt-3 flex flex-col gap-2">
          <button type="button" onClick={() => onPush(item, pct)} className={cx(pushBtn, 'bg-emerald-600 text-white hover:bg-emerald-700 focus-visible:ring-emerald-500/50')}>
            <Send size={15} /> Push to Customer App
          </button>
          {isCritical && (
            <button type="button" onClick={() => onPush(item, pct, true)} className={cx(pushBtn, 'border border-violet-300 bg-white text-violet-700 hover:bg-violet-100 focus-visible:ring-violet-500/50')}>
              <Gift size={15} /> Push as Mystery Bag ({BAG_DISCOUNT}% off)
            </button>
          )}
        </div>
      )}
    </article>
  )
}

function SyncPanel({ activePromos, onEnd }) {
  return (
    <Card id="sync" title="Live on Customer App" subtitle="Deals customers can order right now">
      {activePromos.length === 0 ? (
        <p className="px-5 pb-5 text-sm text-slate-500">Nothing live yet. Push a surplus item from the AI Insights Engine.</p>
      ) : (
        <ul className="px-3 pb-3">
          {activePromos.map((promo) => (
            <li key={promo.id} className="card-in flex items-center gap-3 rounded-lg px-2 py-2.5 hover:bg-slate-50">
              <span className="grid place-items-center size-9 shrink-0 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-semibold tabular-nums">-{promo.discount}%</span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{promo.name}</p>
                <p className="text-xs text-slate-500 tabular-nums">{promo.units} portions at {rm(promo.promoPrice)}</p>
              </div>
              <button
                type="button"
                onClick={() => onEnd(promo)}
                className="rounded-md px-2 py-1 text-xs text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50"
              >
                End
              </button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

export function Toast({ toast, onClose }) {
  return (
    <div role="status" aria-live="polite" className="fixed bottom-6 right-6 z-50">
      {toast && (
        <div key={toast.key} className="toast-in flex items-start gap-3 rounded-xl bg-slate-900 text-white pl-4 pr-2 py-3 shadow-xl shadow-slate-900/20 max-w-sm">
          <CircleCheck size={18} className="mt-0.5 shrink-0 text-emerald-400" />
          <div className="text-sm">
            <p className="font-medium">{toast.message}</p>
            <p className="text-slate-400">{toast.detail}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Dismiss notification" className="rounded-md p-1 text-slate-400 hover:text-white hover:bg-white/10 transition">
            <X size={16} />
          </button>
        </div>
      )}
    </div>
  )
}
