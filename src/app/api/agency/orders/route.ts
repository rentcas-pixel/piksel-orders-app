import { agencyUnauthorizedResponse, getAgencySession } from '@/lib/agency-auth';
import {
  buildAgencyCalendarFilter,
  fetchAgencyOrdersForPeriodTab,
  type AgencyListFilters,
  type AgencyPeriodTab,
} from '@/lib/agency-orders';
import { getOrdersServer } from '@/lib/pocketbase-server';

export const maxDuration = 60;

const AGENCY_ORDER_FIELDS =
  'id,client,agency,invoice_id,approved,from,to,final_price,media_received,invoice_sent,updated,viaduct,screens,details';

function readFilters(searchParams: URLSearchParams): AgencyListFilters {
  return {
    status: searchParams.get('status') ?? 'taip',
    month: searchParams.get('month') ?? '',
    year: searchParams.get('year') ?? String(new Date().getFullYear()),
    client: searchParams.get('client') ?? '',
    showStaleUnapproved: searchParams.get('showStaleUnapproved') === '1',
  };
}

export async function GET(request: Request) {
  const session = await getAgencySession();
  if (!session) return agencyUnauthorizedResponse();

  const { searchParams } = new URL(request.url);
  const mode = searchParams.get('mode') ?? 'list';
  const searchQuery = searchParams.get('searchQuery') ?? '';
  const filters = readFilters(searchParams);
  const periodTab = (searchParams.get('periodTab') ?? 'current') as AgencyPeriodTab;
  const page = parseInt(searchParams.get('page') ?? '1', 10);
  const perPage = parseInt(searchParams.get('perPage') ?? '20', 10);
  const sort = searchParams.get('sort') ?? '-updated';
  const matchValues = session.agency.pocketbase_values;

  if (mode === 'calendar') {
    const filter = buildAgencyCalendarFilter({
      agencyMatchValues: matchValues,
      searchQuery,
      filters: { status: filters.status, client: filters.client },
      year: parseInt(searchParams.get('calendarYear') ?? String(new Date().getFullYear()), 10),
      month: parseInt(searchParams.get('calendarMonth') ?? String(new Date().getMonth() + 1), 10),
    });
    const result = await getOrdersServer({
      page: Number.isFinite(page) ? page : 1,
      perPage: Number.isFinite(perPage) ? perPage : 20,
      sort,
      filter,
      fields: AGENCY_ORDER_FIELDS,
      timeoutMs: 20000,
    });
    return Response.json(result);
  }

  const result = await fetchAgencyOrdersForPeriodTab({
    filterParams: {
      agencyMatchValues: matchValues,
      searchQuery,
      filters,
      periodTab,
    },
    page: Number.isFinite(page) ? page : 1,
    perPage: Number.isFinite(perPage) ? perPage : 20,
    sort,
    fields: AGENCY_ORDER_FIELDS,
    timeoutMs: 20000,
    getOrders: (opts) =>
      getOrdersServer(opts).then((page) => ({
        items: page.items ?? [],
        totalItems: page.totalItems ?? 0,
        totalPages: page.totalPages ?? 1,
      })),
  });

  return Response.json(result);
}
