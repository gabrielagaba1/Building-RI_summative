import * as store from './state.js';
import * as ui from './ui.js';
import * as theme from './theme.js';
import { go, startRouter } from './router.js';
import { compileRegex, filterRecords } from './search.js';
import { capStatus, isoDay, summarize } from './stats.js';
import { DEFAULT_RATES, money, nameOf } from './currency.js';
import { checkCap, checkCategory, checkEntry, checkField, checkRate, validateDataset } from './validators.js';
import { download, fetchSeed, fileName, readJson, toCsv, toJson } from './io.js';

const $ = id => document.getElementById(id);
const entryForm = $('entry-form');
const ledgerBody = $('ledger-body');
const touched = new Set();
const ROUTE_KEYS = { 1: 'dashboard', 2: 'ledger', 3: 'issue', 4: 'settings', 5: 'about' };
let lastCapKey = '';
let slipHold = 0;

/* Rendering */

function refreshDashboard(state) {
  const summary = summarize(state.records);
  const status = capStatus(summary.total, state.settings.cap);
  ui.renderNote(summary, state.settings, status);
  ui.renderStats(summary, state.settings);
  ui.renderWeek(summary.week, state.settings);
  ui.renderCategories(summary, state.settings);
  return status;
}

function refreshLedger(state) {
  const search = compileRegex(state.view.pattern, state.view.matchCase);
  const sorted = store.sortRecords(state.records, state.view.sort);
  ui.renderLedger(state, filterRecords(sorted, search.re), search);
  store.clearFresh();
}

function refreshSettings(state) {
  ui.renderCoins(state.settings.currency);
  const counts = new Map();
  state.records.forEach(r => counts.set(r.category, (counts.get(r.category) || 0) + 1));
  ui.renderCategoryChips(state.settings.categories, counts);
  ui.fillCategorySelect($('f-category'), state.settings.categories);
  if (document.activeElement !== $('f-cap')) $('f-cap').value = String(state.settings.cap);
}

function refreshSlip() {
  if (Date.now() < slipHold) return;
  ui.renderSlip(formValues(entryForm), store.getState().settings, ui.serial(store.nextId()));
}

function syncTheme() {
  ui.syncThemeControls(theme.preference(), theme.effective());
}

store.subscribe((state, reason, detail) => {
  if (reason !== 'view') {
    const status = refreshDashboard(state);
    refreshSettings(state);
    refreshSlip();
    if (reason === 'replace') ui.renderRates(state.settings);
    const key = `${status.state}:${status.remaining}`;
    if (key !== lastCapKey) {
      lastCapKey = key;
      ui.announceCap(ui.capMessage(status, state.settings), status.state === 'over');
    }
    if (detail.saved === false) ui.say('This browser would not save the change. Storage may be full or blocked.');
  }
  refreshLedger(state);
});

/* Shared form helpers */

function formValues(form) {
  const data = new FormData(form);
  const value = name => String(data.get(name) ?? '');
  return { description: value('description'), amount: value('amount'), date: value('date'), category: value('category') };
}

function showResults(form, results) {
  form.querySelectorAll('.field[data-field]').forEach(field => {
    const result = results[field.dataset.field];
    if (result) ui.setFieldState(field, result, true);
  });
}

const toRecordFields = values => ({
  description: values.description,
  amount: Number(values.amount),
  category: values.category,
  date: values.date
});

/* New entry */

function validateEntryField(field) {
  const control = field.querySelector('input, select');
  const name = field.dataset.field;
  const isTouched = touched.has(name) || control.value !== '';
  ui.setFieldState(field, checkField(name, control.value), isTouched);
}

function resetEntryForm(category) {
  $('f-description').value = '';
  $('f-amount').value = '';
  $('f-date').value = isoDay(new Date());
  if (category) $('f-category').value = category;
  touched.clear();
  entryForm.querySelectorAll('.field').forEach(ui.resetField);
}

entryForm.addEventListener('input', event => {
  const field = event.target.closest('.field');
  if (field) validateEntryField(field);
  slipHold = 0;
  refreshSlip();
});

entryForm.addEventListener('focusout', event => {
  const field = event.target.closest('.field');
  if (!field || !event.target.matches('input, select')) return;
  touched.add(field.dataset.field);
  validateEntryField(field);
});

