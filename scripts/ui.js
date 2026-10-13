import { CURRENCIES, compact, convert, formatAmount, money, nameOf } from './currency.js';
import { amountText, escapeHtml, highlight, hits } from './search.js';

const $ = id => document.getElementById(id);
const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export const serial = id => `AF ${id.slice(4)}`;

export function prettyDate(iso) {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

/* Announcements */

function speak(region, message) {
  region.textContent = '';
  window.setTimeout(() => { region.textContent = message; }, 80);
}

let toastTimer;

export function announce(message) {
  speak($('live-polite'), message);
}

export function toast(message) {
  const el = $('toast');
  el.textContent = message;
  el.classList.add('is-shown');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('is-shown'), 3400);
}

export function say(message) {
  announce(message);
  toast(message);
}

export function announceCap(message, urgent) {
  speak($(urgent ? 'cap-assertive' : 'cap-polite'), message);
}

/* Dialog */

export function confirmDialog({ title, body, confirm = 'Confirm', danger = true }) {
  const dialog = $('confirm');
  const opener = document.activeElement;
  $('confirm-title').textContent = title;
  $('confirm-body').textContent = body;
  const ok = $('confirm-ok');
  ok.textContent = confirm;
  ok.className = `btn ${danger ? 'btn--danger' : 'btn--gold'}`;
  dialog.returnValue = '';
  dialog.showModal();
  return new Promise(resolve => {
    dialog.addEventListener('close', () => {
      resolve(dialog.returnValue === 'ok');
      if (opener?.isConnected) opener.focus();
    }, { once: true });
  });
}

/* Numbers that roll */

const shown = new WeakMap();

function rollTo(el, target) {
  const from = shown.get(el) ?? 0;
  shown.set(el, target);
  cancelAnimationFrame(el.rollFrame);
  if (reducedMotion() || from === target) {
    el.textContent = formatAmount(target);
    return;
  }
  const start = performance.now();
  const step = time => {
    const t = Math.min(1, (time - start) / 750);
    const eased = 1 - (1 - t) ** 3;
    el.textContent = t < 1 ? formatAmount(Math.round(from + (target - from) * eased)) : formatAmount(target);
    if (t < 1) el.rollFrame = requestAnimationFrame(step);
  };
  el.rollFrame = requestAnimationFrame(step);
}

/* Dashboard */

export function capMessage(status, settings) {
  const { currency, rates, cap } = settings;
  if (status.state === 'none') return 'No cap set. Living dangerously.';
  if (status.state === 'over') return `Over the ${money(cap, currency, rates)} cap by ${money(-status.remaining, currency, rates)}. Your wallet would like a word.`;
  if (status.state === 'close') return `Only ${money(status.remaining, currency, rates)} left before the cap. Easy on the brochettes.`;
  return `${money(status.remaining, currency, rates)} left under your ${money(cap, currency, rates)} cap.`;
}

export function renderNote(summary, settings, status) {
  const { currency, rates } = settings;
  const note = $('note');
  rollTo($('note-amount'), convert(summary.total, currency, rates));
  $('note-currency').textContent = nameOf(currency);
  $('note-serial').textContent = summary.latest
    ? `${serial(summary.latest.id)} · ${prettyDate(summary.latest.date).toUpperCase()}`
    : 'AF 0000 · BLANK NOTE';
  $('note-meta').textContent = summary.count === 1 ? 'One entry on record' : `${summary.count} entries on record`;

  const fill = Math.min(status.percent, 100);
  $('note-percent').innerHTML = `${status.percent}<span>%</span>`;
  const meter = $('cap-meter');
  meter.style.setProperty('--fill', `${fill}%`);
  meter.setAttribute('aria-valuenow', String(fill));
  meter.setAttribute('aria-valuetext', status.state === 'none' ? 'No cap set' : `${status.percent} percent of the cap`);
  $('cap-message').textContent = capMessage(status, settings);
  note.classList.toggle('is-over', status.state === 'over');
  note.classList.toggle('is-close', status.state === 'close');
}

