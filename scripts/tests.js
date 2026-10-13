import { PATTERNS, checkAmount, checkCategory, checkDate, checkDescription, checkRate, repeatedWord, validateDataset } from './validators.js';
import { compileRegex, filterRecords, highlight } from './search.js';
import { convert, formatAmount } from './currency.js';
import { capStatus, lastSevenDays } from './stats.js';
import { sortRecords } from './state.js';
import { csvCell } from './io.js';

const sample = [
  { id: 'rec_0001', description: 'Lunch at ALU cafeteria', amount: 3500, category: 'Food', date: '2026-10-08', createdAt: '2026-10-08T10:30:00.000Z', updatedAt: '2026-10-08T10:30:00.000Z' },
  { id: 'rec_0002', description: 'Ginger tea and mandazi', amount: 1200, category: 'Food', date: '2026-10-10', createdAt: '2026-10-10T06:55:00.000Z', updatedAt: '2026-10-10T06:55:00.000Z' },
  { id: 'rec_0003', description: 'Printing CV', amount: 1250.5, category: 'Books', date: '2026-10-12', createdAt: '2026-10-12T08:05:00.000Z', updatedAt: '2026-10-12T08:05:00.000Z' }
];

const groups = [];
let current;

const group = name => { current = { name, results: [] }; groups.push(current); };
const check = (label, condition) => current.results.push({ label, pass: Boolean(condition) });
const valid = message => message === '';

group('Description rule  /^\\S(?:.*\\S)?$/');
check('accepts "Lunch at cafeteria"', valid(checkDescription('Lunch at cafeteria')));
check('rejects a leading space', !valid(checkDescription(' Lunch')));
check('rejects a trailing space', !valid(checkDescription('Lunch ')));
check('rejects double spaces inside', !valid(checkDescription('Lunch  at cafeteria')));
check('accepts a single character', valid(checkDescription('x')));

group('Amount rule  /^(0|[1-9]\\d*)(\\.\\d{1,2})?$/');
check('accepts 0', valid(checkAmount('0')));
check('accepts 12.50', valid(checkAmount('12.50')));
check('accepts 450000', valid(checkAmount('450000')));
check('rejects a leading zero, 012', !valid(checkAmount('012')));
check('rejects three decimals, 1.234', !valid(checkAmount('1.234')));
check('rejects negatives, -5', !valid(checkAmount('-5')));
check('rejects text, abc', !valid(checkAmount('abc')));

group('Date rule  YYYY-MM-DD plus a real calendar check');
check('accepts 2026-10-13', valid(checkDate('2026-10-13')));
check('accepts the leap day 2024-02-29', valid(checkDate('2024-02-29')));
check('rejects 2025-02-29, not a leap year', !valid(checkDate('2025-02-29')));
check('rejects month 13', !valid(checkDate('2026-13-01')));
check('rejects 13/10/2026', !valid(checkDate('13/10/2026')));

group('Category rule  /^[A-Za-z]+(?:[ -][A-Za-z]+)*$/');
check('accepts Food', valid(checkCategory('Food')));
check('accepts Late night snacks', valid(checkCategory('Late night snacks')));
check('rejects Food!', !valid(checkCategory('Food!')));
check('rejects a duplicate, food vs Food', !valid(checkCategory('food', ['Food'])));

group('Advanced: back reference  /\\b(\\w+)\\s+\\1\\b/i');
check('finds "for for"', repeatedWord('Airtime for for the week') === 'for for');
check('finds "The the" regardless of case', repeatedWord('The the bus') === 'The the');
check('ignores "the then"', repeatedWord('the then') === '');

group('Advanced: lookahead  /^(?=.*[1-9])\\d{1,7}(?:\\.\\d{1,4})?$/');
check('accepts 89', valid(checkRate('89')));
check('accepts 0.05', valid(checkRate('0.05')));
check('rejects 0', !valid(checkRate('0')));
check('rejects 0.000', !valid(checkRate('0.000')));
check('rejects five decimals', !valid(checkRate('1.23456')));
check('the lookahead is really there', PATTERNS.rate.source.includes('(?='));

group('Safe regex search');
check('a broken pattern returns an error, not a crash', compileRegex('(coffee').error !== '');
check('an empty pattern means no filter', compileRegex('').re === null);
check('slash syntax /tea/ works', compileRegex('/tea/').re instanceof RegExp);
check('coffee|tea finds the tea entry', filterRecords(sample, compileRegex('coffee|tea').re).length === 1);
check('cents pattern finds 1250.50', filterRecords(sample, compileRegex('\\.\\d{2}\\b').re).length === 1);
check('match case makes "lunch" miss', filterRecords(sample, compileRegex('lunch', true).re).length === 0);
check('highlight escapes HTML around marks', highlight('<b>tea</b>', compileRegex('tea').re) === '&lt;b&gt;<mark>tea</mark>&lt;/b&gt;');

group('Import validation');
check('accepts a clean list', validateDataset(sample).ok);
check('accepts an export object with records', validateDataset({ records: sample }).ok);
check('rejects a plain object', !validateDataset({ hello: 'world' }).ok);
check('rejects duplicate ids', !validateDataset([sample[0], sample[0]]).ok);
check('rejects a string amount', !validateDataset([{ ...sample[0], amount: '3500' }]).ok);
check('rejects an impossible date', !validateDataset([{ ...sample[0], date: '2026-02-30' }]).ok);

group('Numbers, sorting, CSV');
check('1,000 RWF at 89 per thousand is 89 KES', convert(1000, 'KES', { KES: 89 }) === 89);
check('format keeps cents only when needed', formatAmount(3500) === '3,500' && formatAmount(12.5) === '12.50');
check('spending past the cap reads as over', capStatus(110, 100).state === 'over');
check('cap at 90 percent reads as close', capStatus(90, 100).state === 'close');
check('seven day window has seven days', lastSevenDays(sample, new Date(2026, 9, 13)).length === 7);
check('sort by amount, smallest first', sortRecords(sample, { key: 'amount', dir: 'asc' })[0].id === 'rec_0002');
check('sort by description, A to Z', sortRecords(sample, { key: 'description', dir: 'asc' })[0].id === 'rec_0002');
check('CSV quotes commas and doubles quotes', csvCell('Printing "final" CV, 12 pages') === '"Printing ""final"" CV, 12 pages"');
check('CSV defuses spreadsheet formulas', csvCell('=SUM(A1)') === "'=SUM(A1)");

export const results = groups;

if (typeof document !== 'undefined') {
  const total = groups.flatMap(g => g.results);
  const passed = total.filter(r => r.pass).length;
  const summary = document.getElementById('summary');
  summary.textContent = `${passed} of ${total.length} checks passed`;
  summary.classList.toggle('is-bad', passed !== total.length);
  document.getElementById('results').innerHTML = groups.map(g => `
    <section class="panel">
      <h2>${g.name.replace(/</g, '&lt;')}</h2>
      <ul class="checks">${g.results.map(r => `<li class="${r.pass ? 'pass' : 'fail'}"><span>${r.pass ? 'Pass' : 'Fail'}</span> ${r.label.replace(/</g, '&lt;')}</li>`).join('')}</ul>
    </section>`).join('');
}
