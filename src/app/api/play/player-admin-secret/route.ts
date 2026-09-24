import { headers } from 'next/headers';
import { requireAppAccess } from '@/lib/app-auth';
import { isPlaySandboxHost } from '@/lib/play-sandbox-paths';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Play darbuotojui atiduoda grotuvo raktą, kad Live galėtų kviesti player.piksel.lt. */
export async function GET() {
  const host = (await headers()).get('host') || '';
  if (!isPlaySandboxHost(host)) {
    return Response.json({ error: 'Nerasta' }, { status: 404 });
  }

  const access = await requireAppAccess();
  if (access.error) return access.error;

  const secret = String(process.env.PLAYER_ADMIN_SECRET || '').trim();
  if (!secret) {
    return Response.json({ error: 'Grotuvo raktas serveryje nenustatytas' }, { status: 503 });
  }

  return Response.json({ secret }, { headers: { 'cache-control': 'no-store' } });
}
