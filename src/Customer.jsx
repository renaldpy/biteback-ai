// Mobile-first customer app: live rescue feed, map, checkout, orders and impact.
import { useEffect, useRef, useState } from 'react'
import {
  Bell, Bike, Clock, Compass, Flame, Gift, Leaf, LogOut, Map as MapIcon, MapPin, Navigation, Receipt,
  Store, Timer, User, Wallet, X,
} from 'lucide-react'
import { PROMO_LIFETIME_MIN } from './engine'
import { cx, rm } from './format'

const RESTAURANT = 'Mid Valley Outlet'
const CATEGORY_EMOJI = { Mains: '🍛', Noodles: '🍜', Sides: '🍞', Drinks: '🧋' }
const PICKUP_WINDOW = { '12:00 PM': '12:30 – 1:00 PM', '5:30 PM': '6:00 – 6:30 PM', '9:00 PM': '9:30 – 10:00 PM' }
const MOCK_BOXES = [
  { id: 'm1', name: 'Surplus Mystery Box', restaurant: 'Roti Bakar House', originalPrice: 24, promoPrice: 8.9, discount: 63, units: 4, distanceKm: 0.6, minutes: 38, emoji: '🥐', pin: [68, 30] },
  { id: 'm2', name: 'Sushi Rescue Box', restaurant: 'Sushi Mentai MV', originalPrice: 36, promoPrice: 12.9, discount: 64, units: 2, distanceKm: 1.1, minutes: 22, emoji: '🍣', pin: [30, 62] },
  { id: 'm3', name: 'Bakery End-of-Day Bag', restaurant: 'Bakery 18', originalPrice: 20, promoPrice: 6, discount: 70, units: 6, distanceKm: 1.8, minutes: 55, emoji: '🧁', pin: [80, 72] },
]
const TABS = [
  { id: 'explore', label: 'Explore', icon: Compass },
  { id: 'map', label: 'Map', icon: MapIcon },
  { id: 'orders', label: 'Orders', icon: Receipt },
  { id: 'profile', label: 'Profile', icon: User },
]

function useNow() {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])
  return now
}

