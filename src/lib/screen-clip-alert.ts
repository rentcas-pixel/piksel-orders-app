import {
  normalizePlayerScreenName,
  screenPlayerStatus,
  type MonitorScreen,
  type PlayerDevice,
  type ScreenPlayerStatus,
} from '@/lib/player-devices';

export type ScreenClipAlertCode = 'no-clip' | 'off' | 'not-delivered' | 'sent';

export type ScreenClipAlert = {
  code: ScreenClipAlertCode;
  label: string;
  title: string;
  kind: 'alert' | 'ok';
  deviceStatus?: ScreenPlayerStatus;
};

export type NamedScreenAlert = {
  name: string;
  alert: ScreenClipAlert;
};

/**
 * Ekrano statusas:
 * 1. nėra klipo
 * 2. ekranas išjungtas / neprijungtas
 * 3. klipas į ekraną nenuėjo
 * 4. klipas nuėjo (Išsiųsta)
 */
export function resolveScreenClipAlert(input: {
  hasClip: boolean;
  deviceStatus: ScreenPlayerStatus | null;
  liveExpected: boolean;
  delivered: boolean | null;
}): ScreenClipAlert | null {
  if (!input.hasClip) {
    return {
      code: 'no-clip',
      kind: 'alert',
      label: 'Nėra klipo',
      title: 'Šiam ekranui nėra tinkamo klipo',
    };
  }

  if (input.deviceStatus === 'missing' || input.deviceStatus === 'offline') {
    const missing = input.deviceStatus === 'missing';
    return {
      code: 'off',
      kind: 'alert',
      label: 'Išjungtas',
      title: missing
        ? 'Ekrano playeris neprijungtas — klipas į jį nenuėjo'
        : 'Ekranas išjungtas / playeris atsijungęs',
      deviceStatus: input.deviceStatus,
    };
  }

  if (input.deviceStatus == null || input.delivered == null) return null;

  if (input.delivered === true) {
    return {
      code: 'sent',
      kind: 'ok',
      label: 'Išsiųsta',
      title: 'Klipas nusiųstas į šį ekraną',
    };
  }

  if (input.liveExpected && input.delivered === false) {
    return {
      code: 'not-delivered',
      kind: 'alert',
      label: 'Nenuėjo',
      title: 'Klipas į šį ekraną nenuėjo',
    };
  }

  return null;
}

export function orderPlayingOnMonitor(
  monitor: MonitorScreen,
  orderId: string,
  client: string
): boolean {
  if (monitor.nowPlaying && String(monitor.nowPlaying.campaignId) === String(orderId)) {
    return true;
  }
  if (monitor.rotation?.some((item) => String(item.campaignId) === String(orderId))) {
    return true;
  }
  const clientKey = normalizePlayerScreenName(client);
  return (monitor.campaigns || []).some(
    (item) => normalizePlayerScreenName(item) === clientKey
  );
}

/** Ši versija visuose nusiųstuose ekranuose — ne kampanijos vardas ir ne „bent vienas“. */
export function orderLiveSeenOnPlayer(
  monitors: MonitorScreen[] | null | undefined,
  orderId: string,
  screenNames: string[] | undefined,
  clipIds: string[] | undefined
): boolean {
  const wanted = [
    ...new Set(
      (screenNames || []).map((name) => normalizePlayerScreenName(name)).filter(Boolean)
    ),
  ];
  const expectedClips = [...new Set((clipIds || []).map((id) => String(id || '').trim()).filter(Boolean))];
  if (!monitors?.length || wanted.length === 0 || expectedClips.length === 0) return false;

  return wanted.every((screenKey) => {
    const monitor = monitors.find(
      (item) => normalizePlayerScreenName(item.device.screenName) === screenKey
    );
    if (!monitor) return false;
    const items = [
      monitor.nowPlaying,
      monitor.reportedNowPlaying,
      ...(monitor.rotation || []),
    ].filter((item): item is NonNullable<typeof item> => Boolean(item?.id));
    const forThisOrder = items.filter((item) => String(item.campaignId) === String(orderId));
    if (!forThisOrder.length) return false;
    return forThisOrder.some((item) => expectedClips.includes(String(item.id)));
  });
}

export function collectOrderScreenAlerts(input: {
  screens: Array<{ name?: string | null }>;
  coveredScreenNames: string[];
  devices: PlayerDevice[] | null;
  monitors: MonitorScreen[] | null;
  liveExpected: boolean;
  sentScreenNames?: string[];
  orderId: string;
  client: string;
}): NamedScreenAlert[] {
  const covered = new Set(
    input.coveredScreenNames.map((name) => normalizePlayerScreenName(name)).filter(Boolean)
  );
  const sent = new Set(
    (input.sentScreenNames || []).map((name) => normalizePlayerScreenName(name)).filter(Boolean)
  );
  const seen = new Set<string>();
  const out: NamedScreenAlert[] = [];

  for (const screen of input.screens) {
    const name = String(screen.name || '').trim();
    const key = normalizePlayerScreenName(name);
    if (!name || seen.has(key)) continue;
    seen.add(key);

    const monitor = input.monitors?.find(
      (item) => normalizePlayerScreenName(item.device.screenName) === key
    );
    const sentToScreen = sent.has(key);
    const alert = resolveScreenClipAlert({
      hasClip: covered.has(key),
      deviceStatus: input.devices ? screenPlayerStatus(input.devices, name) : null,
      liveExpected: input.liveExpected,
      delivered: sentToScreen
        ? true
        : input.monitors == null
          ? null
          : monitor
            ? orderPlayingOnMonitor(monitor, input.orderId, input.client)
            : false,
    });
    if (alert && alert.kind === 'alert') out.push({ name, alert });
  }

  return out;
}

/** Sąrašo Media ⚠️: nėra klipo, nenuėjo, arba plano ekranas visai neprijungtas. */
export function isListMediaScreenAlert(alert: ScreenClipAlert): boolean {
  if (alert.kind !== 'alert') return false;
  if (alert.code === 'no-clip' || alert.code === 'not-delivered') return true;
  return alert.code === 'off' && alert.deviceStatus === 'missing';
}

