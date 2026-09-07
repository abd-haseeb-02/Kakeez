// Kakeez's public contact details, in one place.
//
// These were previously hard-coded as placeholder values in both the footer
// and the contact page, which is how a bakery ends up shipping a US phone
// number to a Lahore storefront. Anything customer-facing that needs an
// address, a phone number or an email should read it from here.

export const CONTACT = {
  email: 'hello@kakeez.com',

  // Displayed in local format; `tel:` needs E.164 to dial correctly from
  // outside Pakistan, so the two are kept separate on purpose.
  phone: '0317 4304211',
  phoneHref: 'tel:+923174304211',

  // Split for the footer's narrow column; joined for single-line contexts.
  addressLines: ['414 D Block, Baig Road', 'Phase 1, Johar Town, Lahore'],

  city: 'Lahore',
} as const

export const addressOneLine = CONTACT.addressLines.join(', ')
