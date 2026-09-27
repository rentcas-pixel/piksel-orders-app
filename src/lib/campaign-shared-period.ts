type SharedPeriodRow = {
  from?: string;
  to?: string;
  customPeriod?: boolean;
};

/** Rows that still follow the previous shared period pick up the new one. */
export function inheritSharedScreenPeriod<T extends SharedPeriodRow>(
  rows: T[],
  previousFrom: string,
  previousTo: string,
  nextFrom: string,
  nextTo: string
): T[] {
  const prevFrom = previousFrom.trim();
  const prevTo = previousTo.trim();
  const from = nextFrom.trim();
  const to = nextTo.trim();
  if (!from || !to || (from === prevFrom && to === prevTo)) return rows;
  return rows.map((row) => {
    const rowFrom = String(row.from || '').trim();
    const rowTo = String(row.to || '').trim();
    const followsShared =
      row.customPeriod !== true &&
      ((!rowFrom && !rowTo) || (rowFrom === prevFrom && rowTo === prevTo));
    if (!followsShared) return row;
    return { ...row, from, to };
  });
}