export function renderCoins(active) {
  document.querySelectorAll('[data-coins]').forEach(group => {
    if (!group.childElementCount) {
      group.innerHTML = CURRENCIES.map(c =>
        `<button type="button" class="coin" data-currency="${c.code}" aria-pressed="false" title="${c.name}">${c.code}<span class="visually-hidden">, ${c.name}</span></button>`
      ).join('');
    }
    group.querySelectorAll('.coin').forEach(coin => coin.setAttribute('aria-pressed', String(coin.dataset.currency === active)));
  });
  document.querySelectorAll('[data-show-code]').forEach(el => { el.textContent = active; });
}

export function flipCoins(code) {
  document.querySelectorAll(`.coin[data-currency="${code}"]`).forEach(coin => {
    coin.classList.remove('is-flipping');
    void coin.offsetWidth;
    coin.classList.add('is-flipping');
  });
}

export function renderStats(summary, settings) {
  const { currency, rates } = settings;
  $('stat-count').textContent = summary.count;
  $('stat-top').textContent = summary.top || 'None yet';
  rollTo($('stat-month'), convert(summary.thisMonth, currency, rates));
  rollTo($('stat-average'), convert(summary.average, currency, rates));
}

export function renderWeek(week, settings) {
  const { currency, rates } = settings;
  const max = Math.max(...week.map(day => day.amount));
  const sum = week.reduce((total, day) => total + day.amount, 0);
  $('week-empty').hidden = max > 0;
  $('week-bars').hidden = max === 0;
  $('week-total').textContent = `${money(sum, currency, rates)} across the last seven days`;
  $('week-bars').innerHTML = week.map((day, i) => {
    const height = max ? (day.amount / max) * 100 : 0;
    const classes = [day.amount && day.amount === max ? 'is-peak' : '', day.isToday ? 'is-today' : ''].join(' ').trim();
    return `<li style="--h:${height.toFixed(1)}%;--i:${i}" class="${classes}">
      <span class="val" aria-hidden="true">${compact(convert(day.amount, currency, rates))}</span>
      <span class="bar" aria-hidden="true"></span>
      <span class="day" aria-hidden="true">${day.short}</span>
      <span class="visually-hidden">${day.long}: ${money(day.amount, currency, rates)}</span>
    </li>`;
  }).join('');
}

export function renderCategories(summary, settings) {
  const { currency, rates } = settings;
  const list = $('cat-list');
  if (!summary.categories.length) {
    list.innerHTML = '<li class="quiet">Nothing yet. Your first entry will show up here.</li>';
    return;
  }
  const max = summary.categories[0].amount || 1;
  list.innerHTML = summary.categories.slice(0, 6).map(c => `<li class="cat">
      <span>${escapeHtml(c.name)}</span>
      <span class="cat__amt">${money(c.amount, currency, rates)}</span>
      <span class="cat__bar" aria-hidden="true"><span style="--w:${((c.amount / max) * 100).toFixed(1)}%"></span></span>
    </li>`).join('');
}

/* Ledger */

const SORT_WORDS = {
  date: { desc: 'newest first', asc: 'oldest first' },
  description: { asc: 'A to Z', desc: 'Z to A' },
  amount: { desc: 'largest first', asc: 'smallest first' }
};

function categoryOptions(categories, selected) {
  const names = categories.includes(selected) || !selected ? categories : [...categories, selected];
  return names.map(name => `<option${name === selected ? ' selected' : ''}>${escapeHtml(name)}</option>`).join('');
}

function editField(id, name, label, control) {
  return `<div class="field" data-field="${name}">
    <label for="e-${id}-${name}">${label}</label>
    ${control}
    <p class="msg" id="e-${id}-${name}-msg"></p>
  </div>`;
}

