// Self-check for the engine against the seed data. Run: npm run check
import assert from 'node:assert/strict'
import {
  ALL_PARTNERS, NO_PARTNERS, analyzeStock, applyOrder, forecastPrep, makePromo, projectMonthly, routeSurplus,
  summarizeRecovery,
} from '../src/engine.js'

const item = (prep, sold) => ({ prep, sold })

// analyzeStock thresholds
assert.equal(analyzeStock(item(60, 54), '12:00 PM').type, 'understock') // 0.90 > 0.85
assert.equal(analyzeStock(item(100, 85), '12:00 PM').type, 'optimal') // exactly 0.85 is not > 0.85
assert.equal(analyzeStock(item(0, 0), '12:00 PM').type, 'optimal') // no divide-by-zero
assert.equal(analyzeStock(item(40, 12), '5:30 PM').type, 'overstock')
assert.equal(analyzeStock(item(90, 75), '5:30 PM').type, 'optimal') // 15 left is not > 15
assert.equal(analyzeStock(item(90, 75), '9:00 PM').type, 'overstock_critical')
assert.equal(analyzeStock(item(45, 42), '9:00 PM').type, 'optimal')
assert.equal(analyzeStock(item(40, 12), '9:00 PM').discount, 40)

// routeSurplus: conserves portions and follows the hierarchy
const seed = [
  { id: 1, name: 'Nasi Lemak', price: 14, cost: 6, prep: 60, sold: 54, category: 'Mains' },
  { id: 2, name: 'Chicken Chop', price: 22, cost: 9.5, prep: 40, sold: 12, category: 'Mains' },
  { id: 3, name: 'Curry Laksa', price: 16, cost: 7, prep: 45, sold: 42, category: 'Noodles' },
  { id: 4, name: 'Kaya Toast', price: 6.5, cost: 2, prep: 80, sold: 30, category: 'Sides' },
  { id: 5, name: 'Teh Tarik', price: 4.5, cost: 1.2, prep: 90, sold: 75, category: 'Drinks' },
]
const surplus = 6 + 28 + 3 + 50 + 15
const units = (flows) => flows.reduce((n, f) => n + f.units, 0)
const promos = [seed[1], seed[3], seed[4]].map((i) => makePromo(i, 40, '9:00 PM'))

const baseline = routeSurplus(seed, [], NO_PARTNERS)
assert.equal(units(baseline), surplus)
assert.ok(baseline.every((f) => f.stream === 'landfill'), 'no partners and no promos: everything is binned')

const full = routeSurplus(seed, promos, ALL_PARTNERS)
assert.equal(units(full), surplus, 'routing never creates or loses portions')
assert.ok(!full.some((f) => f.stream === 'landfill'), 'compost catches everything when enabled')
assert.ok(!full.some((f) => f.stream === 'donate' && f.item.category === 'Drinks'), 'drinks are never donated')
assert.equal(units(full.filter((f) => f.stream === 'staff')), 10, 'staff meals respect the shared cap')
assert.equal(full.find((f) => f.item.id === 2 && f.stream === 'sale').units, 17) // round(28 * 0.6)

const summary = summarizeRecovery(full)
assert.equal(summary.divertedKg, summary.totalKg)
assert.ok(summary.recoveredRm > 0)

// forecastPrep: demand + 10%, batches of 5, sell-outs uplifted
assert.equal(forecastPrep(seed[0]), 60) // 54 * 1.1 = 59.4 -> 60
assert.equal(forecastPrep(seed[1]), 15) // 12 * 1.1 = 13.2 -> 15
assert.equal(forecastPrep({ prep: 40, sold: 40 }), 55) // sold out: 40 * 1.15 * 1.1 = 50.6 -> 55
assert.equal(forecastPrep({ prep: 0, sold: 0 }), 5) // never plan zero

// projectMonthly: measured log overrides prediction
const predicted = projectMonthly(summary, NaN)
const measured = projectMonthly(summary, summary.totalKg)
assert.equal(predicted.isMeasured, false)
assert.equal(measured.divertedKg, 0, 'binning everything means nothing diverted')

// understock pace message: 90% sold vs 45% expected = 2.0x
assert.match(analyzeStock(item(60, 54), '12:00 PM').message, /2\.0× faster/)

// applyOrder: one order moves sold and promo stock together, and refuses sold-out deals
const chop = makePromo(seed[1], 40, '9:00 PM', { createdAt: 0 })
assert.equal(chop.expiresAt, 90 * 60_000)
const bag = makePromo(seed[3], 60, '9:00 PM', { isBag: true })
assert.equal(bag.name, 'Mystery Bag: Kaya Toast')
const ordered = applyOrder(seed, [chop], 2)
assert.equal(ordered.ok, true)
assert.equal(ordered.inventory.find((i) => i.id === 2).sold, 13)
assert.equal(ordered.promos[0].units, 27)
assert.equal(seed[1].sold, 12, 'applyOrder does not mutate its input')
assert.equal(applyOrder(seed, [{ ...chop, units: 0 }], 2).ok, false)
assert.equal(applyOrder(seed, [chop], 99).ok, false)

console.log('engine: all checks passed')