entryForm.addEventListener('submit', event => {
  event.preventDefault();
  const values = formValues(entryForm);
  const { ok, results } = checkEntry(values);
  showResults(entryForm, results);
  if (!ok) {
    const count = Object.values(results).filter(result => result.error).length;
    entryForm.querySelector('[aria-invalid="true"]')?.focus();
    ui.announce(`${count === 1 ? 'One field needs' : `${count} fields need`} fixing before this can be issued.`);
    return;
  }
  const record = store.addRecord(toRecordFields(values));
  ui.renderSlip(values, store.getState().settings, ui.serial(record.id));
  ui.stampSlip();
  slipHold = Date.now() + 1600;
  setTimeout(refreshSlip, 1650);
  ui.say(`Issued ${ui.serial(record.id)}. Into the ledger it goes.`);
  resetEntryForm(values.category);
  $('f-description').focus();
});

entryForm.addEventListener('reset', event => {
  event.preventDefault();
  resetEntryForm();
  slipHold = 0;
  refreshSlip();
  $('f-description').focus();
});

$('f-today').addEventListener('click', () => {
  $('f-date').value = isoDay(new Date());
  validateEntryField($('f-date').closest('.field'));
  refreshSlip();
});

/* Ledger */

function pushSearch() {
  store.setSearch($('search').value, $('match-case').checked);
}

function focusRowButton(id, action) {
  const target = ledgerBody.querySelector(`tr[data-id="${id}"] [data-action="${action}"]`);
  (target || $('search')).focus();
}

async function deleteEntry(id) {
  const record = store.findRecord(id);
  if (!record) return;
  const { currency, rates } = store.getState().settings;
  const confirmed = await ui.confirmDialog({
    title: `Delete ${ui.serial(id)}?`,
    body: `"${record.description}" for ${money(record.amount, currency, rates)} leaves the ledger for good. There is no undo.`,
    confirm: 'Delete it'
  });
  if (!confirmed) return;
  const rows = [...ledgerBody.querySelectorAll('tr[data-id]')];
  const index = rows.findIndex(row => row.dataset.id === id);
  const neighbour = rows[index + 1]?.dataset.id ?? rows[index - 1]?.dataset.id;
  store.removeRecord(id);
  ui.say(`${ui.serial(id)} deleted. The note just got lighter.`);
  if (neighbour) focusRowButton(neighbour, 'delete');
  else $('search').focus();
}

$('search').addEventListener('input', pushSearch);
$('match-case').addEventListener('change', pushSearch);

document.querySelectorAll('.try').forEach(button => {
  button.addEventListener('click', () => {
    $('search').value = button.dataset.pattern;
    pushSearch();
    $('search').focus();
  });
});

document.querySelectorAll('[data-sort]').forEach(button => {
  button.addEventListener('click', () => store.setSort(button.dataset.sort));
});

ledgerBody.addEventListener('click', event => {
  const button = event.target.closest('[data-action]');
  if (!button) return;
  const id = button.closest('tr').dataset.id;
  const { action } = button.dataset;
  if (action === 'edit') {
    store.setEditing(id);
    ledgerBody.querySelector(`form[data-id="${id}"] input`)?.focus();
  } else if (action === 'cancel') {
    store.setEditing(null);
    focusRowButton(id, 'edit');
  } else if (action === 'delete') {
    deleteEntry(id);
  }
});

ledgerBody.addEventListener('input', event => {
  const field = event.target.closest('.inline-edit .field');
  if (field) ui.setFieldState(field, checkField(field.dataset.field, event.target.value), true);
});

ledgerBody.addEventListener('submit', event => {
  const form = event.target.closest('.inline-edit');
  if (!form) return;
  event.preventDefault();
  const values = formValues(form);
  const { ok, results } = checkEntry(values);
  showResults(form, results);
  if (!ok) {
    form.querySelector('[aria-invalid="true"]')?.focus();
    ui.announce('Fix the highlighted fields to save.');
    return;
  }
  const { id } = form.dataset;
  store.updateRecord(id, toRecordFields(values));
  ui.say(`Saved ${ui.serial(id)}.`);
  focusRowButton(id, 'edit');
});

