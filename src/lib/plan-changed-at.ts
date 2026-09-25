/**
 * Plano pakeitimo laikas — tik datos, intensyvumas ar ekranai.
 * Ne klipo įkėlimas ir ne mediaCoverage.updatedAt / order.updated.
 */

type PlanRow = {
  name?: string;
  catalogId?: string;
  from?: string;
  to?: string;
};

export type PlanChangeSnapshot = {
  id?: string;
  from?: string;
  to?: string;
  intensity?: string;
  screens?: string[];
  details?: {
    planChangedAt?: string | null;
    plan?: {
      intensity?: string;
      screenNames?: string[];
      screenRows?: PlanRow[];
    };
  };
};

function text(value: unknown): string {
  return String(value ?? '').trim();
}

function lower(value: unknown): string {
  return text(value).toLocaleLowerCase('lt-LT');
}

function sortedUnique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))].sort();
}

function intensityOf(order: PlanChangeSnapshot): string {
  return lower(order.intensity || order.details?.plan?.intensity);
}

function screenIdsOf(order: PlanChangeSnapshot): string[] {
  const direct = (order.screens || []).map((id) => text(id)).filter(Boolean);
  if (direct.length) return sortedUnique(direct);
  const rows = order.details?.plan?.screenRows || [];
  return sortedUnique(rows.map((row) => text(row.catalogId)));
}

function screenNamesOf(order: PlanChangeSnapshot): string[] {
  const rows = order.details?.plan?.screenRows || [];
  const fromRows = rows.map((row) => lower(row.name)).filter(Boolean);
  if (fromRows.length) return sortedUnique(fromRows);
  return sortedUnique((order.details?.plan?.screenNames || []).map((name) => lower(name)));
}

function rowStampOf(order: PlanChangeSnapshot): string {
  const rows = order.details?.plan?.screenRows || [];
  const from = text(order.from);
  const to = text(order.to);
  return rows
    .map((row) => {
      const name = lower(row.name);
      if (!name) return '';
      return [name, text(row.from) || from, text(row.to) || to].join('|');
    })
    .filter(Boolean)
    .sort()
    .join(';');
}

/** Datos, intensyvumas, ekranai. Tuščia pusė neskaičiuojama, išskyrus visų ekranų nuėmimą ar pridėjimą. */
export function broadcastPlanFieldsDiffer(
  before: PlanChangeSnapshot,
  after: PlanChangeSnapshot
): boolean {
  const beforeFrom = text(before.from);
  const afterFrom = text(after.from);
  const beforeTo = text(before.to);
  const afterTo = text(after.to);
  const dates =
    Boolean(beforeFrom && afterFrom && beforeFrom !== afterFrom) ||
    Boolean(beforeTo && afterTo && beforeTo !== afterTo);

  const beforeRows = rowStampOf(before);
  const afterRows = rowStampOf(after);
  const rowDates = Boolean(beforeRows && afterRows && beforeRows !== afterRows);

  const beforeIds = screenIdsOf(before);
  const afterIds = screenIdsOf(after);
  const beforeNames = screenNamesOf(before);
  const afterNames = screenNamesOf(after);
  let screens = false;
  if (beforeNames.length && afterNames.length) {
    screens = beforeNames.join(';') !== afterNames.join(';');
  } else if (beforeIds.length && afterIds.length) {
    screens = beforeIds.join(';') !== afterIds.join(';');
  } else if (
    (beforeIds.length > 0 || beforeNames.length > 0) !==
    (afterIds.length > 0 || afterNames.length > 0)
  ) {
    screens = true;
  }

  const beforeIntensity = intensityOf(before);
  const afterIntensity = intensityOf(after);
  const intensity =
    Boolean(beforeIntensity && afterIntensity) && beforeIntensity !== afterIntensity;

  return dates || rowDates || screens || intensity;
}

/**
 * Grąžina jau įrašytą planChangedAt, jei datos, intensyvumas ir ekranai nesikeitė.
 * Naują laiką — tik tikram pakeitimui. order.updated nenaudojamas.
 */
export function resolvePlanChangedAt(
  existing: PlanChangeSnapshot | null | undefined,
  next: PlanChangeSnapshot,
  nowIso: string
): string | undefined {
  const kept = text(existing?.details?.planChangedAt);
  if (!existing || !text(existing.id)) return kept || undefined;
  if (!broadcastPlanFieldsDiffer(existing, next)) return kept || undefined;
  const stamped = text(nowIso);
  return stamped || undefined;
}
