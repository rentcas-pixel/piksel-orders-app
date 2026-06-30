import type { User } from '@supabase/supabase-js';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { AGENCY_LOGIN_PATH } from '@/lib/agency-portal-paths';
import {
  type AppRole,
  getVisibleAppTabs,
  getVisibleInvoicesSubTabs,
  hasAdminFinanceAccess,
  hasIssuedInvoiceAccess,
} from '@/lib/app-permissions';

export type { AppRole } from '@/lib/app-permissions';
export {
  getVisibleAppTabs,
  getVisibleInvoicesSubTabs,
  canAccessAppTab,
  canAccessInvoicesSubTab,
  hasAdminFinanceAccess,
  hasIssuedInvoiceAccess,
  isAdminOnlyAppTab,
} from '@/lib/app-permissions';

export type AppAuthState =
  | { status: 'anonymous' }
  | { status: 'agency_only'; user: User }
  | { status: 'forbidden'; user: User }
  | { status: 'ok'; user: User; role: AppRole };

export async function getAppAuthState(): Promise<AppAuthState> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) return { status: 'anonymous' };

  const { data: appUser, error: appError } = await supabase
    .from('app_users')
    .select('role')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!appError && appUser?.role) {
    return { status: 'ok', user, role: appUser.role as AppRole };
  }

  const { data: agencyLink, error: agencyError } = await supabase
    .from('agency_users')
    .select('user_id')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!agencyError && agencyLink) {
    return { status: 'agency_only', user };
  }

  return { status: 'forbidden', user };
}

export function appUnauthorizedResponse() {
  return Response.json({ error: 'Neprisijungęs.', code: 'anonymous' }, { status: 401 });
}

export function appForbiddenResponse() {
  return Response.json({ error: 'Neturite prieigos.', code: 'forbidden' }, { status: 403 });
}

export function appAgencyOnlyResponse() {
  return Response.json(
    {
      error: 'Agentūros paskyra. Naudokite agentūrų portalą.',
      code: 'agency_only',
      redirect: AGENCY_LOGIN_PATH,
    },
    { status: 403 }
  );
}

export async function requireAdminFinanceAccess() {
  const auth = await getAppAuthState();
  if (auth.status === 'anonymous') return appUnauthorizedResponse();
  if (auth.status !== 'ok' || !hasAdminFinanceAccess(auth.role)) return appForbiddenResponse();
  return null;
}

export async function requireIssuedInvoiceAccess() {
  const auth = await getAppAuthState();
  if (auth.status === 'anonymous') return appUnauthorizedResponse();
  if (auth.status !== 'ok' || !hasIssuedInvoiceAccess(auth.role)) return appForbiddenResponse();
  return null;
}

export async function requireAppAccess() {
  const auth = await getAppAuthState();
  if (auth.status === 'anonymous') return { error: appUnauthorizedResponse(), auth: null };
  if (auth.status === 'agency_only') {
    return { error: appAgencyOnlyResponse(), auth: null };
  }
  if (auth.status === 'forbidden') {
    return { error: appForbiddenResponse(), auth: null };
  }
  return { error: null, auth };
}
