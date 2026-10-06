// Formatting helpers shared across components.

const currency = new Intl.NumberFormat('en-MY', { style: 'currency', currency: 'MYR' })
export const rm = (n) => currency.format(n)
export const kg = (n) => `${n.toLocaleString('en-MY', { maximumFractionDigits: 1 })} kg`
export const shortName = (item) => item.short ?? item.name
export const cx = (...classes) => classes.filter(Boolean).join(' ')
