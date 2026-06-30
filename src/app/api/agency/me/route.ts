import { agencyNoLinkResponse, agencyUnauthorizedResponse, getAgencyAuthState } from '@/lib/agency-auth';

export async function GET() {
  const auth = await getAgencyAuthState();
  if (auth.status === 'anonymous') return agencyUnauthorizedResponse();
  if (auth.status === 'no_agency') return agencyNoLinkResponse();

  return Response.json({
    agency: auth.agency,
    email: auth.user.email ?? '',
  });
}
