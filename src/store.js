// Global demo state shared by the auth, restaurant and customer views.
import { useEffect, useState } from 'react'
import { ALL_PARTNERS, CO2E_PER_MEAL, NO_PARTNERS, analyzeStock, applyOrder, makePromo } from './engine'

export const SEED_INVENTORY = [
  { id: 1, short: 'Nasi Lemak', name: 'Signature Nasi Lemak', price: 14.0, cost: 6.0, prep: 60, sold: 54, category: 'Mains' },
  { id: 2, short: 'Chicken Chop', name: 'Crispy Chicken Chop', price: 22.0, cost: 9.5, prep: 40, sold: 12, category: 'Mains' },
  { id: 3, short: 'Curry Laksa', name: 'Nyonya Curry Laksa', price: 16.0, cost: 7.0, prep: 45, sold: 42, category: 'Noodles' },
  { id: 4, short: 'Kaya Toast', name: 'Kaya Butter Toast Set', price: 6.5, cost: 2.0, prep: 80, sold: 30, category: 'Sides' },
  { id: 5, short: 'Teh Tarik', name: 'Teh Tarik (Cold)', price: 4.5, cost: 1.2, prep: 90, sold: 75, category: 'Drinks' },
]

export const EMPTY_LOG = { binned: '', donated: '' }
const EMPTY_IMPACT = { mealsSaved: 0, co2Saved: 0 }
const TOAST_MS = 3000

// Each step fully describes the demo state, so jumping back and forth is safe.
export const PITCH_STEPS = [
  { title: 'Lunch rush', caption: 'Nasi Lemak and Laksa are selling 2× faster than usual. The engine flags a stockout before dinner.', time: '12:00 PM', flashSale: false, partners: NO_PARTNERS, target: 'insights' },
  { title: 'Surplus builds', caption: 'By 5:30 PM, Chicken Chop and Kaya Toast are over-prepped. The engine suggests a 15% discount.', time: '5:30 PM', flashSale: false, partners: NO_PARTNERS, target: 'insights' },
  { title: 'Flash sale', caption: 'At 9 PM, three dishes go live on the BiteBack customer app at 40% off, one tap each.', time: '9:00 PM', flashSale: true, partners: NO_PARTNERS, target: 'sync' },
  { title: 'Customers see it', caption: 'Seconds later, nearby customers see the flash sale. One tap rescues a meal by delivery or pickup.', time: '9:00 PM', flashSale: true, partners: NO_PARTNERS, target: 'feed', view: 'customer' },
  { title: 'Today: the bin', caption: 'Whatever still does not sell goes to landfill. This is how most outlets close today.', time: '9:00 PM', flashSale: true, partners: NO_PARTNERS, target: 'recovery' },
  { title: 'Waste to value', caption: 'Switch on partners and the same surplus becomes staff meals, food-bank meals and insect feed.', time: '9:00 PM', flashSale: true, partners: ALL_PARTNERS, target: 'recovery' },
  { title: '30-day impact', caption: 'Repeated for 30 days at one outlet. Log real weights at close and these numbers become measured, not predicted.', time: '9:00 PM', flashSale: true, partners: ALL_PARTNERS, target: 'impact' },
  { title: 'Fix it at the source', caption: "Tomorrow's prep plan cuts over-prepping, so there is less surplus to rescue at all.", time: '9:00 PM', flashSale: true, partners: ALL_PARTNERS, target: 'forecast' },
]

export function useDemoStore() {
  const [currentView, setCurrentView] = useState('auth')
  const [timeOfDay, setTimeOfDay] = useState('12:00 PM')
  const [inventory, setInventory] = useState(SEED_INVENTORY)
  const [activePromos, setActivePromos] = useState([])
  const [customerImpact, setCustomerImpact] = useState(EMPTY_IMPACT)
  const [orders, setOrders] = useState([])
  const [toast, setToast] = useState(null)
  const [discounts, setDiscounts] = useState({})
  const [category, setCategory] = useState('All')
  const [partners, setPartners] = useState(NO_PARTNERS)
  const [closeLog, setCloseLog] = useState(EMPTY_LOG)
  const [pitchStep, setPitchStep] = useState(null)

  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(null), TOAST_MS)
    return () => clearTimeout(timer)
  }, [toast])

  useEffect(() => {
    if (pitchStep === null) return
    // Wait a frame so a view switch has rendered before scrolling to its target.
    const frame = requestAnimationFrame(() =>
      document.getElementById(PITCH_STEPS[pitchStep].target)?.scrollIntoView({ block: 'center' }))
    return () => cancelAnimationFrame(frame)
  }, [pitchStep])

  const notify = (message, detail) => setToast({ key: Date.now(), message, detail })

  const loadScenario = ({ time, flashSale, partners: nextPartners }) => {
    const flashPromos = SEED_INVENTORY
      .filter((item) => analyzeStock(item, '9:00 PM').type === 'overstock_critical')
      .map((item) => makePromo(item, 40, '9:00 PM'))
    setTimeOfDay(time)
    setInventory(SEED_INVENTORY)
    setActivePromos(flashSale ? flashPromos : [])
    setPartners(nextPartners)
    setCloseLog(EMPTY_LOG)
    setDiscounts({})
    setCategory('All')
  }

  const resetDemo = () => {
    setPitchStep(null)
    setCustomerImpact(EMPTY_IMPACT)
    setOrders([])
    loadScenario({ time: '12:00 PM', flashSale: false, partners: NO_PARTNERS })
  }

  const goToPitchStep = (n) => {
    loadScenario(PITCH_STEPS[n])
    setCurrentView(PITCH_STEPS[n].view ?? 'restaurant')
    setPitchStep(n)
  }

  /** `deal` is a live promo, or a mock mystery box from another restaurant (no inventory to sync). */
  const placeOrder = (deal, mode) => {
    if (deal.isLive) {
      const result = applyOrder(inventory, activePromos, deal.id)
      if (!result.ok) {
        notify('Sorry, that deal just sold out', deal.name)
        return false
      }
      setInventory(result.inventory)
      setActivePromos(result.promos)
    }
    setCustomerImpact((impact) => ({ mealsSaved: impact.mealsSaved + 1, co2Saved: impact.co2Saved + CO2E_PER_MEAL }))
    setOrders((list) => [{ key: Date.now(), name: deal.name, restaurant: deal.restaurant, price: deal.promoPrice, saved: deal.originalPrice - deal.promoPrice, mode, placedAt: timeOfDay }, ...list])
    notify('Order confirmed, meal rescued!', `${deal.name} · ${mode === 'delivery' ? 'Delivery OTP 4921' : 'Show QR at the counter'}`)
    return true
  }

  return {
    currentView, setCurrentView, timeOfDay, setTimeOfDay, inventory, setInventory, activePromos, setActivePromos,
    customerImpact, orders, toast, setToast, notify, discounts, setDiscounts, category, setCategory,
    partners, setPartners, closeLog, setCloseLog, pitchStep, setPitchStep,
    resetDemo, goToPitchStep, placeOrder,
  }
}