function editRow(record, categories) {
  const { id } = record;
  const describe = name => `id="e-${id}-${name}" name="${name}" aria-describedby="e-${id}-${name}-msg" autocomplete="off"`;
  return `<tr data-id="${id}" class="is-editing">
    <td class="c-serial">${serial(id)}</td>
    <td class="c-edit" colspan="4">
      <form class="inline-edit" data-id="${id}" novalidate aria-label="Edit ${serial(id)}">
        ${editField(id, 'description', 'Description', `<input ${describe('description')} maxlength="80" value="${escapeHtml(record.description)}">`)}
        ${editField(id, 'amount', 'Amount in RWF', `<input ${describe('amount')} inputmode="decimal" value="${amountText(record.amount)}">`)}
        ${editField(id, 'category', 'Category', `<select ${describe('category')}>${categoryOptions(categories, record.category)}</select>`)}
        ${editField(id, 'date', 'Date', `<input ${describe('date')} inputmode="numeric" value="${record.date}">`)}
        <div class="inline-edit__actions">
          <button type="submit" class="btn btn--gold btn--small">Save changes</button>
          <button type="button" class="btn btn--small" data-action="cancel">Cancel</button>
        </div>
      </form>
    </td>
  </tr>`;
}

function row(record, re, settings, fresh) {
  const { currency, rates } = settings;
  const label = `${serial(record.id)}, ${escapeHtml(record.description)}`;
  const date = `<time datetime="${record.date}">${prettyDate(record.date)}</time>`;
  const base = currency === 'RWF' ? '' : `<span class="base">${formatAmount(record.amount)} RWF</span>`;
  const amount = `${formatAmount(convert(record.amount, currency, rates))} <span class="code">${currency}</span>`;
  const amountHit = re && hits(re, amountText(record.amount));
  const dateHit = re && hits(re, record.date);
  return `<tr data-id="${record.id}"${fresh ? ' class="is-fresh"' : ''}>
    <td class="c-serial">${serial(record.id)}</td>
    <td class="c-date">${dateHit ? `<mark>${date}</mark>` : date}</td>
    <td class="c-entry"><span class="entry">${highlight(record.description, re)}</span><span class="tag">${highlight(record.category, re)}</span></td>
    <td class="c-amount">${amountHit ? `<mark>${amount}</mark>` : amount}${base}</td>
    <td class="c-actions">
      <button type="button" class="link-btn" data-action="edit" aria-label="Edit ${label}">Edit</button>
      <button type="button" class="link-btn link-btn--danger" data-action="delete" aria-label="Delete ${label}">Delete</button>
    </td>
  </tr>`;
}

export function renderLedger(state, visible, search) {
  const { records, settings, view } = state;
  const { key, dir } = view.sort;

  $('ledger-empty').hidden = records.length > 0;
  $('ledger-table').hidden = visible.length === 0;
  $('ledger-body').innerHTML = visible
    .map(r => (r.id === view.editingId ? editRow(r, settings.categories) : row(r, search.re, settings, r.id === view.freshId)))
    .join('');

  const status = $('search-status');
  const box = $('search-box');
  box.classList.toggle('is-invalid', Boolean(search.error));
  $('search').setAttribute('aria-invalid', String(Boolean(search.error)));
  status.classList.toggle('is-error', Boolean(search.error));
  $('search-flags').textContent = view.matchCase ? '/' : '/i';

  const order = SORT_WORDS[key][dir];
  if (search.error) status.textContent = `That pattern does not compile (${search.error}). Showing everything until it does.`;
  else if (!records.length) status.textContent = '';
  else if (search.re && !visible.length) status.textContent = 'No entries match. Try a looser pattern.';
  else if (search.re) status.textContent = `${visible.length} of ${records.length} entries match, ${order}.`;
  else status.textContent = `${records.length} ${records.length === 1 ? 'entry' : 'entries'}, ${order}.`;

  $('ledger-caption').textContent = `Entries sorted by ${key}, ${order}`;
  document.querySelectorAll('[data-sort]').forEach(button => {
    const active = button.dataset.sort === key;
    button.setAttribute('aria-pressed', String(active));
    button.textContent = `${button.dataset.sort === 'description' ? 'Description' : button.dataset.sort[0].toUpperCase() + button.dataset.sort.slice(1)}${active ? (dir === 'asc' ? ' ↑' : ' ↓') : ''}`;
  });
  document.querySelectorAll('th[data-col]').forEach(th => {
    if (th.dataset.col === key) th.setAttribute('aria-sort', dir === 'asc' ? 'ascending' : 'descending');
    else th.removeAttribute('aria-sort');
  });
}

