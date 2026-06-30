import type { User } from '@supabase/supabase-js';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export interface AgencyRecord {
  id: string;
  name: string;
  slug: string;
  pocketbase_values: string[];
}

export interface AgencySession {
  user: User;
  agency: AgencyRecord;
}

export async function getAgencySession(): Promise<AgencySession | null> {
  const auth = await getAgencyAuthState();
  if (auth.status !== 'ok') return null;
  return { user: auth.user, agency: auth.agency };
}

export type AgencyAuthState =
  | { status: 'anonymous' }
  | { status: 'no_agency'; user: User }
  | { status: 'ok'; user: User; agency: AgencyRecord };

export async function getAgencyAuthState(): Promise<AgencyAuthState> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) return { status: 'anonymous' };

  const { data: link, error: linkError } = await supabase
    .from('agency_users')
    .select('agency_id')
    .eq('user_id', user.id)
    .maybeSingle();

  if (linkError || !link?.agency_id) return { status: 'no_agency', user };

  const { data: agency, error: agencyError } = await supabase
    .from('agencies')
    .select('id, name, slug, pocketbase_values')
    .eq('id', link.agency_id)
    .maybeSingle();

  if (agencyError || !agency) return { status: 'no_agency', user };

  const values = Array.isArray(agency.pocketbase_values)
    ? agency.pocketbase_values.filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
    : [];

  return {
    status: 'ok',
    user,
    agency: {
      id: agency.id,
      name: agency.name,
      slug: agency.slug,
      pocketbase_values: values.length > 0 ? values : [agency.name],
    },
  };
}

export function agencyUnauthorizedResponse() {
  return Response.json({ error: 'Neprisijungęs.', code: 'anonymous' }, { status: 401 });
}

export function agencyNoLinkResponse() {
  return Response.json(
    {
      error: 'Paskyra nepririšta prie agentūros. Susisiekite su Piksel.',
      code: 'no_agency',
    },
    { status: 403 }
  );
}
