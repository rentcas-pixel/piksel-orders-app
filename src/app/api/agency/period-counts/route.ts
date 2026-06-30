import { agencyUnauthorizedResponse, getAgencySession } from '@/lib/agency-auth';
import {
  buildAgencyOrdersFilter,
  type AgencyListFilters,
  type AgencyPeriodTab,
} from '@/lib/agency-orders';
import { getOrdersServer } from '@/lib/pocketbase-server';

const PERIOD_TABS: AgencyPeriodTab[] = ['all', 'current', 'future', 'past'];

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
  const searchQuery = searchParams.get('searchQuery') ?? '';
  const filters = readFilters(searchParams);
  const matchValues = session.agency.pocketbase_values;

  const entries = await Promise.all(
    PERIOD_TABS.map(async (tab) => {
      const filter = buildAgencyOrdersFilter({
        agencyMatchValues: matchValues,
        searchQuery,
        filters,
        periodTab: tab,
      });
      const result = await getOrdersServer({ page: 1, perPage: 1, filter });
      return [tab, result.totalItems ?? 0] as const;
    })
  );

  return Response.json(Object.fromEntries(entries));
}
