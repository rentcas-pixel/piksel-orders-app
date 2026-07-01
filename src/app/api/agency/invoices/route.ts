import { agencyUnauthorizedResponse, getAgencySession } from '@/lib/agency-auth';
import { listAgencyInvoicesServer } from '@/lib/agency-invoice-match';

export async function GET() {
  const session = await getAgencySession();
  if (!session) return agencyUnauthorizedResponse();

  try {
    const items = await listAgencyInvoicesServer(session.agency);
    return Response.json({ items });
  } catch {
    return Response.json({ error: 'Nepavyko užkrauti sąskaitų.' }, { status: 500 });
  }
}