function countdown(ms) {
  if (ms <= 0) return 'Ended'
  const s = Math.floor(ms / 1000)
  const h = Math.floor(s / 3600)
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, '0')
  const ss = String(s % 60).padStart(2, '0')
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`
}

/** Live promos become feed deals; with none live, the feed falls back to mock boxes from other restaurants. */
function useDeals(activePromos, inventory) {
  const [openedAt] = useState(() => Date.now())
  if (activePromos.length === 0) {
    return { isFallback: true, deals: MOCK_BOXES.map((m) => ({ ...m, isLive: false, expiresAt: openedAt + m.minutes * 60_000 })) }
  }
  return {
    isFallback: false,
    deals: activePromos.map((p) => {
      const item = inventory.find((i) => i.id === p.id)
      return {
        ...p,
        isLive: true,
        restaurant: RESTAURANT,
        distanceKm: 0.3 + p.id * 0.2,
        emoji: p.isBag ? '🛍️' : CATEGORY_EMOJI[item?.category] ?? '🍱',
        pin: [20 + p.id * 13, 25 + (p.id % 3) * 20],
      }
    }),
  }
}

export default function CustomerApp({ store }) {
  const { activePromos, inventory, customerImpact, orders, timeOfDay, placeOrder, setCurrentView } = store
  const [tab, setTab] = useState('explore')
  const [checkout, setCheckout] = useState(null)
  const now = useNow()
  const { deals, isFallback } = useDeals(activePromos, inventory)

  return (
    <div className="min-h-screen bg-zinc-200/70">
      <div className="relative mx-auto flex min-h-screen max-w-md flex-col bg-zinc-50 shadow-2xl shadow-zinc-900/10">
        <header className="glass sticky top-0 z-20 flex items-center justify-between gap-2 border-b border-zinc-200/70 bg-zinc-50/85 px-4 py-3 backdrop-blur-md">
          <button type="button" className="flex items-center gap-1.5 rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50">
            <MapPin size={18} className="text-emerald-600" />
            <span>
              <span className="block text-[11px] leading-none text-zinc-500">Deliver to</span>
              <span className="text-sm font-semibold">Mid Valley</span>
            </span>
          </button>
          <div className="flex items-center gap-2">
            <span id="impact-score" className="flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800 tabular-nums">
              <Leaf size={13} /> {customerImpact.co2Saved.toFixed(1)} kg CO2 saved
            </span>
            <button
              type="button"
              onClick={() => setTab('explore')}
              aria-label={`Notifications${deals.length && !isFallback ? `, ${deals.length} live deals` : ''}`}
              className="relative grid size-9 place-items-center rounded-full bg-white ring-1 ring-zinc-200 active:scale-95 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50"
            >
              <Bell size={17} />
              {!isFallback && <span className="absolute top-1.5 right-2 size-2 rounded-full bg-rose-500 ring-2 ring-white" />}
            </button>
          </div>
        </header>

        <main className="flex-1 px-4 pb-28 pt-4">
          {tab === 'explore' && <Explore deals={deals} isFallback={isFallback} now={now} onPick={setCheckout} />}
          {tab === 'map' && <MapTab deals={deals} onPick={setCheckout} />}
          {tab === 'orders' && <OrdersTab orders={orders} onExplore={() => setTab('explore')} />}
          {tab === 'profile' && <ProfileTab impact={customerImpact} orders={orders} onSwitch={setCurrentView} />}
        </main>

        <nav aria-label="Customer app" className="glass fixed bottom-0 left-1/2 z-20 grid w-full max-w-md -translate-x-1/2 grid-cols-4 border-t border-zinc-200/70 bg-white/90 px-2 pb-[max(env(safe-area-inset-bottom),8px)] pt-2 backdrop-blur-md">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              aria-current={tab === id ? 'page' : undefined}
              className={cx(
                'flex flex-col items-center gap-0.5 rounded-xl py-1.5 text-[11px] font-medium transition active:scale-95',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50',
                tab === id ? 'text-emerald-700' : 'text-zinc-500 hover:text-zinc-800',
              )}
            >
              <Icon size={21} strokeWidth={tab === id ? 2.4 : 2} />
              {label}
              {id === 'orders' && orders.length > 0 && <span className="sr-only">({orders.length})</span>}
            </button>
          ))}
        </nav>
      </div>

      <CheckoutSheet
        deal={checkout}
        timeOfDay={timeOfDay}
        onClose={() => setCheckout(null)}
        onConfirm={(mode) => {
          if (placeOrder(checkout, mode)) setCheckout(null)
        }}
      />
    </div>
  )
}

function Explore({ deals, isFallback, now, onPick }) {
  return (
    <div id="feed" className="scroll-mt-24">
      {!isFallback && (
        <div role="status" className="card-in mb-4 flex items-center gap-3 rounded-2xl bg-gradient-to-r from-rose-600 to-orange-500 px-4 py-3 text-white shadow-lg shadow-rose-600/20">
          <span className="relative flex size-9 shrink-0 items-center justify-center">
            <span className="absolute inset-0 rounded-full bg-white/30 animate-ping motion-reduce:animate-none" />
            <Flame size={20} className="relative" />
          </span>
          <div>
            <p className="text-sm font-semibold">Flash Sale nearby!</p>
            <p className="text-xs text-white/85">{deals.length} {deals.length === 1 ? 'item' : 'items'} expiring soon at {RESTAURANT}</p>
          </div>
        </div>
      )}
      <div className="mb-3 flex items-end justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{isFallback ? 'Rescue boxes near you' : 'Live rescues near you'}</h1>
          <p className="text-sm text-zinc-500">{isFallback ? 'Surprise surplus from local kitchens' : 'Pushed by restaurants minutes ago'}</p>
        </div>
      </div>
      <ul className="flex flex-col gap-3">
        {deals.map((deal) => <DealCard key={deal.id} deal={deal} now={now} onPick={onPick} />)}
      </ul>
    </div>
  )
}

function DealCard({ deal, now, onPick }) {
  const left = deal.expiresAt - now
  const isSoldOut = deal.units <= 0
  const isUrgent = left < 30 * 60_000
  const isDisabled = isSoldOut || left <= 0
  return (
    <li className="card-in">
      <button
        type="button"
        disabled={isDisabled}
        onClick={() => onPick(deal)}
        className={cx(
          'group w-full overflow-hidden rounded-2xl bg-white text-left ring-1 ring-zinc-200 shadow-sm transition duration-200',
          'hover:shadow-md hover:-translate-y-0.5 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500',
          'disabled:opacity-60 disabled:hover:translate-y-0 disabled:hover:shadow-sm disabled:cursor-not-allowed',
        )}
      >
        <div className="relative flex h-28 items-center justify-center bg-gradient-to-br from-emerald-50 via-zinc-50 to-violet-50">
          <span className="text-5xl drop-shadow-sm transition-transform duration-300 group-hover:scale-110" aria-hidden>{deal.emoji}</span>
          <span className="absolute top-3 left-3 rounded-full bg-emerald-600 px-2 py-0.5 text-xs font-bold text-white tabular-nums">−{deal.discount}%</span>
          {deal.isBag && <span className="absolute top-3 left-16 flex items-center gap-1 rounded-full bg-violet-600 px-2 py-0.5 text-xs font-semibold text-white"><Gift size={11} /> Mystery</span>}
          <span className={cx('absolute top-3 right-3 flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums', isUrgent ? 'bg-rose-600 text-white' : 'bg-white text-rose-600 ring-1 ring-rose-200')}>
            <Timer size={12} /> {countdown(left)}
          </span>
          <span className="absolute bottom-3 right-3 rounded-full bg-white/90 px-2 py-0.5 text-xs font-medium text-zinc-700 ring-1 ring-zinc-200">
            {isSoldOut ? 'Sold out' : `${deal.units} left`}
          </span>
        </div>
        <div className="flex items-end justify-between gap-3 p-4">
          <div className="min-w-0">
            <p className="flex items-center gap-1 text-xs text-zinc-500"><Store size={12} /> {deal.restaurant} · {deal.distanceKm.toFixed(1)} km</p>
            <h3 className="truncate font-semibold">{deal.name}</h3>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-xs text-zinc-400 line-through tabular-nums">{rm(deal.originalPrice)}</p>
            <p className="text-lg font-bold text-emerald-700 tabular-nums">{rm(deal.promoPrice)}</p>
          </div>
        </div>
      </button>
    </li>
  )
}

function MiniMap({ pins = [], route = false, onPin, className }) {
  return (
    <svg viewBox="0 0 100 100" className={cx('w-full rounded-2xl bg-zinc-100', className)} role="img" aria-label={route ? 'Rider route from the restaurant to you' : 'Map of nearby deals'}>
      <rect x="58" y="8" width="30" height="22" rx="3" className="fill-emerald-100" />
      <rect x="8" y="70" width="22" height="20" rx="3" className="fill-emerald-100" />
      <path d="M0 45 H100 M0 78 H100 M35 0 V100 M72 0 V100" className="stroke-white" strokeWidth="5" />
      <path d="M0 20 Q50 30 100 12" className="stroke-white" strokeWidth="3" fill="none" />
      <path d="M0 45 H100 M35 0 V100" className="stroke-amber-200" strokeWidth="1" />
      {route && (
        <>
          <path d="M28 70 L35 70 L35 45 L72 45 L72 26" fill="none" className="stroke-emerald-600 route-dash" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="28" cy="70" r="3.2" className="fill-violet-600 stroke-white" strokeWidth="1.2" />
          <circle cx="72" cy="26" r="3.2" className="fill-emerald-600 stroke-white" strokeWidth="1.2" />
          <text x="28" y="80" textAnchor="middle" className="fill-zinc-600 text-[4px] font-semibold">Restaurant</text>
          <text x="72" y="20" textAnchor="middle" className="fill-zinc-600 text-[4px] font-semibold">You</text>
        </>
      )}
      {pins.map((p) => (
        <g key={p.id} onClick={() => onPin?.(p)} className="cursor-pointer">
          <title>{`${p.name}: ${rm(p.promoPrice)}`}</title>
          <circle cx={p.pin[0]} cy={p.pin[1]} r="6" className={p.isLive ? 'fill-rose-500/20' : 'fill-emerald-500/15'} />
          <circle cx={p.pin[0]} cy={p.pin[1]} r="3" className={cx(p.isLive ? 'fill-rose-600' : 'fill-emerald-600', 'stroke-white')} strokeWidth="1" />
        </g>
      ))}
      {!route && <circle cx="50" cy="52" r="2.4" className="fill-sky-500 stroke-white" strokeWidth="1"><title>You</title></circle>}
    </svg>
  )
}

function MapTab({ deals, onPick }) {
  return (
    <div>
      <h1 className="text-xl font-semibold tracking-tight">Deals on the map</h1>
      <p className="mb-3 text-sm text-zinc-500">Tap a pin or a deal to order</p>
      <MiniMap pins={deals} onPin={onPick} className="aspect-square" />
      <ul className="mt-3 flex flex-col divide-y divide-zinc-200 rounded-2xl bg-white ring-1 ring-zinc-200">
        {deals.map((d) => (
          <li key={d.id}>
            <button type="button" onClick={() => onPick(d)} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-zinc-50 focus-visible:outline-none focus-visible:bg-zinc-50">
              <span className={cx('size-2.5 rounded-full', d.isLive ? 'bg-rose-600' : 'bg-emerald-600')} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{d.name}</span>
                <span className="text-xs text-zinc-500">{d.restaurant} · {d.distanceKm.toFixed(1)} km</span>
              </span>
              <span className="text-sm font-semibold text-emerald-700 tabular-nums">{rm(d.promoPrice)}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

function OrdersTab({ orders, onExplore }) {
  if (orders.length === 0) {
    return (
      <div className="mt-16 text-center">
        <Receipt className="mx-auto text-zinc-300" size={36} />
        <p className="mt-3 font-medium">No rescues yet</p>
        <p className="text-sm text-zinc-500">Your orders and pickup codes will show here.</p>
        <button type="button" onClick={onExplore} className="mt-4 rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white active:scale-95 transition">Find a deal</button>
      </div>
    )
  }
  return (
    <div>
      <h1 className="mb-3 text-xl font-semibold tracking-tight">Your rescues</h1>
      <ul className="flex flex-col gap-3">
        {orders.map((o) => (
          <li key={o.key} className="card-in rounded-2xl bg-white p-4 ring-1 ring-zinc-200">
            <div className="flex justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-semibold">{o.name}</p>
                <p className="text-xs text-zinc-500">{o.restaurant} · ordered {o.placedAt}</p>
              </div>
              <p className="font-semibold tabular-nums">{rm(o.price)}</p>
            </div>
            <p className="mt-2 flex items-center gap-1.5 text-sm text-zinc-600">
              {o.mode === 'delivery'
                ? <><Bike size={15} className="text-emerald-600" /> Rider Tahsan · OTP <span className="font-bold tracking-widest text-zinc-900">4921</span></>
                : <><Store size={15} className="text-violet-600" /> Self-pickup · show QR at the counter</>}
            </p>
          </li>
        ))}
      </ul>
    </div>
  )
}

function ProfileTab({ impact, orders, onSwitch }) {
  const saved = orders.reduce((total, o) => total + o.saved, 0)
  const stats = [
    { label: 'Meals rescued', value: impact.mealsSaved, icon: Gift },
    { label: 'CO2e avoided', value: `${impact.co2Saved.toFixed(1)} kg`, icon: Leaf },
    { label: 'Money saved', value: rm(saved), icon: Wallet },
  ]
  return (
    <div>
      <div className="flex items-center gap-3">
        <span className="grid size-14 place-items-center rounded-full bg-gradient-to-br from-emerald-400 to-violet-500 text-xl font-semibold text-white">A</span>
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Aina</h1>
          <p className="text-sm text-zinc-500">Food rescuer since today</p>
        </div>
      </div>
      <dl className="mt-5 grid grid-cols-3 gap-2">
        {stats.map(({ label, value, icon: Icon }) => (
          <div key={label} className="rounded-2xl bg-white p-3 ring-1 ring-zinc-200">
            <Icon size={16} className="text-emerald-600" />
            <dd className="mt-2 text-lg font-bold tabular-nums">{value}</dd>
            <dt className="text-[11px] text-zinc-500">{label}</dt>
          </div>
        ))}
      </dl>
      <p className="mt-2 text-[11px] text-zinc-400">CO2e uses an assumed 1.0 kg per rescued meal.</p>
      <div className="mt-6 flex flex-col gap-2">
        <button type="button" onClick={() => onSwitch('restaurant')} className="flex items-center justify-center gap-2 rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white active:scale-[0.98] transition">
          <Store size={16} /> Switch to restaurant view
        </button>
        <button type="button" onClick={() => onSwitch('auth')} className="flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium text-zinc-600 hover:bg-zinc-100 transition">
          <LogOut size={16} /> Log out
        </button>
      </div>
    </div>
  )
}

/** Decorative QR-style pattern. It does not encode anything scannable. */
function QrPlaceholder({ seed }) {
  const N = 21
  const isFinder = (x, y) => [[0, 0], [N - 7, 0], [0, N - 7]].some(([fx, fy]) => x >= fx && x < fx + 7 && y >= fy && y < fy + 7)
  const finderOn = (x, y) => {
    const [fx, fy] = x < 7 ? (y < 7 ? [0, 0] : [0, N - 7]) : [N - 7, 0]
    const dx = x - fx, dy = y - fy
    return dx === 0 || dy === 0 || dx === 6 || dy === 6 || (dx >= 2 && dx <= 4 && dy >= 2 && dy <= 4)
  }
  const cells = []
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const on = isFinder(x, y) ? finderOn(x, y) : ((x * 7 + y * 13 + seed * 31 + x * y) % 5) < 2
      if (on) cells.push(<rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" />)
    }
  }
  return (
    <svg viewBox={`-1 -1 ${N + 2} ${N + 2}`} className="size-40 rounded-xl bg-white fill-zinc-900 ring-1 ring-zinc-200" role="img" aria-label="Pickup QR code (demo placeholder)">
      {cells}
    </svg>
  )
}

function CheckoutSheet({ deal, timeOfDay, onClose, onConfirm }) {
  const ref = useRef(null)
  const [mode, setMode] = useState('delivery')

  useEffect(() => {
    const dialog = ref.current
    if (deal && !dialog.open) dialog.showModal()
    if (!deal && dialog.open) dialog.close()
  }, [deal])

  const tabBtn = (id, label, Icon) => (
    <button
      type="button"
      role="tab"
      id={`tab-${id}`}
      aria-selected={mode === id}
      aria-controls={`panel-${id}`}
      onClick={() => setMode(id)}
      className={cx(
        'flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-medium transition',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50',
        mode === id ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-800',
      )}
    >
      <Icon size={15} /> {label}
    </button>
  )

  return (
    <dialog
      ref={ref}
      aria-label="Checkout"
      onClose={onClose}
      onClick={(e) => e.target === e.currentTarget && onClose()}
      className="sheet-in mx-auto mb-0 mt-auto w-full max-w-md rounded-t-3xl bg-zinc-50 p-0 text-zinc-900 backdrop:bg-zinc-950/50 backdrop:backdrop-blur-sm"
    >
      {deal && (
        <div className="max-h-[88dvh] overflow-y-auto px-5 pb-6 pt-3">
          <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-zinc-300" aria-hidden />
          <div className="flex items-start gap-3">
            <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-emerald-50 to-violet-50 text-3xl" aria-hidden>{deal.emoji}</span>
            <div className="min-w-0 flex-1">
              <h2 className="font-semibold leading-snug">{deal.name}</h2>
              <p className="text-xs text-zinc-500">{deal.restaurant} · {deal.distanceKm.toFixed(1)} km</p>
              <p className="mt-1 text-sm">
                <span className="font-bold text-emerald-700 tabular-nums">{rm(deal.promoPrice)}</span>
                <span className="ml-2 text-zinc-400 line-through tabular-nums">{rm(deal.originalPrice)}</span>
              </p>
            </div>
            <button type="button" onClick={onClose} aria-label="Close checkout" className="rounded-full p-1.5 text-zinc-500 hover:bg-zinc-200 transition"><X size={18} /></button>
          </div>

          <div role="tablist" aria-label="Fulfilment" className="mt-4 flex gap-1 rounded-xl bg-zinc-200/70 p-1">
            {tabBtn('delivery', 'Delivery', Bike)}
            {tabBtn('pickup', 'Self-Pickup', Store)}
          </div>

          {mode === 'delivery' ? (
            <div id="panel-delivery" role="tabpanel" aria-labelledby="tab-delivery" className="mt-4">
              <MiniMap route className="aspect-[16/10]" />
              <div className="mt-3 flex items-center gap-3 rounded-2xl bg-white p-3 ring-1 ring-zinc-200">
                <span className="grid size-10 place-items-center rounded-full bg-violet-100 font-semibold text-violet-700">T</span>
                <div className="flex-1">
                  <p className="text-sm font-semibold">Tahsan is your rider</p>
                  <p className="flex items-center gap-1 text-xs text-zinc-500"><Navigation size={11} /> Arrives in ~14 min · Honda EX5</p>
                </div>
              </div>
              <div className="mt-3 rounded-2xl bg-zinc-900 p-4 text-center text-white">
                <p className="text-xs uppercase tracking-wider text-zinc-400">Delivery OTP</p>
                <p className="mt-1 text-3xl font-bold tracking-[0.3em] tabular-nums">4921</p>
                <p className="mt-1 text-xs text-zinc-400">Share with Tahsan at the door</p>
              </div>
            </div>
          ) : (
            <div id="panel-pickup" role="tabpanel" aria-labelledby="tab-pickup" className="mt-4 flex flex-col items-center">
              <div className="flex w-full items-center gap-3 rounded-2xl bg-white p-3 ring-1 ring-zinc-200">
                <Clock size={18} className="text-violet-600" />
                <div>
                  <p className="text-sm font-semibold">Collect {PICKUP_WINDOW[timeOfDay]}</p>
                  <p className="text-xs text-zinc-500">{deal.restaurant}, Lower Ground Floor</p>
                </div>
              </div>
              <div className="mt-4"><QrPlaceholder seed={String(deal.id).length + Number(String(deal.id).replace(/\D/g, '') || 0)} /></div>
              <p className="mt-2 text-xs text-zinc-500">Scan at the counter to collect</p>
            </div>
          )}

          <button
            type="button"
            onClick={() => onConfirm(mode)}
            className="mt-5 w-full rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-600/20 hover:bg-emerald-700 active:scale-[0.98] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 focus-visible:ring-offset-2"
          >
            Confirm order · {rm(deal.promoPrice)}
          </button>
          <p className="mt-2 text-center text-[11px] text-zinc-400">Rescues ~0.4 kg of food. Expires {PROMO_LIFETIME_MIN} min after listing.</p>
        </div>
      )}
    </dialog>
  )
}
