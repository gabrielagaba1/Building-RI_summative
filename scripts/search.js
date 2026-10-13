const SLASHED = /^\/(.+)\/([a-z]*)$/;
const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export const escapeHtml = value => String(value).replace(/[&<>"']/g, char => ESCAPES[char]);

export function compileRegex(input, matchCase = false) {
  if (!input) return { re: null, error: '' };
  const slashed = input.match(SLASHED);
  const source = slashed ? slashed[1] : input;
  const flags = new Set((slashed ? slashed[2] : '').replace(/[^imsu]/g, ''));
  if (!matchCase) flags.add('i');
  flags.add('g');
  try {
    return { re: new RegExp(source, [...flags].join('')), error: '' };
  } catch (error) {
    return { re: null, error: error.message.split(': ').pop() };
  }
}

export const amountText = amount => (Number.isInteger(amount) ? String(amount) : amount.toFixed(2));

export function hits(re, text) {
  re.lastIndex = 0;
  const found = re.test(text);
  re.lastIndex = 0;
  return found;
}

export function filterRecords(records, re) {
  if (!re) return records;
  return records.filter(r => [r.description, r.category, amountText(r.amount), r.date].some(text => hits(re, text)));
}

export function highlight(text, re) {
  if (!re) return escapeHtml(text);
  let html = '';
  let last = 0;
  for (const match of text.matchAll(re)) {
    if (!match[0]) continue;
    html += `${escapeHtml(text.slice(last, match.index))}<mark>${escapeHtml(match[0])}</mark>`;
    last = match.index + match[0].length;
  }
  return html + escapeHtml(text.slice(last));
}