ledgerBody.addEventListener('keydown', event => {
  const form = event.target.closest('.inline-edit');
  if (event.key !== 'Escape' || !form) return;
  const { id } = form.dataset;
  store.setEditing(null);
  focusRowButton(id, 'edit');
});

/* Currency coins */

document.addEventListener('click', event => {
  const coin = event.target.closest('[data-currency]');
  if (!coin) return;
  const code = coin.dataset.currency;
  ui.flipCoins(code);
  if (store.getState().settings.currency === code) return;
  store.updateSettings({ currency: code });
  ui.announce(`Showing amounts in ${nameOf(code)}.`);
});

/* Settings */

$('rates-form').addEventListener('input', event => {
  const field = event.target.closest('.field');
  if (field) ui.setFieldState(field, { error: checkRate(event.target.value) }, true);
});

$('rates-form').addEventListener('submit', event => {
  event.preventDefault();
  const rates = {};
  let firstBad = null;
  $('rates-form').querySelectorAll('.field').forEach(field => {
    const input = field.querySelector('input');
    const error = checkRate(input.value);
    ui.setFieldState(field, { error }, true);
    if (error && !firstBad) firstBad = input;
    rates[input.name] = Number(input.value);
  });
  if (firstBad) {
    firstBad.focus();
    ui.announce('One of the rates needs fixing.');
    return;
  }
  store.updateSettings({ rates });
  ui.say('Rates saved. Every amount has been recalculated.');
});

$('rates-reset').addEventListener('click', () => {
  store.updateSettings({ rates: { ...DEFAULT_RATES } });
  ui.renderRates(store.getState().settings);
  ui.say('Back to the starting rates.');
});

$('cap-form').addEventListener('input', () => {
  ui.setFieldState($('f-cap').closest('.field'), { error: checkCap($('f-cap').value) }, true);
});

$('cap-form').addEventListener('submit', event => {
  event.preventDefault();
  const error = checkCap($('f-cap').value);
  ui.setFieldState($('f-cap').closest('.field'), { error }, true);
  if (error) {
    $('f-cap').focus();
    return;
  }
  const cap = Number($('f-cap').value);
  store.updateSettings({ cap });
  const { currency, rates } = store.getState().settings;
  ui.say(cap === 0 ? 'Cap switched off.' : `Cap set to ${money(cap, currency, rates)}.`);
});

$('category-form').addEventListener('input', () => {
  const input = $('f-new-category');
  const error = input.value ? checkCategory(input.value, store.getState().settings.categories) : '';
  ui.setFieldState(input.closest('.field'), { error }, Boolean(input.value));
});

$('category-form').addEventListener('submit', event => {
  event.preventDefault();
  const input = $('f-new-category');
  const { categories } = store.getState().settings;
  const error = checkCategory(input.value, categories);
  ui.setFieldState(input.closest('.field'), { error }, true);
  if (error) {
    input.focus();
    return;
  }
  const name = input.value;
  store.updateSettings({ categories: [...categories, name] });
  input.value = '';
  ui.resetField(input.closest('.field'));
  input.focus();
  ui.say(`Added ${name}.`);
});

$('category-list').addEventListener('click', event => {
  const button = event.target.closest('[data-remove-category]');
  if (!button) return;
  const name = button.dataset.removeCategory;
  const { records, settings } = store.getState();
  const used = records.filter(r => r.category === name).length;
  if (used) {
    ui.say(`${name} still has ${used} ${used === 1 ? 'entry' : 'entries'}. Move ${used === 1 ? 'it' : 'them'} first.`);
    return;
  }
  if (settings.categories.length === 1) {
    ui.say('Keep at least one category.');
    return;
  }
  store.updateSettings({ categories: settings.categories.filter(c => c !== name) });
  $('f-new-category').focus();
  ui.say(`Removed ${name}.`);
});

document.querySelectorAll('input[name="theme"]').forEach(radio => {
  radio.addEventListener('change', () => {
    theme.setTheme(radio.value);
    syncTheme();
  });
});

