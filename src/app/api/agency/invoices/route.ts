import { agencyUnauthorizedResponse, getAgencySession } from '@/lib/agency-auth';
import { listAgencyInvoicesServer } from '@/lib/agency-invoice-match';

export const maxDuration = 60;

export async function GET() {
  const session = await getAgencySession();
  if (!session) return agencyUnauthorizedResponse();

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    return Response.json(
      {
        error:
          'Serverio konfigūracija: Vercel aplinkoje trūksta SUPABASE_SERVICE_ROLE_KEY. Susisiekite su Piksel.',
        code: 'missing_service_role',
      },
      { status: 503 }
    );
  }

  try {
    const items = await listAgencyInvoicesServer(session.agency);
    return Response.json({ items });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Nepavyko užkrauti sąskaitų.';
    console.error('GET /api/agency/invoices:', error);
    return Response.json({ error: message, code: 'load_failed' }, { status: 500 });
  }
}
