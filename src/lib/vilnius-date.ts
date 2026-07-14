const TIME_ZONE = 'Europe/Vilnius';

export function getVilniusDateKey(value: string | Date = new Date()): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE }).format(date);
}

/** UTC intervalas [start, end) atitinkantis kalendorinę parą Europe/Vilnius. */
export function getVilniusDayUtcBounds(dateKey: string): { start: string; end: string } {
  const [year, month, day] = dateKey.split('-').map(Number);
  const utcMidnight = Date.UTC(year, month - 1, day, 0, 0, 0, 0);

  for (let offsetHours = -14; offsetHours <= 14; offsetHours += 1) {
    const candidate = new Date(utcMidnight + offsetHours * 3_600_000);
    if (getVilniusDateKey(candidate) !== dateKey) continue;

    const hour = Number(
      new Intl.DateTimeFormat('en-GB', {
        timeZone: TIME_ZONE,
        hour: 'numeric',
        hour12: false,
      }).format(candidate)
    );
    if (hour !== 0) continue;

    const start = candidate;
    const end = new Date(start.getTime() + 24 * 3_600_000);
    return { start: start.toISOString(), end: end.toISOString() };
  }

  const start = new Date(`${dateKey}T00:00:00.000+03:00`);
  const end = new Date(start.getTime() + 24 * 3_600_000);
  return { start: start.toISOString(), end: end.toISOString() };
}

export function formatVilniusDateLabel(dateKey: string): string {
  const [year, month, day] = dateKey.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  return date.toLocaleDateString('lt-LT', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: TIME_ZONE,
  });
}
