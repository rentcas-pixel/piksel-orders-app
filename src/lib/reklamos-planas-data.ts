import { CampaignOrderInput, CampaignScreen } from '@/lib/campaign-calculator';
import { config } from '@/config';

export function buildCalculatorExportUrl(
  orderId: string,
  partnerSlug: string
): string {
  const base = config.pocketbase.url.replace(/\/$/, '');
  const slug = partnerSlug.trim().toLowerCase();
  return `${base}/campaign/${orderId}/export/${encodeURIComponent(slug)}`;
}

/** Kampanijos nuolaida % — prioritetas: PocketBase orders.details.discount */
export function resolveCampaignDiscount(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  raw: Record<string, any>
): number {
  const details = raw.details;
  if (details && typeof details.discount === 'number') return details.discount;
  if (typeof raw.discount === 'number' && raw.discount > 0) return raw.discount;
  return 80;
}

export function toCampaignOrderInput(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  raw: Record<string, any>
): CampaignOrderInput {
  const details = raw.details;
  return {
    id: raw.id,
    client: raw.client || '',
    agency: raw.agency || '',
    invoice_id: raw.invoice_id,
    viaduct: !!raw.viaduct,
    from: raw.from,
    to: raw.to,
    screens: raw.screens || [],
    grid: raw.grid || [],
    clip_duration: raw.clip_duration ?? 10,
    viaduct_frequency: Number(raw.viaduct_frequency) || 1,
    discount: resolveCampaignDiscount(raw),
    on_sale_screens: raw.on_sale_screens,
    on_sale_discount: raw.on_sale_discount,
    hidden_screens: raw.hidden_screens,
    details_amount_discount:
      typeof details?.amountDiscount === 'number' ? details.amountDiscount : undefined,
    details_period_discount:
      typeof details?.periodDiscount === 'number' ? details.periodDiscount : undefined,
    details_screen_prices:
      details?.screenPrices && typeof details.screenPrices === 'object'
        ? (details.screenPrices as Record<string, number>)
        : undefined,
    details_final_price:
      typeof details?.finalPrice === 'number' ? details.finalPrice : undefined,
    details_total: typeof details?.total === 'number' ? details.total : undefined,
  };
}

export function toCampaignScreen(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  raw: Record<string, any>
): CampaignScreen {
  return {
    id: raw.id,
    name: raw.name || 'Nežinomas',
    city: raw.city,
    city_display: raw.city_display,
    type: raw.type,
    parameters: raw.parameters,
    resolution: raw.resolution,
    link: raw.link,
    ots: Number(raw.ots) || 0,
    viaduct: raw.viaduct,
    partner: raw.partner,
    priority: typeof raw.priority === 'number' ? raw.priority : undefined,
    price: raw.price || {},
  };
}

type PlanScreenHint = {
  catalogId?: string | null;
  name?: string | null;
  city?: string | null;
};

function planScreenKey(name?: string | null, city?: string | null): string {
  return `${String(city || '').trim().toLocaleLowerCase('lt-LT')}|${String(name || '').trim().toLocaleLowerCase('lt-LT')}`;
}

/**
 * Plano ekranai, kurių dar nėra orders.screens (pvz. 4 nauji katalogo ekranai),
 * ataskaitoje turi gauti datas ir parodymus, ne tuščią eilutę.
 */
export function mergePlanScreenIds(
  selected: string[] | null | undefined,
  raw: {
    details?: {
      plan?: {
        screenNames?: string[] | null;
        screenRows?: PlanScreenHint[] | null;
      } | null;
    } | null;
  },
  catalog: CampaignScreen[]
): string[] {
  const ids = new Set(
    (selected || []).map((id) => String(id || '').trim()).filter(Boolean)
  );
  const byId = new Set(catalog.map((screen) => screen.id));
  const byNameCity = new Map<string, string>();
  const byName = new Map<string, string[]>();
  for (const screen of catalog) {
    const name = screen.name.trim().toLocaleLowerCase('lt-LT');
    if (!name) continue;
    const city = (screen.city_display || screen.city || '').trim().toLocaleLowerCase('lt-LT');
    byNameCity.set(planScreenKey(name, city), screen.id);
    const list = byName.get(name) || [];
    list.push(screen.id);
    byName.set(name, list);
  }

  const addName = (name?: string | null, city?: string | null) => {
    const cleaned = String(name || '').trim().toLocaleLowerCase('lt-LT');
    if (!cleaned) return;
    const cityKey = String(city || '').trim().toLocaleLowerCase('lt-LT');
    const exact = cityKey ? byNameCity.get(planScreenKey(cleaned, cityKey)) : undefined;
    if (exact) {
      ids.add(exact);
      return;
    }
    const matches = byName.get(cleaned) || [];
    if (matches.length === 1) ids.add(matches[0]);
  };

  const plan = raw.details?.plan;
  for (const row of plan?.screenRows || []) {
    const id = String(row?.catalogId || '').trim();
    if (id && byId.has(id)) ids.add(id);
    else addName(row?.name, row?.city);
  }
  for (const name of plan?.screenNames || []) addName(name);
  return [...ids];
}

function sanitizeFilenamePart(value: string, maxLength = 80): string {
  return value.replace(/[/\\?*[\]:]/g, '_').slice(0, maxLength);
}

function formatExportDate(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

const EXCEL_SHEET_NAME_MAX_LENGTH = 31;

/** Ataskaita lapo pavadinimas: Ataskaita_orderNo_data_klientas */
export function buildPostCampaignSheetName(order: CampaignOrderInput): string {
  const orderNo = String(order.invoice_id);
  const date = formatExportDate();
  const client = sanitizeFilenamePart(order.client).replace(/\s+/g, '_');
  const prefix = `Ataskaita_${orderNo}_${date}_`;
  const clientMax = Math.max(1, EXCEL_SHEET_NAME_MAX_LENGTH - prefix.length);
  return `${prefix}${client.slice(0, clientMax)}`;
}

export function buildReklamosPlanasFilename(
  order: CampaignOrderInput,
  invoicePrefix: string,
  extension: 'pdf' | 'xlsx',
  ownerName?: string
): string {
  const date = formatExportDate();
  const safeClient = sanitizeFilenamePart(order.client);
  const parts = [
    'Piksel',
    String(order.invoice_id),
    invoicePrefix,
    safeClient,
    date,
  ];
  const owner = ownerName?.trim();
  if (owner) {
    parts.push(sanitizeFilenamePart(owner));
  }
  return `${parts.join('-')}.${extension}`;
}
