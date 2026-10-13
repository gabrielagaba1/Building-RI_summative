export const PATTERNS = {
  description: /^\S(?:.*\S)?$/,
  doubleSpace: / {2,}/,
  amount: /^(0|[1-9]\d*)(\.\d{1,2})?$/,
  date: /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/,
  category: /^[A-Za-z]+(?:[ -][A-Za-z]+)*$/,
  duplicateWord: /\b(\w+)\s+\1\b/i,
  rate: /^(?=.*[1-9])\d{1,7}(?:\.\d{1,4})?$/,
  recordId: /^rec_\d{4,}$/
};

const MAX_AMOUNT = 100000000;

function isRealDate(value) {
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

export function checkDescription(value) {
  if (!value) return 'Give it a name. Even "snacks" counts.';
  if (!PATTERNS.description.test(value)) return 'Remove the spaces at the start or the end.';
  if (PATTERNS.doubleSpace.test(value)) return 'Two spaces in a row snuck in. One is plenty.';
  if (value.length > 80) return 'Keep it under 80 characters.';
  return '';
}

export function repeatedWord(value) {
  const match = value.match(PATTERNS.duplicateWord);
  return match ? match[0] : '';
}

export function checkAmount(value) {
  if (!value) return 'How much was it?';
  if (!PATTERNS.amount.test(value)) return 'Digits only, no leading zeros, at most two decimals. Like 3500 or 12.50.';
  if (Number(value) > MAX_AMOUNT) return 'That is over 100 million francs. Check the zeros.';
  return '';
}

export function checkDate(value) {
  if (!value) return 'When was it?';
  if (!PATTERNS.date.test(value)) return 'Write it as year, month, day: 2026-10-13.';
  if (!isRealDate(value)) return 'That day does not exist on any calendar.';
  return '';
}

export function checkCategory(value, existing = []) {
  if (!value) return 'Name the category.';
  if (!PATTERNS.category.test(value)) return 'Letters only, with single spaces between words.';
  if (existing.some(name => name.toLowerCase() === value.toLowerCase())) return `${value} is already on the list.`;
  return '';
}

export function checkRate(value) {
  if (!value) return 'Needs a rate.';
  if (!PATTERNS.rate.test(value)) return 'A number above zero, up to four decimals.';
  return '';
}

export function checkCap(value) {
  if (value === '') return 'Enter a cap, or 0 to switch it off.';
  if (!PATTERNS.amount.test(value)) return 'Digits only, at most two decimals.';
  if (Number(value) > MAX_AMOUNT) return 'Keep it under 100 million.';
  return '';
}

export function checkField(name, value) {
  switch (name) {
    case 'description': {
      const error = checkDescription(value);
      const repeat = error ? '' : repeatedWord(value);
      return { error, warning: repeat ? `"${repeat}" repeats a word. Keep it if you meant it.` : '' };
    }
    case 'amount':
      return { error: checkAmount(value) };
    case 'date':
      return { error: checkDate(value) };
    case 'category':
      return { error: value ? '' : 'Pick a category.' };
    default:
      return { error: '' };
  }
}

export function checkEntry(values) {
  const results = {};
  for (const name of ['description', 'amount', 'date', 'category']) results[name] = checkField(name, values[name] ?? '');
  const ok = Object.values(results).every(result => !result.error);
  return { ok, results };
}

export function validateRecord(record) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) return ['is not an entry object'];
  const problems = [];
  if (typeof record.id !== 'string' || !PATTERNS.recordId.test(record.id)) problems.push('id should look like rec_0001');
  if (typeof record.description !== 'string' || checkDescription(record.description)) problems.push('description is missing or has stray spaces');
  if (typeof record.amount !== 'number' || !Number.isFinite(record.amount) || checkAmount(String(record.amount))) problems.push('amount must be a number from 0 with at most two decimals');
  if (typeof record.category !== 'string' || !PATTERNS.category.test(record.category)) problems.push('category must be letters and spaces');
  if (typeof record.date !== 'string' || checkDate(record.date)) problems.push('date must be a real YYYY-MM-DD date');
  for (const key of ['createdAt', 'updatedAt']) {
    if (typeof record[key] !== 'string' || Number.isNaN(Date.parse(record[key]))) problems.push(`${key} must be a timestamp`);
  }
  return problems;
}

export function validateDataset(data) {
  const list = Array.isArray(data) ? data : Array.isArray(data?.records) ? data.records : null;
  if (!list) return { ok: false, errors: ['The file should contain a list of entries, or an object with a "records" list.'] };

  const errors = [];
  const seen = new Set();
  list.forEach((record, index) => {
    validateRecord(record).forEach(problem => errors.push(`Entry ${index + 1}: ${problem}.`));
    if (record?.id && seen.has(record.id)) errors.push(`Entry ${index + 1}: id ${record.id} appears twice.`);
    seen.add(record?.id);
  });
  if (errors.length) return { ok: false, errors };

  const records = list.map(({ id, description, amount, category, date, createdAt, updatedAt }) =>
    ({ id, description, amount, category, date, createdAt, updatedAt }));
  const settings = data && !Array.isArray(data) && typeof data.settings === 'object' ? data.settings : null;
  return { ok: true, records, settings };
}
