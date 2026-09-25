const LOCK_CHANNEL = 'piksel-public-plan-lock';

function notifyPublicPlanLock(orderId: string, token: string, locked: boolean) {
  try {
    const channel = new BroadcastChannel(LOCK_CHANNEL);
    channel.postMessage({ type: 'lock', orderId, token, locked });
    channel.close();
  } catch {
    /* ignore */
  }
}

export async function setPlayPublicPlanLock(orderId: string, locked: boolean): Promise<void> {
  const id = String(orderId || '').trim();
  if (!id) return;

  let token = '';
  try {
    const response = await fetch(`/api/play-campaigns?orderId=${encodeURIComponent(id)}`, {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });
    if (response.ok) {
      const record = (await response.json().catch(() => null)) as { token?: string } | null;
      token = String(record?.token || '').trim();
    }
  } catch {
    return;
  }
  if (!token) return;

  const response = await fetch(`/api/play-campaigns/${encodeURIComponent(token)}`, {
    method: 'PATCH',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ locked: Boolean(locked) }),
  });
  if (!response.ok && response.status !== 404) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error || 'Nepavyko užrakinti viešo plano');
  }
  notifyPublicPlanLock(id, token, Boolean(locked));
}
