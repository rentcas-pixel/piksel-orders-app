import { agencyUnauthorizedResponse, getAgencySession } from '@/lib/agency-auth';
import { getAgencyPeriodCountsCached } from '@/lib/agency-portal-cache';
import type { AgencyListFilters } from '@/lib/agency-orders';

export const maxDuration = 60;

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

  const counts = await getAgencyPeriodCountsCached(
    session.agency.pocketbase_values,
    searchQuery,
    filters
  );

  return Response.json(counts);
}
