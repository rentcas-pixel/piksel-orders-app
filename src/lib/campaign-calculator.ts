import { differenceInCalendarDays, getISODay, parseISO, startOfDay } from 'date-fns';

/** PocketBase ekranas su kainų lentele (kaip skaičiuoklėje) */
export interface CampaignScreen {
  id: string;
  name: string;
  city?: string;
  city_display?: string;
  type?: string;
  parameters?: string;
  resolution?: string;
  link?: string;
  ots: number;
  viaduct?: boolean;
  partner?: string;
  priority?: number;
  price: Record<string, number>;
}

export interface CampaignBundle {
  id: string;
  name: string;
  discount: number;
  screens: string[];
}

/** Užsakymo laukai reikalingi skaičiuoklės eksportui */
export interface CampaignOrderInput {
  id: string;
  client: string;
  agency: string;
  invoice_id: string | number;
  viaduct: boolean;
  from: string;
  to: string;
  screens: string[];
  grid: number[];
  clip_duration: number;
  viaduct_frequency: number;
  discount: number;
  on_sale_screens?: string[];
  on_sale_discount?: number;
  hidden_screens?: string[];
  /** Iš PocketBase orders.details — skaičiuoklės išsaugotos reikšmės */
  details_amount_discount?: number;
  details_period_discount?: number;
  details_screen_prices?: Record<string, number>;
}

const GRID_ROW_COUNT = 17;
const GRID_COL_COUNT = 7;
const VIEWS_PER_HOUR_STANDARD = 30;
const VIEWS_PER_HOUR_VIADUCT = 60;

const LIMITS = {
  standard: { maxPeriodDiscount: 18, maxAmountDiscount: 20 },
  viaduct: { monthly: 10, yearly: 25, monthThreshold: 28, yearThreshold: 365 },
};

function applyDiscount(amount: number, discountPercent: number) {
  return amount * ((100 - discountPercent) / 100);
}

function parseOrderRange(from: string, to: string): { from: Date; to: Date } | null {
  try {
    const fromDate = startOfDay(parseISO(from.split(' ')[0]));
    const toDate = startOfDay(parseISO(to.split(' ')[0]));
    if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) return null;
    return { from: fromDate, to: toDate };
  } catch {
    return null;
  }
}

