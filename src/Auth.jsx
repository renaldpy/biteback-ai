// Landing page with a mock two-role login. No real authentication: it only picks a view.
import { useState } from 'react'
import { ArrowRight, Check, ChefHat, Leaf, MapPin, Sparkles, Store, Tag, TrendingUp, UtensilsCrossed } from 'lucide-react'
import { cx } from './format'

const ROLES = [
  {
    id: 'customer',
    title: "I'm a Hungry Customer",
    tagline: 'Rescue great food for less',
    icon: UtensilsCrossed,
    perks: [[Tag, 'Up to 70% off premium meals'], [MapPin, 'Live map of deals near you'], [Leaf, 'Track the CO2 you save']],
    accent: { ring: 'ring-emerald-500', icon: 'bg-emerald-500/15 text-emerald-300', check: 'bg-emerald-500' },
  },
  {
    id: 'restaurant',
    title: "I'm a Restaurant Partner",
    tagline: 'Turn surplus into revenue',
    icon: Store,
    perks: [[Check, 'Zero listing fees'], [TrendingUp, 'Recover sunk food costs'], [Sparkles, 'Boost your ESG rating']],
    accent: { ring: 'ring-violet-500', icon: 'bg-violet-500/15 text-violet-300', check: 'bg-violet-500' },
  },
]

export default function Auth({ onLogin }) {
  const [role, setRole] = useState(null)
  const selected = ROLES.find((r) => r.id === role)

  const submit = (e) => {
    e.preventDefault()
    if (role) onLogin(role)
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-zinc-950 text-white">
      <div aria-hidden className="pointer-events-none absolute -top-40 left-1/2 h-[480px] w-[900px] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(16,185,129,0.22),transparent)]" />
      <div aria-hidden className="pointer-events-none absolute top-40 -right-40 h-[420px] w-[520px] rounded-full bg-[radial-gradient(closest-side,rgba(139,92,246,0.18),transparent)]" />

      <div className="relative mx-auto max-w-5xl px-5 py-10 sm:py-16">
        <div className="flex items-center gap-2.5">
          <span className="grid place-items-center size-9 rounded-xl bg-emerald-500 text-zinc-950"><ChefHat size={19} /></span>
          <span className="text-lg font-semibold tracking-tight">BiteBack</span>
        </div>

        <header className="mt-12 sm:mt-16 max-w-3xl">
          <p className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-zinc-300">
            <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" /> Live in Mid Valley tonight
          </p>
          <h1 className="mt-5 text-4xl sm:text-6xl font-semibold leading-[1.05] tracking-[-0.03em]">
            Rescue meals. Save money. <span className="text-emerald-400">Protect the planet.</span>
          </h1>
          <p className="mt-5 max-w-xl text-base sm:text-lg text-zinc-400">
            Restaurants list tonight's surplus. You grab it at a fraction of the price. Nothing good goes in the bin.
          </p>
        </header>

        <form onSubmit={submit} className="mt-10 sm:mt-14 grid gap-6 lg:grid-cols-[1fr_340px]">
          <fieldset>
            <legend className="mb-3 text-sm font-medium text-zinc-400">Choose how you'll use BiteBack</legend>
            <div role="radiogroup" className="grid gap-4 sm:grid-cols-2">
              {ROLES.map((r) => {
                const isOn = role === r.id
                return (
                  <button
                    key={r.id}
                    type="button"
                    role="radio"
                    aria-checked={isOn}
                    onClick={() => setRole(r.id)}
                    className={cx(
                      'group relative rounded-2xl border border-white/10 bg-white/[0.04] p-5 text-left transition duration-200',
                      'hover:bg-white/[0.07] hover:-translate-y-0.5 active:scale-[0.99]',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60',
                      isOn && cx('ring-2 bg-white/[0.08]', r.accent.ring),
                    )}
                  >
                    <span className={cx('absolute top-4 right-4 grid size-5 place-items-center rounded-full border border-white/20 transition', isOn && cx('border-transparent', r.accent.check))}>
                      {isOn && <Check size={12} className="text-white" strokeWidth={3} />}
                    </span>
                    <span className={cx('grid size-11 place-items-center rounded-xl', r.accent.icon)}><r.icon size={20} /></span>
                    <span className="mt-4 block text-lg font-semibold tracking-tight">{r.title}</span>
                    <span className="block text-sm text-zinc-400">{r.tagline}</span>
                    <ul className="mt-4 flex flex-col gap-2 text-sm text-zinc-300">
                      {r.perks.map(([Icon, text]) => (
                        <li key={text} className="flex items-center gap-2"><Icon size={14} className="text-zinc-500" /> {text}</li>
                      ))}
                    </ul>
                  </button>
                )
              })}
            </div>
          </fieldset>

          <div className="rounded-2xl border border-white/10 bg-zinc-900/80 p-5 backdrop-blur">
            <h2 className="font-semibold">{selected ? `Sign in as ${selected.id === 'customer' ? 'a customer' : 'a partner'}` : 'Sign in'}</h2>
            <p className="text-sm text-zinc-400">Demo only. Any details work.</p>
            <label className="mt-4 block text-xs font-medium text-zinc-400">
              {role === 'restaurant' ? 'Restaurant email' : 'Email'}
              <input
                type="email"
                required
                defaultValue={role === 'restaurant' ? 'midvalley@biteback.my' : 'aina@example.com'}
                key={role ?? 'none'}
                className="mt-1 w-full rounded-lg border border-white/10 bg-zinc-950 px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-emerald-400/60 focus:ring-2 focus:ring-emerald-400/20"
              />
            </label>
            <label className="mt-3 block text-xs font-medium text-zinc-400">
              Password
              <input
                type="password"
                required
                minLength={4}
                defaultValue="demo1234"
                className="mt-1 w-full rounded-lg border border-white/10 bg-zinc-950 px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-400/60 focus:ring-2 focus:ring-emerald-400/20"
              />
            </label>
            <button
              type="submit"
              disabled={!role}
              className={cx(
                'mt-5 w-full flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition active:scale-[0.98]',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900 focus-visible:ring-emerald-400',
                'disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-zinc-500',
                role === 'restaurant' ? 'bg-violet-500 text-white hover:bg-violet-400' : 'bg-emerald-400 text-zinc-950 hover:bg-emerald-300',
              )}
            >
              {selected ? <>Continue as {selected.id === 'customer' ? 'Customer' : 'Partner'} <ArrowRight size={16} /></> : 'Pick a role to continue'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
