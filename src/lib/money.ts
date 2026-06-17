// Money helpers.
//
// Every money value in the new schema is stored as an integer in PKR paisa
// (the *_minor convention). Display formatting happens at the edge — never
// pass floats around the codebase. See ECOMMERCE_CMS_PLAN.md §2 and §G.X.

export type MinorUnits = number

const PAISA_PER_RUPEE = 100

/**
 * Convert a rupees-as-number (or a numeric string like "1,234.50") to integer
 * paisa. Rounds to the nearest paisa using bankers' rounding semantics from
 * Math.round (sufficient for retail prices in PKR which only has 2 decimals).
 *
 * Use at system boundaries only — admin form input, legacy decimal columns
 * during ETL, etc. Internal math never sees floats.
 */
export function rupeesToMinor(rupees: number | string): MinorUnits {
  const n = typeof rupees === 'string' ? Number(rupees.replace(/[, ]/g, '')) : rupees
  if (!Number.isFinite(n)) {
    throw new Error(`rupeesToMinor: not a finite number: ${rupees}`)
  }
  return Math.round(n * PAISA_PER_RUPEE)
}

/**
 * Convert integer paisa back to rupees as a Number — for display only.
 * Never feed the result back into another money calculation.
 */
export function minorToRupees(minor: MinorUnits): number {
  return minor / PAISA_PER_RUPEE
}

/**
 * Display formatter for PKR money. Renders as `Rs. 1,234.50` by default
 * (matches the existing storefront), with options to suppress the prefix
 * or the .00 fractional suffix.
 *
 *   formatPkr(180000)           => "Rs. 1,800.00"
 *   formatPkr(180000, { prefix: false }) => "1,800.00"
 *   formatPkr(180000, { trimDecimals: true })  => "Rs. 1,800"
 */
export function formatPkr(
  minor: MinorUnits,
  opts: { prefix?: boolean; trimDecimals?: boolean } = {}
): string {
  const { prefix = true, trimDecimals = false } = opts
  const rupees = minorToRupees(minor)
  const formatted = new Intl.NumberFormat('en-PK', {
    minimumFractionDigits: trimDecimals && rupees % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(rupees)
  return prefix ? `Rs. ${formatted}` : formatted
}

/**
 * Safe addition of minor-unit values. Just a typed wrapper that documents intent —
 * sums stay integer because all operands are integer.
 */
export function sumMinor(values: MinorUnits[]): MinorUnits {
  let total = 0
  for (const v of values) total += v
  return total
}
