const pad = n => String(n).padStart(2, '0');
const round2 = n => Math.round(n * 100) / 100;

export const isoDay = date => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

export function lastSevenDays(records, today = new Date()) {
  const days = [];
  for (let back = 6; back >= 0; back--) {
    const day = new Date(today.getFullYear(), today.getMonth(), today.getDate() - back);
    days.push({
      key: isoDay(day),
      short: day.toLocaleDateString('en-GB', { weekday: 'short' }),
      long: day.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }),
      amount: 0,
      isToday: back === 0
    });
  }
  const byKey = new Map(days.map(day => [day.key, day]));
  records.forEach(record => {
    const day = byKey.get(record.date);
    if (day) day.amount = round2(day.amount + record.amount);
  });
  return days;
}

export function summarize(records, today = new Date()) {
  const total = round2(records.reduce((sum, r) => sum + r.amount, 0));
  const byCategory = new Map();
  records.forEach(r => byCategory.set(r.category, (byCategory.get(r.category) || 0) + r.amount));
  const categories = [...byCategory]
    .map(([name, amount]) => ({ name, amount: round2(amount) }))
    .sort((a, b) => b.amount - a.amount || a.name.localeCompare(b.name));
  const month = isoDay(today).slice(0, 7);
  const thisMonth = round2(records.filter(r => r.date.startsWith(month)).reduce((sum, r) => sum + r.amount, 0));
  const latest = records.reduce((best, r) =>
    !best || r.date > best.date || (r.date === best.date && r.createdAt > best.createdAt) ? r : best, null);

  return {
    count: records.length,
    total,
    categories,
    top: categories[0]?.name ?? '',
    thisMonth,
    average: records.length ? round2(total / records.length) : 0,
    latest,
    week: lastSevenDays(records, today)
  };
}

export function capStatus(total, cap) {
  if (!cap) return { state: 'none', percent: 0, remaining: 0 };
  const percent = Math.round((total / cap) * 100);
  const remaining = round2(cap - total);
  const state = remaining < 0 ? 'over' : percent >= 85 ? 'close' : 'under';
  return { state, percent, remaining };
}
