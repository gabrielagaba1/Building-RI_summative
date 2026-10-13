import { isoDay } from './stats.js';

const CSV_FIELDS = ['id', 'description', 'amount', 'category', 'date', 'createdAt', 'updatedAt'];

export function csvCell(value) {
  let text = String(value ?? '');
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export const toCsv = records =>
  [CSV_FIELDS.join(','), ...records.map(r => CSV_FIELDS.map(field => csvCell(r[field])).join(','))].join('\r\n');

export const toJson = (records, settings) =>
  JSON.stringify({ app: 'Amafaranga', version: 1, exportedAt: new Date().toISOString(), settings, records }, null, 2);

export const fileName = extension => `amafaranga_${isoDay(new Date()).replace(/-/g, '_')}.${extension}`;

export function download(name, text, type) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function readJson(file) {
  const text = await file.text();
  return JSON.parse(text);
}

export async function fetchSeed() {
  const response = await fetch('seed.json', { cache: 'no-store' });
  if (!response.ok) throw new Error(`seed.json answered ${response.status}`);
  return response.json();
}
