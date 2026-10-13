export const BASE = 'RWF';

export const CURRENCIES = [
  { code: 'RWF', name: 'Rwandan francs', city: 'Kigali' },
  { code: 'KES', name: 'Kenyan shillings', city: 'Nairobi' },
  { code: 'UGX', name: 'Ugandan shillings', city: 'Kampala' },
  { code: 'TZS', name: 'Tanzanian shillings', city: 'Dar es Salaam' },
  { code: 'NGN', name: 'Nigerian naira', city: 'Lagos' },
  { code: 'GHS', name: 'Ghanaian cedis', city: 'Accra' },
  { code: 'XOF', name: 'West African CFA francs', city: 'Dakar' }
];

export const DEFAULT_RATES = { KES: 89, UGX: 2480, TZS: 1720, NGN: 1030, GHS: 8.6, XOF: 395 };

const round2 = value => Math.round(value * 100) / 100;

export function convert(amountRwf, code, rates) {
  if (code === BASE) return amountRwf;
  return round2(amountRwf * (rates[code] / 1000));
}

export function formatAmount(value) {
  const rounded = round2(value);
  const digits = Number.isInteger(rounded) ? 0 : 2;
  return new Intl.NumberFormat('en-US', { minimumFractionDigits: digits, maximumFractionDigits: 2 }).format(rounded);
}

export const compact = value =>
  new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(value);

export const money = (amountRwf, code, rates) => `${formatAmount(convert(amountRwf, code, rates))} ${code}`;

export const nameOf = code => CURRENCIES.find(c => c.code === code)?.name ?? code;
