/** Barteris užpildo laisvą valandą. Mokamos kampanijos čia nejudinamos. */

export const BARTER_CLIP_CAP = 6;

/** 6–23 imtinai. Mokamas grafikas lieka 6–22. */
export const BARTER_HOURS = Array.from({ length: 18 }, (_, index) => 6 + index);

export type BarterScreenRef = {
  id: string;
  name: string;
  city?: string;
};

export type BarterPlacementOrder = {
  id: string;
  from?: string;
  to?: string;
  screenNames: string[];
};

export function isPikselOwnedRegularScreen(screen: {
  owner?: string | null;
  viaduct?: boolean | null;
}): boolean {
  const owner = String(screen.owner || '')
    .trim()
    .toLocaleLowerCase('lt-LT');
  return owner === 'piksel' && screen.viaduct !== true;
}

/** 5 ir mažiau — dedam, 6 ir daugiau — praleidžiam. */
export function barterHourDecision(clipsAlreadyPlaced: number): 'place' | 'skip' {
  return clipsAlreadyPlaced < BARTER_CLIP_CAP ? 'place' : 'skip';
}

/**
 * Mokami klipai pirmi. Kiekvienas ankstesnis barteris užima vieną vietą
 * tik kol valandoje dar mažiau nei 6.
 */
export function clipsBeforeBarter(paidClips: number, earlierBarterCount: number): number {
  let used = Number.isFinite(paidClips) && paidClips > 0 ? paidClips : 0;
  const earlier =
    Number.isFinite(earlierBarterCount) && earlierBarterCount > 0 ? earlierBarterCount : 0;
  for (let index = 0; index < earlier; index += 1) {
    if (used < BARTER_CLIP_CAP) used += 1;
  }
  return used;
}

export function barterFitsHour(input: {
  paidClips: number;
  earlierBartersOnHour: number;
}): boolean {
  return (
    barterHourDecision(clipsBeforeBarter(input.paidClips, input.earlierBartersOnHour)) === 'place'
  );
}

export function barterScreenNames(screens: BarterScreenRef[] | undefined): string[] {
  return (screens || []).map((screen) => String(screen.name || '').trim()).filter(Boolean);
}

function screenKey(value: string): string {
  return value.trim().toLocaleLowerCase('lt-LT');
}

export function barterOrdersOnScreen(
  orders: BarterPlacementOrder[],
  screenName: string
): BarterPlacementOrder[] {
  const screen = screenKey(screenName);
  if (!screen) return [];
  return orders
    .filter((order) => order.screenNames.some((name) => screenKey(name) === screen))
    .slice()
    .sort((a, b) => a.id.localeCompare(b.id));
}

export function barterCoversDate(
  order: { from?: string; to?: string },
  dateIso: string
): boolean {
  if (order.from && dateIso < order.from) return false;
  if (order.to && dateIso > order.to) return false;
  return Boolean(dateIso);
}

/** Kiek ankstesnių barterių tą dieną jau pretenduoja į šį ekraną. */
export function earlierBartersOnHour(
  orderedOnScreen: BarterPlacementOrder[],
  orderId: string,
  dateIso: string
): number {
  let count = 0;
  for (const order of orderedOnScreen) {
    if (order.id === orderId) break;
    if (barterCoversDate(order, dateIso)) count += 1;
  }
  return count;
}

export function barterDayFits(
  hourFits: (hour: number) => boolean
): boolean {
  return BARTER_HOURS.some((hour) => hourFits(hour));
}
