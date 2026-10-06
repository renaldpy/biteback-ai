// Pure logic for BiteBack AI: stock rules, surplus routing, forecasting, impact.
// Every number marked ASSUMPTION is a placeholder: source it before quoting it in a pitch.

export const KG_PER_UNIT = 0.4 // ASSUMPTION: average portion weight
export const PROMO_SELL_RATE = 0.6 // ASSUMPTION: share of flash-sale stock that actually sells
export const STAFF_MEAL_CAP = 10 // portions per close, shared across items
export const CO2E_PER_KG = 2.5 // ASSUMPTION: kg CO2e avoided per kg food kept out of landfill
export const OPERATING_DAYS = 30
export const SUBSCRIPTION_RM = 149 // ASSUMPTION: BiteBack monthly price per outlet
export const NON_DONATABLE = new Set(['Drinks']) // dairy drinks fail food-bank safety rules

export const FORECAST = { buffer: 0.1, batch: 5, soldOutAt: 0.95, soldOutUplift: 0.15 }

// Food recovery hierarchy, best use first. `partner: true` streams can be switched on/off.
export const STREAMS = [
  { id: 'sale', label: 'Flash sale', color: '#4f46e5', partner: false, note: 'Sold at a discount on GrabFood' },
  { id: 'staff', label: 'Staff meals', color: '#0284c7', partner: true, note: `Up to ${STAFF_MEAL_CAP} portions per close` },
  { id: 'donate', label: 'Food bank', color: '#059669', partner: true, note: 'Evening pickup by a food rescue partner' },
  { id: 'feed', label: 'Insect farm', color: '#d97706', partner: true, note: 'Black soldier fly larvae → animal feed' },
  { id: 'compost', label: 'Compost', color: '#9333ea', partner: true, note: 'Collected for municipal composting' },
  { id: 'landfill', label: 'Landfill', color: '#e11d48', partner: false, note: 'Status quo: binned' },
]
export const NO_PARTNERS = { staff: false, donate: false, feed: false, compost: false }
export const ALL_PARTNERS = { staff: true, donate: true, feed: true, compost: true }

export const sum = (list, fn) => list.reduce((total, x) => total + fn(x), 0)
export const sellThrough = (item) => (item.prep > 0 ? item.sold / item.prep : 0)
export const surplusOf = (item) => Math.max(0, item.prep - item.sold)

/**
 * The "AI" rules engine: maps an item and the simulated time to a stock status.
 * @returns {{ type: 'understock'|'overstock'|'overstock_critical'|'optimal', message: string, suggestedAction: string|null, discount?: number }}
 */
export function analyzeStock(item, time) {
  const left = item.prep - item.sold
  if (time === '12:00 PM' && sellThrough(item) > 0.85) {
    return { type: 'understock', message: 'High stockout risk before dinner.', suggestedAction: 'Prep +20' }
  }
  if (time === '5:30 PM' && left > 15) {
    return { type: 'overstock', message: 'Moderate surplus.', suggestedAction: '15% discount', discount: 15 }
  }
  if (time === '9:00 PM' && left > 10) {
    return { type: 'overstock_critical', message: 'Critical waste risk.', suggestedAction: '40% Flash Sale', discount: 40 }
  }
  return { type: 'optimal', message: 'Stock is on track.', suggestedAction: null }
}

export function makePromo(item, discount, time) {
  return {
    id: item.id,
    name: item.name,
    discount,
    units: surplusOf(item),
    promoPrice: Math.round(item.price * (100 - discount)) / 100,
    pushedAt: time,
  }
}

/**
 * Routes each item's end-of-day surplus down the recovery hierarchy.
 * @returns {{ item: object, stream: string, units: number, value: number }[]}
 */
export function routeSurplus(inventory, promos, partners) {
  const promoById = new Map(promos.map((p) => [p.id, p]))
  let staffLeft = STAFF_MEAL_CAP
  return inventory.flatMap((item) => {
    const flows = []
    let rest = surplusOf(item)
    const take = (stream, units, unitValue = 0) => {
      if (units <= 0) return
      flows.push({ item, stream, units, value: units * unitValue })
      rest -= units
    }
    const promo = promoById.get(item.id)
    if (promo) take('sale', Math.round(rest * PROMO_SELL_RATE), promo.promoPrice)
    if (partners.staff) {
      const units = Math.min(rest, staffLeft)
      staffLeft -= units
      take('staff', units, item.cost) // value = ingredient cost not spent on staff food
    }
    if (partners.donate && !NON_DONATABLE.has(item.category)) take('donate', rest)
    if (partners.feed) take('feed', rest)
    if (partners.compost) take('compost', rest)
    take('landfill', rest)
    return flows
  })
}

export function summarizeRecovery(flows) {
  const byStream = Object.fromEntries(STREAMS.map((s) => {
    const own = flows.filter((f) => f.stream === s.id)
    const units = sum(own, (f) => f.units)
    return [s.id, { units, kg: units * KG_PER_UNIT, value: sum(own, (f) => f.value) }]
  }))
  const totalKg = sum(flows, (f) => f.units) * KG_PER_UNIT
  const divertedKg = totalKg - byStream.landfill.kg
  return {
    byStream,
    totalKg,
    divertedKg,
    recoveredRm: byStream.sale.value + byStream.staff.value,
    meals: byStream.donate.units,
    co2eKg: divertedKg * CO2E_PER_KG,
  }
}

/** Tomorrow's prep: today's demand plus a buffer, rounded up to whole batches. Sell-outs hide true demand, so uplift them. */
export function forecastPrep(item) {
  const { buffer, batch, soldOutAt, soldOutUplift } = FORECAST
  const soldOut = sellThrough(item) >= soldOutAt
  const demand = soldOut ? item.sold * (1 + soldOutUplift) : item.sold
  return Math.max(batch, Math.ceil((demand * (1 + buffer)) / batch) * batch)
}

/** Scales one day to a month. Uses the measured close log when staff have entered it. */
export function projectMonthly(summary, measuredBinnedKg) {
  const isMeasured = Number.isFinite(measuredBinnedKg)
  const divertedKg = isMeasured ? Math.max(0, summary.totalKg - measuredBinnedKg) : summary.divertedKg
  const recoveredRm = summary.recoveredRm * OPERATING_DAYS
  return {
    isMeasured,
    recoveredRm,
    divertedKg: divertedKg * OPERATING_DAYS,
    meals: summary.meals * OPERATING_DAYS,
    co2eKg: divertedKg * CO2E_PER_KG * OPERATING_DAYS,
    paybackMultiple: recoveredRm / SUBSCRIPTION_RM,
  }
}
