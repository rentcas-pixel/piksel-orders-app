import {
  createCampaignCalculator,
  type CampaignOrderInput,
  type CampaignScreen,
} from '@/lib/campaign-calculator';
import { flattenCampaignGrid } from '@/lib/reklamos-planas-grid';
import { toCampaignOrderInput } from '@/lib/reklamos-planas-data';
import type { PikselCatalogScreen } from '@/lib/screen-catalog';
import type { Order } from '@/types';

type PlanRow = NonNullable<NonNullable<Order['details']>['plan']>['screenRows'] extends
  | Array<infer Row>
  | undefined
  ? Row
  : never;

export type QuotedPlanRow = PlanRow & {
  impressions: number;
  ots: number;
  clipPrice: number;
  cpt: number;
  gross: number;
  net: number;
  screenDiscount: number;
  days: number;
};

export type PlayCampaignQuote = {
  total: number;
  finalPrice: number;
  amountDiscount: number;
  periodDiscount: number;
  /** Pilna ekrano kaina po ekrano nuolaidos. Ne klipo vieneto kaina. */
  screenPrices: Record<string, number>;
  screens: CampaignScreen[];
  campaignOrder: CampaignOrderInput;
  rows: QuotedPlanRow[];
};

function planRowsOf(order: Pick<Order, 'details'>): PlanRow[] {
  const rows = order.details?.plan?.screenRows;
  return Array.isArray(rows) ? rows : [];
}

function catalogForRow(
  row: PlanRow,
  catalog: PikselCatalogScreen[]
): PikselCatalogScreen | undefined {
  const id = String(row.catalogId || '').trim();
  if (id) {
    const byId = catalog.find((screen) => screen.id === id);
    if (byId) return byId;
  }
  const name = String(row.name || '').trim().toLocaleLowerCase('lt-LT');
  if (!name) return undefined;
  return catalog.find((screen) => screen.name.toLocaleLowerCase('lt-LT') === name);
}

function rowsForQuote(order: Pick<Order, 'screens' | 'details'>, catalog: PikselCatalogScreen[]): PlanRow[] {
  const stored = planRowsOf(order);
  if (stored.length > 0) return stored;
  return (order.screens || []).map((id) => {
    const screen = catalog.find((item) => item.id === id);
    return {
      name: screen?.name || id,
      city: screen?.city,
      catalogId: id,
    };
  });
}

export function quotePlayCampaign(
  order: Pick<
    Order,
    | 'id'
    | 'client'
    | 'agency'
    | 'invoice_id'
    | 'viaduct'
    | 'from'
    | 'to'
    | 'screens'
    | 'grid'
    | 'clip_duration'
    | 'viaduct_frequency'
    | 'on_sale_screens'
    | 'on_sale_discount'
    | 'hidden_screens'
    | 'details'
  >,
  catalog: PikselCatalogScreen[]
): PlayCampaignQuote {
  const sourceRows = rowsForQuote(order, catalog);
  if (sourceRows.length === 0) {
    throw new Error('Plane nėra ekranų, todėl kainos perskaičiuoti negalima.');
  }

  const screens: CampaignScreen[] = sourceRows.map((row, index) => {
    const catalogScreen = catalogForRow(row, catalog);
    const label = String(row.name || row.catalogId || '').trim() || `ekranas ${index + 1}`;
    if (!catalogScreen) {
      throw new Error(`Ekranas nerastas kainyne: ${label}`);
    }
    return {
      id: catalogScreen.id,
      name: catalogScreen.name || label,
      city: catalogScreen.city || row.city,
      city_display: catalogScreen.city || row.city,
      type: catalogScreen.type || row.type,
      parameters: catalogScreen.dimensions || '',
      resolution: catalogScreen.resolution || row.resolution,
      link: catalogScreen.link,
      ots: Number(catalogScreen.ots) || 0,
      viaduct: !!catalogScreen.viaduct,
      priority: sourceRows.length - index,
      price: catalogScreen.price_by_avg_views_per_day || {},
    };
  });

  const screenIds = screens.map((screen) => screen.id);
  const grid = flattenCampaignGrid(order.details?.plan?.grid || order.grid || []);
  const periods: NonNullable<CampaignOrderInput['details_screen_periods']> = {};
  sourceRows.forEach((row, index) => {
    const custom = (row as { customPeriod?: boolean }).customPeriod === true;
    const from = String(row.from || '').trim();
    const to = String(row.to || '').trim();
    if (custom && from && to) periods[screenIds[index]] = { from, to };
  });

  const campaignOrder = toCampaignOrderInput({
    id: order.id,
    client: order.client,
    agency: order.agency,
    invoice_id: order.invoice_id,
    viaduct: !!order.viaduct,
    from: order.from,
    to: order.to,
    screens: screenIds,
    grid,
    clip_duration: order.details?.plan?.clip_duration ?? order.clip_duration ?? 10,
    viaduct_frequency:
      Number(order.viaduct_frequency) ||
      Number(order.details?.plan?.viaductFrequency) ||
      1,
    on_sale_screens: order.on_sale_screens,
    on_sale_discount: order.on_sale_discount,
    hidden_screens: order.hidden_screens,
    details: {
      discount: typeof order.details?.discount === 'number' ? order.details.discount : 80,
    },
  });
  campaignOrder.details_screen_periods = periods;

  const calc = createCampaignCalculator(campaignOrder, screens, [], null);
  const totals = calc.totals();
  const screenPrices: Record<string, number> = {};
  const rows: QuotedPlanRow[] = sourceRows.map((row, index) => {
    const screen = screens[index];
    const net = calc.discountPrice(screen);
    screenPrices[screen.id] = net;
    const period = calc.screenPeriod(screen);
    return {
      ...row,
      catalogId: screen.id,
      name: screen.name,
      city: screen.city || row.city,
      impressions: Math.round(calc.views(screen)),
      ots: Math.round(calc.ots(screen)),
      clipPrice: calc.clipPrice(screen),
      cpt: calc.cpt(screen),
      gross: calc.totalPrice(screen),
      net,
      screenDiscount: calc.getScreenDiscount(screen) / 100,
      days: period.days,
      from: period.formatFrom || row.from,
      to: period.formatTo || row.to,
    };
  });

  return {
    total: totals.total,
    finalPrice: totals.finalPrice,
    amountDiscount: totals.amountDiscount,
    periodDiscount: totals.periodDiscount,
    screenPrices,
    screens,
    campaignOrder: {
      ...campaignOrder,
      details_screen_prices: screenPrices,
    },
    rows,
  };
}
