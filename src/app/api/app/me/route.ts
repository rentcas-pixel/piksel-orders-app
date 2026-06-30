import { getAppAuthState } from '@/lib/app-auth';
import { getVisibleAppTabs, getVisibleInvoicesSubTabs } from '@/lib/app-permissions';

export async function GET() {
  const auth = await getAppAuthState();

  if (auth.status === 'anonymous') {
    return Response.json({ error: 'Neprisijungęs.', code: 'anonymous' }, { status: 401 });
  }

  if (auth.status === 'agency_only') {
    return Response.json(
      {
        error: 'Agentūros paskyra.',
        code: 'agency_only',
      },
      { status: 403 }
    );
  }

  if (auth.status === 'forbidden') {
    return Response.json({ error: 'Neturite prieigos.', code: 'forbidden' }, { status: 403 });
  }

  return Response.json({
    email: auth.user.email ?? '',
    role: auth.role,
    visibleTabs: getVisibleAppTabs(auth.role),
    visibleInvoicesSubTabs: getVisibleInvoicesSubTabs(auth.role),
  });
}
