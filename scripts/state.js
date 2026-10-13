import * as storage from './storage.js';
import { BASE, CURRENCIES, DEFAULT_RATES } from './currency.js';
import { PATTERNS, validateRecord } from './validators.js';

export const DEFAULT_CATEGORIES = ['Food', 'Books', 'Transport', 'Entertainment', 'Fees', 'Other'];
export const DEFAULT_CAP = 2000000;

const SORT_DEFAULTS = { date: 'desc', description: 'asc', amount: 'desc' };
const COMPARE = {
  date: (a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt),
  description: (a, b) => a.description.localeCompare(b.description, 'en', { sensitivity: 'base' }),
  amount: (a, b) => a.amount - b.amount
};

const defaults = () => ({
  currency: BASE,
  rates: { ...DEFAULT_RATES },
  cap: DEFAULT_CAP,
  categories: [...DEFAULT_CATEGORIES]
});

const state = {
  records: [],
  settings: defaults(),
  view: { sort: { key: 'date', dir: 'desc' }, pattern: '', matchCase: false, editingId: null, freshId: null }
};

const listeners = new Set();
const now = () => new Date().toISOString();

export const getState = () => state;

export function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function emit(reason, detail = {}) {
  listeners.forEach(listener => listener(state, reason, detail));
}

function commit(reason, detail = {}) {
  const saved = storage.saveRecords(state.records);
  emit(reason, { ...detail, saved });
}

export function sanitizeSettings(input) {
  const base = defaults();
  if (!input || typeof input !== 'object') return base;

  const currency = CURRENCIES.some(c => c.code === input.currency) ? input.currency : base.currency;
  const rates = { ...base.rates };
  for (const code of Object.keys(rates)) {
    const value = input.rates?.[code];
    if (typeof value === 'number' && Number.isFinite(value) && value > 0) rates[code] = value;
  }
  const cap = typeof input.cap === 'number' && Number.isFinite(input.cap) && input.cap >= 0 ? input.cap : base.cap;
  const seen = new Set();
  const categories = (Array.isArray(input.categories) ? input.categories : []).filter(name => {
    if (typeof name !== 'string' || !PATTERNS.category.test(name) || seen.has(name.toLowerCase())) return false;
    seen.add(name.toLowerCase());
    return true;
  });

  return { currency, rates, cap, categories: categories.length ? categories : base.categories };
}

export function hydrate() {
  state.settings = sanitizeSettings(storage.loadSettings());
  const stored = storage.loadRecords();
  if (stored === null) return { firstRun: true, skipped: 0 };
  const list = Array.isArray(stored) ? stored : [];
  state.records = list.filter(record => validateRecord(record).length === 0);
  const skipped = Array.isArray(stored) ? list.length - state.records.length : 1;
  if (skipped) storage.saveRecords(state.records);
  return { firstRun: false, skipped };
}

export function nextId() {
  const highest = state.records.reduce((max, r) => Math.max(max, Number(r.id.slice(4)) || 0), 0);
  return `rec_${String(highest + 1).padStart(4, '0')}`;
}

export const findRecord = id => state.records.find(r => r.id === id);

export function addRecord(fields) {
  const stamp = now();
  const record = { id: nextId(), ...fields, createdAt: stamp, updatedAt: stamp };
  state.records.push(record);
  state.view.freshId = record.id;
  commit('add', { record });
  return record;
}

export function updateRecord(id, fields) {
  const record = findRecord(id);
  if (!record) return null;
  Object.assign(record, fields, { updatedAt: now() });
  state.view.editingId = null;
  state.view.freshId = id;
  commit('update', { record });
  return record;
}

export function removeRecord(id) {
  const index = state.records.findIndex(r => r.id === id);
  if (index === -1) return null;
  const [record] = state.records.splice(index, 1);
  if (state.view.editingId === id) state.view.editingId = null;
  commit('remove', { record });
  return record;
}

export function replaceAll(records, settings = null) {
  const merged = sanitizeSettings(settings ? { ...state.settings, ...settings } : state.settings);
  const known = new Set(merged.categories.map(name => name.toLowerCase()));
  records.forEach(r => {
    if (!known.has(r.category.toLowerCase())) {
      known.add(r.category.toLowerCase());
      merged.categories.push(r.category);
    }
  });
  state.records = records.map(r => ({ ...r }));
  state.settings = merged;
  state.view.editingId = null;
  state.view.freshId = null;
  storage.saveSettings(state.settings);
  commit('replace');
}

export function wipe() {
  state.records = [];
  state.settings = defaults();
  state.view.editingId = null;
  storage.saveSettings(state.settings);
  commit('replace');
}

export function updateSettings(patch) {
  state.settings = sanitizeSettings({ ...state.settings, ...patch });
  const saved = storage.saveSettings(state.settings);
  emit('settings', { saved });
}

export function setSort(key) {
  const { sort } = state.view;
  state.view.sort = sort.key === key
    ? { key, dir: sort.dir === 'asc' ? 'desc' : 'asc' }
    : { key, dir: SORT_DEFAULTS[key] };
  emit('view');
}

export function setSearch(pattern, matchCase) {
  state.view.pattern = pattern;
  state.view.matchCase = matchCase;
  emit('view');
}

export function setEditing(id) {
  state.view.editingId = id;
  emit('view');
}

export function clearFresh() {
  state.view.freshId = null;
}

export function sortRecords(records, { key, dir }) {
  const sign = dir === 'asc' ? 1 : -1;
  return [...records].sort((a, b) => COMPARE[key](a, b) * sign);
}
