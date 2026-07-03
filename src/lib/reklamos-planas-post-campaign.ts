import { addDays } from 'date-fns';
import { parseDateOnlyLocal } from '@/lib/date-utils';

export const POST_CAMPAIGN_EXPORT_LABEL = 'Ataskaita';

/** Papildomų parodymų % diapazonas pagal kalendorinį mėnesį (0 = sausis). */
const MONTHLY_BOOST_RANGES: { min: number; max: number }[] = [
  { min: 0.48, max: 0.64 }, // sausis
  { min: 0.42, max: 0.58 }, // vasaris
  { min: 0.24, max: 0.36 }, // kovas
  { min: 0.16, max: 0.3 }, // balandis
  { min: 0.16, max: 0.3 }, // gegužė
  { min: 0.16, max: 0.3 }, // birželis
  { min: 0.4, max: 0.54 }, // liepa
  { min: 0.2, max: 0.4 }, // rugpjūtis (tikslinama pagal dieną)
  { min: 0.16, max: 0.3 }, // rugsėjis
  { min: 0.16, max: 0.3 }, // spalis
  { min: 0.16, max: 0.3 }, // lapkritis
  { min: 0.16, max: 0.3 }, // gruodis
];

function hashSeed(value: string): number {
  let hash = 5381;
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 33) ^ value.charCodeAt(i);
  }
  return hash >>> 0;
}

function lerp(from: number, to: number, t: number): number {
  return from + (to - from) * t;
}

export function getMonthBoostRange(
  monthIndex: number,
  dayOfMonth: number
): { min: number; max: number } {
  if (monthIndex === 7) {
    const t = (dayOfMonth - 1) / 30;
    return {
      min: lerp(0.36, 0.16, t),
      max: lerp(0.4, 0.2, t),
    };
  }

  return MONTHLY_BOOST_RANGES[monthIndex] ?? { min: 0, max: 0 };
}

function seededUnitFraction(orderId: string, screenId: string): number {
  const hash = hashSeed(`${orderId}:${screenId}`);
  return (hash % 10000) / 10000;
}

function averageCampaignBoostFraction(
  orderId: string,
  screenId: string,
  from: string,
  to: string
): number {
  const start = parseDateOnlyLocal(from);
  const end = parseDateOnlyLocal(to);
  if (!start || !end || start > end) return 0;

  const position = seededUnitFraction(orderId, screenId);
  let sum = 0;
  let days = 0;

  for (let cursor = start; cursor <= end; cursor = addDays(cursor, 1)) {
    const range = getMonthBoostRange(cursor.getMonth(), cursor.getDate());
    sum += range.min + position * (range.max - range.min);
    days += 1;
  }

  return days > 0 ? sum / days : 0;
}

export function postCampaignShownMultiplier(
  orderId: string,
  screenId: string,
  from: string,
  to: string
): number {
  return 1 + averageCampaignBoostFraction(orderId, screenId, from, to);
}

export function computePostCampaignShownViews(
  plannedViews: number,
  orderId: string,
  screenId: string,
  from: string,
  to: string
): number {
  if (plannedViews <= 0) return 0;
  return Math.round(
    plannedViews * postCampaignShownMultiplier(orderId, screenId, from, to)
  );
}

export function computePostCampaignDifference(
  plannedViews: number,
  shownViews: number
): number {
  return shownViews - plannedViews;
}

export function isCampaignEnded(order: { to?: string | null }): boolean {
  if (!order.to) return false;
  const end = parseDateOnlyLocal(order.to);
  if (!end) return false;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return end < today;
}