/* Forms */

export function setFieldState(field, { error = '', warning = '' } = {}, touched = true) {
  const control = field.querySelector('input, select');
  const msg = field.querySelector('.msg');
  const showError = touched && Boolean(error);
  field.classList.toggle('is-invalid', showError);
  field.classList.toggle('is-valid', touched && !error && control.value !== '');
  control.setAttribute('aria-invalid', String(showError));
  msg.textContent = showError ? error : warning || msg.dataset.hint || '';
  msg.classList.toggle('is-warn', !showError && Boolean(warning));
}

export function resetField(field) {
  field.classList.remove('is-invalid', 'is-valid');
  field.querySelector('input, select').removeAttribute('aria-invalid');
  const msg = field.querySelector('.msg');
  msg.textContent = msg.dataset.hint || '';
  msg.classList.remove('is-warn');
}

export function fillCategorySelect(select, categories) {
  const current = select.value;
  select.innerHTML = categoryOptions(categories, categories.includes(current) ? current : categories[0]);
}

export function renderSlip(values, settings, nextSerial) {
  const { currency, rates } = settings;
  const amount = /^(0|[1-9]\d*)(\.\d{1,2})?$/.test(values.amount) ? Number(values.amount) : 0;
  $('slip-serial').textContent = nextSerial;
  $('slip-desc').textContent = values.description || 'Your entry';
  $('slip-amount').textContent = formatAmount(convert(amount, currency, rates));
  $('slip-meta').textContent = currency === 'RWF' ? nameOf(currency) : `${nameOf(currency)} · ${formatAmount(amount)} RWF`;
  const date = /^\d{4}-\d{2}-\d{2}$/.test(values.date) ? prettyDate(values.date) : 'No date yet';
  $('slip-extra').textContent = `${values.category || 'No category'} · ${date}`;
}

export function stampSlip() {
  const slip = $('slip');
  slip.classList.remove('is-issued');
  void slip.offsetWidth;
  slip.classList.add('is-issued');
}

/* Settings */

export function renderRates(settings) {
  $('rates-fields').innerHTML = CURRENCIES.filter(c => c.code !== 'RWF').map(c => `
    <div class="field" data-field="rate">
      <label for="rate-${c.code}">${c.code}</label>
      <input id="rate-${c.code}" name="${c.code}" inputmode="decimal" autocomplete="off" value="${settings.rates[c.code]}" aria-describedby="rate-${c.code}-msg">
      <p class="msg" id="rate-${c.code}-msg" data-hint="${c.name}">${c.name}</p>
    </div>`).join('');
}

export function renderCategoryChips(categories, counts) {
  $('category-list').innerHTML = categories.map(name => `<li class="chip">
      <span>${escapeHtml(name)}${counts.get(name) ? ` · ${counts.get(name)}` : ''}</span>
      <button type="button" data-remove-category="${escapeHtml(name)}" aria-label="Remove ${escapeHtml(name)}">×</button>
    </li>`).join('');
}

export function renderReport(lines, isError) {
  const report = $('data-report');
  report.classList.toggle('is-error', isError);
  if (!lines.length) {
    report.textContent = '';
    return;
  }
  const [headline, ...rest] = lines;
  const shownLines = rest.slice(0, 6).map(line => `<li>${escapeHtml(line)}</li>`).join('');
  const more = rest.length > 6 ? `<li>And ${rest.length - 6} more.</li>` : '';
  report.innerHTML = `<p>${escapeHtml(headline)}</p>${rest.length ? `<ul>${shownLines}${more}</ul>` : ''}`;
}

export function syncThemeControls(preference, effectiveTheme) {
  const toggle = $('theme-toggle');
  toggle.setAttribute('aria-label', effectiveTheme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
  const radio = document.getElementById(`theme-${preference}`);
  if (radio) radio.checked = true;
}
