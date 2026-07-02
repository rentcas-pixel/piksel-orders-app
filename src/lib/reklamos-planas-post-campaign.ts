import { addDays } from 'date-fns';
import { parseDateOnlyLocal } from '@/lib/date-utils';

export const POST_CAMPAIGN_EXPORT_LABEL = 'Ataskaita';

/** Papildomų parodymų % diapazonas pagal kalendorinį mėnesį (0 = sausis). */
const MONTHLY_BOOST_RANGES: { min: number; max: number }[] = [
  { min: 0.24, max: 0.32 }, // sausis
  { min: 0.21, max: 0.29 }, // vasaris
  { min: 0.12, max: 0.18 }, // kovas
  { min: 0.08, max: 0.15 }, // balandis
  { min: 0.02, max: 0.08 }, // gegužė
  { min: 0.02, max: 0.08 }, // birželis
  { min: 0.2, max: 0.27 }, // liepa
  { min: 0.1, max: 0.2 }, // rugpjūtis (tikslinama pagal dieną)
  { min: 0.02, max: 0.06 }, // rugsėjis
  { min: 0.01, max: 0.05 }, // spalis
  { min: 0, max: 0.04 }, // lapkritis
  { min: 0, max: 0.05 }, // gruodis (tikslinama pagal dieną)
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
      min: lerp(0.18, 0.08, t),
      max: lerp(0.2, 0.1, t),
    };
  }

  if (monthIndex === 11) {
    if (dayOfMonth <= 20) {
      return { min: 0, max: 0.03 };
    }
    return { min: 0, max: 0.05 };
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