$('theme-toggle').addEventListener('click', () => {
  theme.toggleTheme();
  syncTheme();
  ui.announce(`${theme.effective() === 'dark' ? 'Dark' : 'Light'} mode on.`);
});

theme.onSystemChange(syncTheme);

/* Data in and out */

function exportAs(kind) {
  const { records, settings } = store.getState();
  const name = fileName(kind);
  if (kind === 'json') download(name, toJson(records, settings), 'application/json');
  else download(name, toCsv(records), 'text/csv');
  ui.renderReport([`Exported ${records.length} entries to ${name}.`], false);
}

async function loadDataset(data, sourceName) {
  const result = validateDataset(data);
  if (!result.ok) {
    ui.renderReport([`${sourceName} was not loaded. Nothing changed.`, ...result.errors], true);
    ui.announce(`Import stopped. ${result.errors.length} ${result.errors.length === 1 ? 'problem' : 'problems'} found.`);
    return;
  }
  const count = store.getState().records.length;
  if (count) {
    const confirmed = await ui.confirmDialog({
      title: 'Replace your ledger?',
      body: `Your ${count} ${count === 1 ? 'entry' : 'entries'} will be swapped for the ${result.records.length} in ${sourceName}. Export first if you want a backup.`,
      confirm: 'Replace'
    });
    if (!confirmed) return;
  }
  store.replaceAll(result.records, result.settings);
  ui.renderReport([`Loaded ${result.records.length} entries from ${sourceName}.`], false);
  ui.say(`Loaded ${result.records.length} entries.`);
}

$('export-json').addEventListener('click', () => exportAs('json'));
$('export-csv').addEventListener('click', () => exportAs('csv'));

$('import-file').addEventListener('change', async event => {
  const [file] = event.target.files;
  event.target.value = '';
  if (!file) return;
  try {
    await loadDataset(await readJson(file), file.name);
  } catch {
    ui.renderReport([`${file.name} is not valid JSON. It may be cut short or not JSON at all. Nothing changed.`], true);
    ui.announce('Import stopped. The file is not valid JSON.');
  }
});

$('load-sample').addEventListener('click', async () => {
  try {
    await loadDataset(await fetchSeed(), 'the sample file');
  } catch {
    ui.renderReport(['The sample file could not be reached. Open the app through a local server or GitHub Pages.'], true);
  }
});

$('wipe').addEventListener('click', async () => {
  const confirmed = await ui.confirmDialog({
    title: 'Erase everything?',
    body: 'Every entry, rate, cap and category goes back to blank paper. Export first if you might want it back.',
    confirm: 'Erase'
  });
  if (!confirmed) return;
  store.wipe();
  ui.renderReport(['Everything erased. Fresh paper.'], false);
  ui.say('Everything erased.');
});

/* Keyboard */

document.addEventListener('keydown', event => {
  if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) return;
  if (event.target.closest?.('input, select, textarea, [contenteditable="true"]') || $('confirm').open) return;
  const key = event.key.toLowerCase();
  if (ROUTE_KEYS[key]) {
    go(ROUTE_KEYS[key]);
  } else if (key === 'n') {
    go('issue', '#f-description');
  } else if (key === '/') {
    event.preventDefault();
    go('ledger', '#search');
  } else if (key === 't') {
    theme.toggleTheme();
    syncTheme();
  }
});

/* Start */

async function boot() {
  const { firstRun, skipped } = store.hydrate();
  const state = store.getState();
  syncTheme();
  ui.renderRates(state.settings);
  refreshSettings(state);
  resetEntryForm(state.settings.categories[0]);
  const status = refreshDashboard(state);
  lastCapKey = `${status.state}:${status.remaining}`;
  refreshLedger(state);
  refreshSlip();
  startRouter(name => {
    if (name === 'issue') refreshSlip();
  });

  if (skipped) ui.say(`${skipped} damaged ${skipped === 1 ? 'entry was' : 'entries were'} skipped while loading.`);

  if (firstRun) {
    try {
      const result = validateDataset(await fetchSeed());
      if (result.ok) {
        store.replaceAll(result.records);
        ui.say('Loaded sample entries so the note is not blank. Erase them in Settings anytime.');
      }
    } catch {
      ui.announce('Starting with a blank ledger.');
    }
  }
}

boot();