export function createCampaignCalculator(
  order: CampaignOrderInput,
  allScreens: CampaignScreen[],
  bundles: CampaignBundle[],
  partnerId: string | null
) {
  const range = parseOrderRange(order.from, order.to);
  const days =
    range ? differenceInCalendarDays(range.to, range.from) + 1 : 0;

  const selectedScreenIds = new Set(order.screens.filter(Boolean));
  const hiddenScreenIds = new Set(order.hidden_screens || []);
  const onSaleScreenIds = new Set(order.on_sale_screens || []);
  const onSaleDiscount = order.on_sale_discount ?? 0;

  const screens = allScreens.filter((s) => !hiddenScreenIds.has(s.id));
  const partnerScreens = partnerId
    ? screens.filter((s) => s.partner === partnerId)
    : screens;

  const orderedPartnerScreens = partnerScreens.filter((s) =>
    selectedScreenIds.has(s.id)
  );

  const orderedAllScreens = order.screens
    .map((id) => screens.find((s) => s.id === id))
    .filter((s): s is CampaignScreen => !!s);

  /** Visas katalogas kaip skaičiuoklėje — 48 standartiniai / viadukai atskirai */
  const orderedCatalogScreens = [...screens]
    .filter((s) => (order.viaduct ? !!s.viaduct : !s.viaduct))
    .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));

  const hasViaductScreens = partnerScreens.some(
    (s) => selectedScreenIds.has(s.id) && s.viaduct
  );

  const getViewsPerHour = () =>
    hasViaductScreens ? VIEWS_PER_HOUR_VIADUCT / order.viaduct_frequency : VIEWS_PER_HOUR_STANDARD;

  const getGridViewsPerDay = (): number[] => {
    const viewsPerHour = getViewsPerHour();
    const perDay = new Array(GRID_COL_COUNT).fill(0);
    for (let index = 0; index < order.grid.length; index++) {
      const col = Math.floor(index / GRID_ROW_COUNT);
      if (order.grid[index] === 1) perDay[col] += viewsPerHour;
    }
    return perDay;
  };

  const getAverageViews = (screen: CampaignScreen): number => {
    if (screen.viaduct) {
      return GRID_ROW_COUNT * (VIEWS_PER_HOUR_VIADUCT / order.viaduct_frequency);
    }
    if (!range) return 0;
    const perDay = getGridViewsPerDay();
    let sum = 0;
    let dayCount = 0;
    let cursor = range.from;
    while (cursor <= range.to) {
      const weekdayIndex = getISODay(cursor) - 1;
      sum += perDay[weekdayIndex] || 0;
      dayCount++;
      cursor = startOfDay(new Date(cursor.getTime() + 86400000));
    }
    return dayCount <= 0 ? 0 : sum / dayCount;
  };

  const screenPrice = (screen: CampaignScreen): number => {
    const avg = getAverageViews(screen);
    let price = 0;
    for (const [threshold, value] of Object.entries(screen.price || {})) {
      const minViews = parseInt(threshold, 10);
      if (avg >= minViews || price === 0) price = value;
    }
    return price;
  };

  const durationIncrement = order.clip_duration * 0.1;

  const campaignDiscount = order.discount;

  const getScreenDiscount = (screen: CampaignScreen): number => {
    if (onSaleScreenIds.has(screen.id)) return onSaleDiscount;
    // Partnerio plane — tik kampanijos nuolaida iš PB (details.discount), be bundles
    if (partnerId) return campaignDiscount;
    const bundle = bundles.find((b) => b.screens.includes(screen.id));
    return bundle ? bundle.discount : campaignDiscount;
  };

  const savedScreenPrice = (screen: CampaignScreen): number | null => {
    const saved = order.details_screen_prices?.[screen.id];
    return saved != null && !Number.isNaN(saved) ? saved : null;
  };

  const isScreenDisabled = (screen: CampaignScreen) => !selectedScreenIds.has(screen.id);
  const isPartnerScreen = (screen: CampaignScreen) =>
    !partnerId || screen.partner === partnerId;

  const isInactive = (screen: CampaignScreen) =>
    isScreenDisabled(screen) || !isPartnerScreen(screen);

  const views = (screen: CampaignScreen) => getAverageViews(screen) * days;
  const ots = (screen: CampaignScreen) => views(screen) * screen.ots;
  const totalPrice = (screen: CampaignScreen) =>
    screenPrice(screen) * durationIncrement * views(screen);
  const discountPrice = (screen: CampaignScreen) => {
    const saved = savedScreenPrice(screen);
    if (saved != null) return saved;
    return applyDiscount(totalPrice(screen), getScreenDiscount(screen));
  };
  const clipPrice = (screen: CampaignScreen) =>
    views(screen) === 0 ? 0 : discountPrice(screen) / views(screen);
  const cpt = (screen: CampaignScreen) =>
    ots(screen) === 0 ? 0 : (discountPrice(screen) / ots(screen)) * 1000;

  const getWeeks = (): number => {
    if (!range) return 0;
    const ms = range.to.getTime() - range.from.getTime();
    return Math.max(0, Math.floor(ms / (7 * 86400000)));
  };

  const getViaductDiscount = (): number => {
    if (!range) return 0;
    if (days >= LIMITS.viaduct.yearThreshold) return LIMITS.viaduct.yearly;
    if (days >= LIMITS.viaduct.monthThreshold) return LIMITS.viaduct.monthly;
    return 0;
  };

  const orderScreenCount = order.screens.filter(Boolean).length;
  const screenAmountDiscount = Math.min(
    orderScreenCount,
    LIMITS.standard.maxAmountDiscount
  );
  const computedPeriodDiscount = Math.min(
    getWeeks() + 1,
    LIMITS.standard.maxPeriodDiscount
  );

  const totals = () => {
    const result = {
      views: 0,
      ots: 0,
      clip: 0,
      cpt: 0,
      price: 0,
      finalPrice: 0,
      total: 0,
      amountDiscount: hasViaductScreens
        ? 0
        : order.details_amount_discount ?? screenAmountDiscount,
      periodDiscount: hasViaductScreens
        ? getViaductDiscount()
        : order.details_period_discount ?? computedPeriodDiscount,
      discount: 0,
      screenPrices: {} as Record<string, number>,
    };

    let discountSum = 0;
    let activeCount = 0;

    for (const screen of partnerScreens) {
      if (isScreenDisabled(screen)) continue;
      activeCount++;
      const v = views(screen);
      const o = ots(screen);
      const tp = totalPrice(screen);
      const dp = discountPrice(screen);
      result.views += v;
      result.ots += o;
      result.clip += clipPrice(screen);
      result.cpt += cpt(screen);
      result.price += tp;
      result.finalPrice += dp;
      discountSum += getScreenDiscount(screen);
      result.screenPrices[screen.id] = dp;
    }

    if (activeCount > 0) {
      result.discount = discountSum / activeCount;
      result.clip = result.clip / activeCount;
      result.cpt = result.cpt / activeCount;
    }
    result.total = applyDiscount(
      result.finalPrice,
      result.amountDiscount + result.periodDiscount
    );
    return result;
  };

  const formatDate = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  return {
    range,
    days,
    screens,
    partnerScreens,
    orderedPartnerScreens,
    orderedAllScreens,
    orderedCatalogScreens,
    hasViaductScreens,
    hiddenCount: hiddenScreenIds.size,
    getViewsPerHour,
    isScreenDisabled,
    isPartnerScreen,
    isInactive,
    views,
    ots,
    clipPrice,
    cpt,
    totalPrice,
    discountPrice,
    getScreenDiscount,
    totals,
    formatFrom: range ? formatDate(range.from) : '',
    formatTo: range ? formatDate(range.to) : '',
    invoicePrefix: order.viaduct ? 'V' : 'U',
  };
}

export type CampaignCalculator = ReturnType<typeof createCampaignCalculator>;
