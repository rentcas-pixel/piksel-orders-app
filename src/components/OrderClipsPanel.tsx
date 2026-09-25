'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent, type RefObject } from 'react';
import {
  CalendarDaysIcon,
  CheckCircleIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  FilmIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';
import type { Order } from '@/types';
import {
  parseResolution,
  formatResolution,
  resolutionKey,
} from '@/lib/media-resolution-check';
import {
  addOrderClip,
  measureOrderClip,
  setOrderClipFileChange,
  clipHasCustomDisplayRange,
  clipHasCustomSchedule,
  compatibleScreensForClip,
  evaluateOrderClips,
  formatClipDisplayRangeHint,
  isPikselOwnedScreen,
  listOrderClips,
  removeOrderClip,
  resolveClipDisplayRange,
  resolveClipUploadKind,
  resolveOrderClipScreens,
  revokeClipPreviewUrls,
  screenMediaKind,
  screensFromOrderPlan,
  summarizePlanMediaCoverage,
  updateOrderClip,
  type ClipUploadKind,
  type OrderClipRecord,
  type OrderClipScreen,
} from '@/lib/order-clips';
import { publishOrderLive, unpublishOrderLive, clipIdsFromLiveStamp, orderLiveClipStamp, type OrderLiveState } from '@/lib/order-live';
import {
  classifyNewClipChange,
  clipTimeLines,
  listClipRemovals,
  looseRemovals,
  recordClipRemoval,
  removalChangeLine,
  removalsForSlot,
  type ClipRemovalNotice,
} from '@/lib/clip-times';
import { getTestOrder, isTestOrder, upsertTestOrder } from '@/lib/test-orders';
import { pushClipToPlayer } from '@/lib/player-bridge';
import {
  fetchAdminState,
  fetchMonitoring,
  normalizePlayerScreenName,
  screenPlayerStatus,
  type MonitorScreen,
  type PlayerDevice,
  type ScreenPlayerStatus,
} from '@/lib/player-devices';
import { resolveScreenClipAlert } from '@/lib/screen-clip-alert';

function filesFromDataTransfer(dt: DataTransfer | null): File[] {
  if (!dt) return [];
  const fromFiles = Array.from(dt.files || []);
  if (fromFiles.length) return fromFiles;
  const fromItems: File[] = [];
  for (const item of Array.from(dt.items || [])) {
    if (item.kind !== 'file') continue;
    const file = item.getAsFile();
    if (file) fromItems.push(file);
  }
  return fromItems;
}

type OrderClipsPanelProps = {
  order: Order;
  /** Rodyti Live mygtuką (publish į ekranus) */
  allowLivePublish?: boolean;
  liveActive?: boolean;
  /** Ekranai, į kuriuos paskutinis Live jau nusiuntė playlist */
  liveSentScreenNames?: string[];
  /** Planas / klipai pasikeitė po paskutinio Live */
  liveNeedsUpdate?: boolean;
  livePublishBusy?: boolean;
  publishedClipStamp?: string;
  /** Dabartinio Live publikacijos laikas, jei orderis dabar ekranuose. */
  livePublishedAt?: string;
  onClipStampChange?: (stamp: string) => void;
  onLivePublishBusy?: (busy: boolean) => void;
  onLiveNeedsUpdate?: () => void;
  /** Po per-publish kai keičiasi klipo datos Live ON */
  onLiveChange?: (next: OrderLiveState) => void;
  /** Išsaugo clockOverlay į order.details (Hub / PocketBase) */
  onClockOverlayChange?: (enabled: boolean) => void;
  /** Plano media padengimas lentelės Media stulpeliui (8/10) */
  onMediaCoverageChange?: (coverage: { ok: number; total: number }) => void;
};

export function OrderClipsPanel({
  order,
  allowLivePublish,
  liveActive,
  liveSentScreenNames,
  liveNeedsUpdate,
  livePublishBusy,
  publishedClipStamp,
  livePublishedAt,
  onClipStampChange,
  onLivePublishBusy,
  onLiveNeedsUpdate,
  onLiveChange,
  onClockOverlayChange,
  onMediaCoverageChange,
}: OrderClipsPanelProps) {
  const videoInputRef = useRef<HTMLInputElement>(null);
  const staticInputRef = useRef<HTMLInputElement>(null);
  const clockMenuRef = useRef<HTMLDivElement>(null);
  const scheduleFromPickerRef = useRef<HTMLInputElement>(null);
  const scheduleToPickerRef = useRef<HTMLInputElement>(null);
  const [screens, setScreens] = useState<OrderClipScreen[]>([]);
  const [clips, setClips] = useState<OrderClipRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadingKind, setUploadingKind] = useState<ClipUploadKind | null>(null);
  const [livePublishPhase, setLivePublishPhase] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [stoppingLive, setStoppingLive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOverSlot, setDragOverSlot] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [clockMenuOpen, setClockMenuOpen] = useState(false);
  const [scheduleClipId, setScheduleClipId] = useState<string | null>(null);
  const [scheduleFrom, setScheduleFrom] = useState('');
  const [scheduleTo, setScheduleTo] = useState('');
  const [scheduleScreenNames, setScheduleScreenNames] = useState<string[]>([]);
  const [scheduleSaving, setScheduleSaving] = useState(false);
  const [clockOverlayEnabled, setClockOverlayEnabled] = useState(
    () => order.details?.clockOverlay?.enabled === true
  );
  const [playerDevices, setPlayerDevices] = useState<PlayerDevice[] | null>(null);
  const [monitorScreens, setMonitorScreens] = useState<MonitorScreen[] | null>(null);
  const [campaignPublished, setCampaignPublished] = useState<boolean | null>(null);
  const [removals, setRemovals] = useState<ClipRemovalNotice[]>([]);
  const clipStamp = useMemo(() => orderLiveClipStamp(clips), [clips]);
  const publishedClipIds = useMemo(
    () => clipIdsFromLiveStamp(publishedClipStamp),
    [publishedClipStamp]
  );

  useEffect(() => {
    onClipStampChange?.(clipStamp);
  }, [clipStamp, onClipStampChange]);

  useEffect(() => {
    setRemovals(listClipRemovals(order.id));
  }, [order.id]);

  useEffect(() => {
    if (!liveActive || loading) return;
    if (!publishedClipStamp) return;
    if (publishedClipStamp !== clipStamp) onLiveNeedsUpdate?.();
  }, [liveActive, loading, publishedClipStamp, clipStamp, onLiveNeedsUpdate]);

  useEffect(() => {
    setClockOverlayEnabled(order.details?.clockOverlay?.enabled === true);
  }, [order.id, order.details?.clockOverlay?.enabled]);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([fetchAdminState(), fetchMonitoring()]).then(([state, monitoring]) => {
      if (cancelled) return;
      setPlayerDevices(state.ok ? state.devices : null);
      const campaign = state.ok
        ? state.campaigns.find((item) => String(item.id) === String(order.id))
        : undefined;
      setCampaignPublished(
        state.ok ? Boolean(campaign) && campaign?.published !== false : null
      );
      setMonitorScreens(monitoring.ok ? monitoring.data?.screens || [] : null);
    });
    return () => {
      cancelled = true;
    };
  }, [order.id]);

  useEffect(() => {
    if (liveNeedsUpdate && livePublishPhase === 'sent') {
      setLivePublishPhase('idle');
    }
  }, [liveNeedsUpdate, livePublishPhase]);

  useEffect(() => {
    if (!clockMenuOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (!clockMenuRef.current?.contains(e.target as Node)) {
        setClockMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [clockMenuOpen]);

  useEffect(() => {
    if (!scheduleClipId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setScheduleClipId(null);
      }
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [scheduleClipId]);

  const campaignFrom = String(order.from || '').trim();
  const campaignTo = String(order.to || '').trim();
  const scheduleClip = scheduleClipId
    ? clips.find((c) => c.id === scheduleClipId) || null
    : null;
  const scheduleCompatibleScreens = useMemo(() => {
    if (!scheduleClip) return [] as OrderClipScreen[];
    return compatibleScreensForClip(
      scheduleClip,
      screens.filter(isPikselOwnedScreen)
    );
  }, [scheduleClip, screens]);

  const openSchedule = (clip: OrderClipRecord) => {
    setClockMenuOpen(false);
    const range = resolveClipDisplayRange(clip, order);
    setScheduleFrom(range.from || campaignFrom);
    setScheduleTo(range.to || campaignTo);
    const compatible = compatibleScreensForClip(
      clip,
      screens.filter(isPikselOwnedScreen)
    ).map((s) => String(s.name || '').trim());
    const saved = (clip.displayScreenNames || [])
      .map((n) => String(n || '').trim())
      .filter(Boolean);
    if (saved.length) {
      const compatibleLower = new Set(compatible.map((n) => n.toLowerCase()));
      const kept = saved.filter((n) => compatibleLower.has(n.toLowerCase()));
      setScheduleScreenNames(kept.length ? kept : compatible);
    } else {
      setScheduleScreenNames(compatible);
    }
    setScheduleClipId(clip.id);
  };

  const openNativeDatePicker = (ref: RefObject<HTMLInputElement | null>) => {
    const el = ref.current;
    if (!el) return;
    try {
      if (typeof el.showPicker === 'function') {
        void el.showPicker();
        return;
      }
    } catch {
      /* fall through */
    }
    el.focus();
    el.click();
  };

  const isoDateValue = (value: string) =>
    /^\d{4}-\d{2}-\d{2}$/.test(value.trim()) ? value.trim() : '';

  const saveSchedule = async (clear = false) => {
    if (!scheduleClipId) return;
    setScheduleSaving(true);
    setError(null);
    setMessage(null);
    try {
      let displayFrom: string | null = null;
      let displayTo: string | null = null;
      let displayScreenNames: string[] | null = null;

      if (!clear) {
        const from = scheduleFrom.trim();
        const to = scheduleTo.trim();
        const isoDate = /^\d{4}-\d{2}-\d{2}$/;
        if (!from || !to) {
          throw new Error('Nurodykite abi datas (Nuo ir Iki).');
        }
        if (!isoDate.test(from) || !isoDate.test(to)) {
          throw new Error('Datos formatas: yyyy-mm-dd');
        }
        if (from > to) {
          throw new Error('„Nuo“ data negali būti vėlesnė už „Iki“.');
        }
        if (campaignFrom && from < campaignFrom) {
          throw new Error('Data negali būti anksčiau už kampanijos pradžią.');
        }
        if (campaignTo && to > campaignTo) {
          throw new Error('Data negali būti vėliau už kampanijos pabaigą.');
        }
        // Default periodas = be override
        const isDefault =
          (!campaignFrom || from === campaignFrom) &&
          (!campaignTo || to === campaignTo);
        if (!isDefault) {
          displayFrom = from;
          displayTo = to;
        }

        const compatibleNames = scheduleCompatibleScreens
          .map((s) => String(s.name || '').trim())
          .filter(Boolean);
        const selected = scheduleScreenNames
          .map((n) => String(n || '').trim())
          .filter(Boolean)
          .filter((n) =>
            compatibleNames.some((c) => c.toLowerCase() === n.toLowerCase())
          );
        if (compatibleNames.length > 0 && selected.length === 0) {
          throw new Error('Pasirinkite bent vieną ekraną.');
        }
        const allSelected =
          compatibleNames.length > 0 &&
          selected.length === compatibleNames.length &&
          compatibleNames.every((c) =>
            selected.some((s) => s.toLowerCase() === c.toLowerCase())
          );
        if (!allSelected && selected.length > 0) {
          displayScreenNames = selected;
        }
      }

      await updateOrderClip(scheduleClipId, {
        displayFrom,
        displayTo,
        displayScreenNames,
      });
      setScheduleClipId(null);
      await loadClips();

      if (liveActive) {
        onLiveNeedsUpdate?.();
        setMessage(
          clear
            ? 'Klipo tvarkaraštis išvalytas. Ekranuose sena versija — paspauskite Live.'
            : 'Klipo datos / ekranai išsaugoti. Ekranuose sena versija — paspauskite Live.'
        );
      } else {
        setMessage(
          clear
            ? 'Klipas vėl rodomas visą kampanijos periodą visuose tinkamuose ekranuose.'
            : 'Klipo rodymo datos / ekranai išsaugoti.'
        );
      }
    } catch (err) {
      const text = err instanceof Error ? err.message : 'Nepavyko išsaugoti datų.';
      setError(text);
    } finally {
      setScheduleSaving(false);
    }
  };

  const toggleScheduleScreen = (name: string) => {
    const key = name.trim().toLowerCase();
    setScheduleScreenNames((prev) => {
      const has = prev.some((n) => n.trim().toLowerCase() === key);
      if (has) return prev.filter((n) => n.trim().toLowerCase() !== key);
      return [...prev, name.trim()];
    });
  };

  const persistClockOverlay = (enabled: boolean) => {
    setClockOverlayEnabled(enabled);
    const clockOverlay = { enabled, zone: 'bottom' as const };
    if (isTestOrder(order)) {
      const fresh = getTestOrder(order.id);
      if (fresh) {
        upsertTestOrder({
          ...fresh,
          details: {
            ...fresh.details,
            isTest: true,
            clockOverlay,
          },
        });
      }
    }
    onClockOverlayChange?.(enabled);
    if (liveActive) onLiveNeedsUpdate?.();
  };

  const loadClips = useCallback(async () => {
    const next = await listOrderClips(order.id);
    setClips((prev) => {
      const prevById = new Map(prev.map((clip) => [clip.id, clip]));
      const nextIds = new Set(next.map((clip) => clip.id));
      for (const old of prev) {
        if (!nextIds.has(old.id) && old.previewUrl) URL.revokeObjectURL(old.previewUrl);
      }
      return next.map((clip) => {
        const existing = prevById.get(clip.id);
        if (existing?.previewUrl) {
          if (clip.previewUrl && clip.previewUrl !== existing.previewUrl) {
            URL.revokeObjectURL(clip.previewUrl);
          }
          return { ...clip, previewUrl: existing.previewUrl };
        }
        return clip;
      });
    });
  }, [order.id]);

  const seenPublishedStamp = useRef<string | null>(null);
  useEffect(() => {
    const stamp = publishedClipStamp || '';
    if (seenPublishedStamp.current === null) {
      seenPublishedStamp.current = stamp;
      return;
    }
    if (seenPublishedStamp.current === stamp) return;
    seenPublishedStamp.current = stamp;
    void loadClips();
  }, [publishedClipStamp, loadClips]);

  const orderRef = useRef(order);
  orderRef.current = order;
  const loadedOrderIdRef = useRef<string | null>(null);
  const planFingerprint = useMemo(() => {
    const plan = order.details?.plan;
    const rows = plan?.screenRows || [];
    if (rows.length > 0) {
      return rows
        .map((row) => [row.catalogId, row.name, row.city, row.owner, row.type, row.resolution].join('|'))
        .join(';');
    }
    return (plan?.screenNames || []).join(';');
  }, [order.details?.plan]);

  useEffect(() => {
    let cancelled = false;
    const switchedOrder = loadedOrderIdRef.current !== null && loadedOrderIdRef.current !== order.id;
    const immediateScreens = screensFromOrderPlan(orderRef.current);
    if (switchedOrder) {
      setScreens(immediateScreens);
      setClips((prev) => {
        revokeClipPreviewUrls(prev);
        return [];
      });
    } else if (loadedOrderIdRef.current === null && immediateScreens.length > 0) {
      setScreens(immediateScreens);
    }
    setLoading(immediateScreens.length === 0 && loadedOrderIdRef.current !== order.id);
    setError(null);

    const load = async () => {
      try {
        const [enriched] = await Promise.all([
          resolveOrderClipScreens(orderRef.current),
          loadClips(),
        ]);
        if (cancelled) return;
        setScreens(enriched);
        loadedOrderIdRef.current = order.id;
      } catch {
        if (!cancelled) setError('Nepavyko užkrauti ekranų / klipų.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [order.id, planFingerprint, loadClips]);

  useEffect(() => {
    return () => revokeClipPreviewUrls(clips);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- revoke only on unmount
  }, []);

  const evaluation = useMemo(() => evaluateOrderClips(screens, clips), [screens, clips]);
  const plan = evaluation.live;
  const pikselPlanScreens = evaluation.pikselScreens;
  const staticScreens = useMemo(
    () => pikselPlanScreens.filter((screen) => screenMediaKind(screen) === 'static'),
    [pikselPlanScreens]
  );
  const videoScreens = useMemo(
    () => pikselPlanScreens.filter((screen) => screenMediaKind(screen) === 'video'),
    [pikselPlanScreens]
  );
  const unknownScreens = useMemo(
    () => pikselPlanScreens.filter((screen) => screenMediaKind(screen) === 'unknown'),
    [pikselPlanScreens]
  );
  const coverageSummary = useMemo(() => summarizePlanMediaCoverage(plan), [plan]);
  const lastPushedCoverageRef = useRef('');

  useEffect(() => {
    if (loading || !onMediaCoverageChange) return;
    if (coverageSummary.total <= 0) return;
    const key = `${coverageSummary.ok}/${coverageSummary.total}`;
    if (lastPushedCoverageRef.current === key) return;
    const prev = order.details?.mediaCoverage;
    if (
      prev?.unit === 'resolution' &&
      prev.ok === coverageSummary.ok &&
      prev.total === coverageSummary.total
    ) {
      lastPushedCoverageRef.current = key;
      return;
    }
    lastPushedCoverageRef.current = key;
    onMediaCoverageChange({ ok: coverageSummary.ok, total: coverageSummary.total });
  }, [
    loading,
    onMediaCoverageChange,
    order.details?.mediaCoverage,
    coverageSummary.ok,
    coverageSummary.total,
  ]);

  const handleFiles = async (files: FileList | File[], uploadKind: ClipUploadKind) => {
    const list = Array.from(files).filter((file) => {
      const isVideo =
        file.type.startsWith('video/') || /\.(mp4|webm|mov|m4v)$/i.test(file.name);
      const isImage =
        file.type.startsWith('image/') || /\.(jpe?g|png|webp|gif)$/i.test(file.name);
      if (uploadKind === 'video') return isVideo || isImage;
      return isImage || isVideo;
    });
    if (list.length === 0) {
      setError(
        uploadKind === 'video'
          ? 'Įkelkite video (arba paveikslėlį) Video zonai.'
          : 'Įkelkite JPG/PNG arba nejudantį video Statinio zonai.'
      );
      return;
    }

    setUploadingKind(uploadKind);
    setError(null);
    setMessage(list.length === 1 ? 'Saugoma…' : `Saugoma 0/${list.length}…`);
    const existingBefore = clips;
    const added: Array<OrderClipRecord & { blob?: Blob }> = [];
    const saveErrors: string[] = [];
    try {
      for (let i = 0; i < list.length; i += 1) {
        const file = list[i];
        try {
          const clip = await addOrderClip(order.id, file, uploadKind);
          added.push(clip);
          setClips((prev) => [clip, ...prev.filter((c) => c.id !== clip.id)]);
          setMessage(`Išsaugota ${added.length}/${list.length}…`);
        } catch (err) {
          saveErrors.push(
            err instanceof Error ? `${file.name}: ${err.message}` : `${file.name}: nepavyko`
          );
        }
      }
      setUploadingKind(null);
      if (!added.length) {
        setError(saveErrors[0] || 'Nepavyko įkelti klipų.');
        return;
      }
      if (liveActive) onLiveNeedsUpdate?.();
      setMessage(`Siunčiama į serverį 0/${added.length}…`);

      let uploadedCount = 0;
      for (let i = 0; i < added.length; i += 1) {
        const clip = added[i];
        const measured = await measureOrderClip(clip).catch(() => clip);
        const changeKind = classifyNewClipChange(existingBefore, measured);
        let stamped = measured;
        if (changeKind) {
          const fileChange = {
            kind: changeKind,
            at: measured.uploadedAt || measured.createdAt,
          };
          try {
            await setOrderClipFileChange(measured.id, fileChange);
            stamped = { ...measured, fileChange };
          } catch {
            /* pokyčio eilutė atsiranda tik jei laikas išsaugotas */
          }
        }
        setClips((prev) =>
          prev.map((item) =>
            item.id === stamped.id
              ? { ...stamped, previewUrl: item.previewUrl || stamped.previewUrl }
              : item
          )
        );
        try {
          const server = await pushClipToPlayer(order.id, stamped);
          uploadedCount += 1;
          setClips((prev) =>
            prev.map((item) =>
              item.id === stamped.id
                ? {
                    ...stamped,
                    previewUrl: item.previewUrl || stamped.previewUrl,
                    serverMediaId: server.id,
                    serverPath: server.path,
                    ...(server.onServerAt ? { onServerAt: server.onServerAt } : {}),
                  }
                : item
            )
          );
        } catch {
          /* Live bandys dar kartą */
        }
        setMessage(`Į serverį ${uploadedCount}/${added.length}…`);
      }

      const localOnly = added.length - uploadedCount;
      if (saveErrors.length) {
        setError(saveErrors.join(' '));
      }
      if (localOnly && !uploadedCount) {
        setError('Failai išsaugoti čia, bet į player.piksel.lt nenuėjo. Live bandys dar kartą.');
        setMessage(null);
      } else if (localOnly) {
        setMessage(
          `Į serverį: ${uploadedCount}. ${localOnly} liko tik šiame kompe — Live bandys įkelti.`
        );
      } else {
        setMessage(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nepavyko įkelti klipo.');
      setUploadingKind(null);
    }
  };

  const handleRemove = async (clipId: string) => {
    const clip = clips.find((item) => item.id === clipId);
    try {
      await removeOrderClip(clipId);
      if (clip) {
        const saved = recordClipRemoval({
          clipId: clip.id,
          orderId: String(order.id),
          at: new Date().toISOString(),
          uploadKind: resolveClipUploadKind(clip),
          resolutionKey: clip.resolutionKey,
          filename: clip.filename,
        });
        if (saved) setRemovals(saved);
      }
      await loadClips();
      if (liveActive) onLiveNeedsUpdate?.();
    } catch {
      setError('Nepavyko ištrinti klipo.');
    }
  };

  const handlePublishLive = async () => {
    if (!allowLivePublish || livePublishPhase === 'sending' || livePublishBusy || stoppingLive) return;
    setLivePublishPhase('sending');
    onLivePublishBusy?.(true);
    setError(null);
    setMessage(null);
    const startedAt = Date.now();
    const minSendingMs = 1200;
    try {
      const liveOrder = isTestOrder(order)
        ? { ...(getTestOrder(order.id) || order), ...order }
        : order;
      const result = await publishOrderLive(liveOrder);
      const elapsed = Date.now() - startedAt;
      if (elapsed < minSendingMs) {
        await new Promise((r) => setTimeout(r, minSendingMs - elapsed));
      }
      onLiveChange?.(result.live);
      await loadClips();
      setLivePublishPhase('sent');
    } catch (err) {
      const text = err instanceof Error ? err.message : 'Nepavyko publikuoti į Live.';
      setError(text);
      setLivePublishPhase('idle');
      window.alert(text);
    } finally {
      onLivePublishBusy?.(false);
    }
  };

  const handleStopLive = async () => {
    if (!allowLivePublish || !liveActive || livePublishPhase === 'sending' || stoppingLive) return;
    setStoppingLive(true);
    setError(null);
    setMessage(null);
    try {
      const liveOrder = isTestOrder(order) ? getTestOrder(order.id) || order : order;
      const next = await unpublishOrderLive(liveOrder);
      onLiveChange?.(next);
      setMessage('Live sustabdyta — kampanija nuimta nuo ekranų.');
    } catch (err) {
      const text = err instanceof Error ? err.message : 'Nepavyko sustabdyti Live.';
      setError(text);
      window.alert(text);
    } finally {
      setStoppingLive(false);
    }
  };

  const screenCovered = (screen: OrderClipScreen) => {
    const name = String(screen.name || '').trim().toLowerCase();
    const kind = screenMediaKind(screen);
    return plan.matchedAssignments.some((assignment) => {
      if (!assignment.screenNames.some((n) => n.trim().toLowerCase() === name)) {
        return false;
      }
      if (kind === 'unknown') return true;
      return assignment.uploadKind === kind;
    });
  };

  const screenLabel = (screen: OrderClipScreen) => {
    const name = String(screen.name || '').trim();
    const city = String(screen.city || '').trim();
    if (city && name && !name.toLowerCase().includes(city.toLowerCase())) {
      return `${name} ${city}`;
    }
    return name;
  };

  const screenDeviceStatus = (name: string): ScreenPlayerStatus | null => {
    if (!playerDevices) return null;
    return screenPlayerStatus(playerDevices, name);
  };

  const monitorForScreen = (name: string): MonitorScreen | undefined => {
    if (!monitorScreens) return undefined;
    const key = normalizePlayerScreenName(name);
    return monitorScreens.find(
      (item) => normalizePlayerScreenName(item.device.screenName) === key
    );
  };

  const clipDeliveredToScreen = (name: string): boolean | null => {
    const key = normalizePlayerScreenName(name);
    const sentNames = liveSentScreenNames?.length
      ? liveSentScreenNames
      : order.details?.live?.screenNames;
    if (
      liveActive &&
      Array.isArray(sentNames) &&
      sentNames.some((item) => normalizePlayerScreenName(item) === key)
    ) {
      return true;
    }
    if (!monitorScreens) return null;
    const monitor = monitorForScreen(name);
    if (!monitor) return false;
    const orderId = String(order.id);
    if (monitor.rotation?.some((item) => String(item.campaignId) === orderId)) {
      return true;
    }
    const client = normalizePlayerScreenName(order.client);
    return (monitor.campaigns || []).some(
      (item) => normalizePlayerScreenName(item) === client
    );
  };

  const screenAlertFor = (name: string, hasClip: boolean) => {
    const liveNames = order.details?.live?.screenNames;
    const liveListed =
      Array.isArray(liveNames) &&
      liveNames.some((item) => normalizePlayerScreenName(item) === normalizePlayerScreenName(name));
    const liveExpected = liveActive || campaignPublished === true || liveListed;
    return resolveScreenClipAlert({
      hasClip,
      deviceStatus: screenDeviceStatus(name),
      liveExpected,
      delivered: clipDeliveredToScreen(name),
    });
  };

  const renderScreenAlert = (name: string, hasClip: boolean) => {
    const status = screenAlertFor(name, hasClip);
    if (!status) return null;
    if (status.kind === 'ok') {
      return (
        <span
          className="text-xs font-medium text-emerald-700 dark:text-emerald-300"
          title={status.title}
        >
          {status.label}
        </span>
      );
    }
    return (
      <span
        className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-red-600 animate-pulse dark:text-red-400"
        title={status.title}
      >
        ⚠️ {status.label}
      </span>
    );
  };

  const buildSlots = (kind: ClipUploadKind, list: OrderClipScreen[]) => {
    const map = new Map<string, OrderClipScreen[]>();
    for (const screen of list) {
      const size = parseResolution(screen.resolution);
      const key = size ? resolutionKey(size) : `none:${screenLabel(screen)}`;
      const bucket = map.get(key);
      if (bucket) bucket.push(screen);
      else map.set(key, [screen]);
    }
    const kindClips = clips.filter((clip) => resolveClipUploadKind(clip) === kind);
    return [...map.entries()].map(([resKey, grouped]) => {
      const size = parseResolution(grouped[0]?.resolution);
      const resolutionKeyValue = size ? resolutionKey(size) : null;
      const seen = new Set<string>();
      const uniqueScreens: Array<{
        key: string;
        name: string;
        label: string;
        covered: boolean;
      }> = [];
      for (const screen of grouped) {
        const name = String(screen.name || '').trim();
        const label = screenLabel(screen);
        const seenKey = label.toLowerCase();
        if (seen.has(seenKey)) continue;
        seen.add(seenKey);
        uniqueScreens.push({
          key: `${screen.id || label}-${resKey}`,
          name,
          label,
          covered: screenCovered(screen),
        });
      }
      return {
        id: `${kind}:${resKey}`,
        kind,
        resolutionKey: resolutionKeyValue,
        resolutionLabel: size ? formatResolution(size) : 'rezoliucija nežinoma',
        screens: uniqueScreens,
        covered: uniqueScreens.length > 0 && uniqueScreens.every((item) => item.covered),
        clips: kindClips.filter(
          (clip) => resolutionKeyValue && clip.resolutionKey === resolutionKeyValue
        ),
      };
    });
  };

  const staticSlots = buildSlots('static', staticScreens);
  const videoSlots = buildSlots('video', videoScreens);
  const leftoverClips = (kind: ClipUploadKind) => {
    const slots = kind === 'static' ? staticSlots : videoSlots;
    const claimed = new Set(
      slots.flatMap((slot) => slot.clips.map((clip) => clip.id))
    );
    return clips.filter(
      (clip) => resolveClipUploadKind(clip) === kind && !claimed.has(clip.id)
    );
  };

  const dropHandlers = (slotId: string, kind: ClipUploadKind) => ({
    onDragOver: (e: DragEvent<HTMLElement>) => {
      e.preventDefault();
      e.stopPropagation();
      e.dataTransfer.dropEffect = 'copy';
      setDragOverSlot(slotId);
    },
    onDragLeave: (e: DragEvent<HTMLElement>) => {
      const next = e.relatedTarget as Node | null;
      if (next && e.currentTarget.contains(next)) return;
      setDragOverSlot((prev) => (prev === slotId ? null : prev));
    },
    onDrop: (e: DragEvent<HTMLElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setDragOverSlot(null);
      const dropped = filesFromDataTransfer(e.dataTransfer);
      if (dropped.length) void handleFiles(dropped, kind);
    },
  });

  const renderClipCard = (clip: OrderClipRecord) => {
    const kind = resolveClipUploadKind(clip);
    const hasCustomSchedule = clipHasCustomSchedule(clip);
    const hasCustomRange = clipHasCustomDisplayRange(clip);
    const rangeHint = hasCustomRange
      ? formatClipDisplayRangeHint(resolveClipDisplayRange(clip, order))
      : '';
    const screenHint = clip.displayScreenNames?.length
      ? `${clip.displayScreenNames.length} ekr.`
      : '';
    const scheduleHint = [rangeHint, screenHint].filter(Boolean).join(' · ');
    const timeline = clipTimeLines(clip, {
      publishedAt: liveActive
        ? livePublishedAt || order.details?.live?.publishedAt
        : undefined,
      publishedClipIds,
    });
    const clipTimes =
      timeline.times.length > 0 ? (
        <div className="mt-1.5 space-y-0.5">
          {timeline.times.map((line) => (
            <div key={line.label} className="text-[12.5px] leading-snug text-[#667181] dark:text-gray-400">
              <span className="font-semibold text-[#3d4756] dark:text-gray-200">{line.label}</span> {line.at}
            </div>
          ))}
        </div>
      ) : null;
    const clipChange = timeline.change ? (
      <div className="mt-1.5 inline-block rounded-lg bg-[#fff6e8] px-2 py-1.5 text-[12.5px] leading-snug text-[#8a5a12] dark:bg-amber-950/40 dark:text-amber-200">
        {timeline.change.label} · {timeline.change.at}
      </div>
    ) : null;
    return (
      <div
        key={clip.id}
        className="flex items-start gap-3 rounded-lg border border-gray-200 px-3 py-2 dark:border-gray-700"
      >
        <div className="flex h-12 w-16 shrink-0 items-center justify-center overflow-hidden rounded bg-gray-100 dark:bg-gray-900">
          {clip.previewUrl && clip.mimeType.startsWith('video/') ? (
            <video
              src={clip.previewUrl}
              muted
              preload="none"
              className="h-full w-full object-cover"
            />
          ) : clip.previewUrl && clip.mimeType.startsWith('image/') ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={clip.previewUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <FilmIcon className="h-5 w-5 text-gray-400" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium text-gray-900 dark:text-white">
            {clip.filename}
          </div>
          <div className="text-xs text-gray-500">
            <span className={kind === 'video' ? 'text-blue-600' : 'text-violet-600'}>
              {kind === 'video' ? 'Video' : 'Statinis'}
            </span>
            {' · '}
            {clip.resolutionLabel || 'rezoliucija nežinoma'}
            {plan.unmatchedClips.some((a) => a.clipId === clip.id) ? (
              <span className="text-amber-600"> · neatitinka plano</span>
            ) : null}
            {scheduleHint ? (
              <span className="text-emerald-700"> · {scheduleHint}</span>
            ) : null}
            {clip.serverPath ? (
              <span className="text-emerald-700"> · serveryje</span>
            ) : (
              <span className="text-amber-600"> · tik šiame kompe</span>
            )}
          </div>
          {clipTimes}
          {clipChange}
        </div>
        <button
          type="button"
          title={
            hasCustomSchedule
              ? `Rodymo tvarkaraštis: ${scheduleHint || 'custom'}`
              : 'Nustatyti rodymo datas ir ekranus (numatytai — kampanijos periodas, visi tinkami)'
          }
          onClick={() => openSchedule(clip)}
          className={`rounded-md p-1.5 transition-colors ${
            hasCustomSchedule
              ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-900/40 dark:text-emerald-300'
              : 'text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-700 dark:hover:text-gray-200'
          }`}
        >
          <CalendarDaysIcon className="h-4 w-4" />
        </button>
        <button
          type="button"
          title="Ištrinti"
          onClick={() => void handleRemove(clip.id)}
          className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-red-600 dark:hover:bg-gray-700"
        >
          <TrashIcon className="h-4 w-4" />
        </button>
      </div>
    );
  };

  const typeSections = [
    {
      kind: 'static' as const,
      title: 'Statinis',
      inputRef: staticInputRef,
      slots: staticSlots,
      leftover: leftoverClips('static'),
    },
    {
      kind: 'video' as const,
      title: 'Video',
      inputRef: videoInputRef,
      slots: videoSlots,
      leftover: leftoverClips('video'),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-1.5">
            <h3 className="text-base font-semibold text-gray-900 dark:text-white">Klipai</h3>
            <div className="relative" ref={clockMenuRef}>
              <button
                type="button"
                title="Laikrodžio overlay"
                aria-expanded={clockMenuOpen}
                onClick={() => setClockMenuOpen((v) => !v)}
                className={`rounded-md p-1 transition-colors ${
                  clockOverlayEnabled
                    ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-900/40 dark:text-emerald-300'
                    : 'text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-700 dark:hover:text-gray-200'
                }`}
              >
                <ClockIcon className="h-4 w-4" />
              </button>
              {clockMenuOpen && (
                <div className="absolute left-0 z-20 mt-1 w-72 rounded-xl border border-gray-200 bg-white p-3 shadow-lg dark:border-gray-600 dark:bg-gray-800">
                  <div className="text-sm font-semibold text-gray-900 dark:text-white">
                    Laikrodžio overlay
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-gray-500 dark:text-gray-400">
                    Įjunkite, jei MP4 apačioje palikta tuščia zona. Playeris ten brėš tikrą
                    laiką (HH:mm:ss, Vilnius).
                  </p>
                  <label className="mt-3 flex cursor-pointer items-center gap-2 text-sm text-gray-800 dark:text-gray-100">
                    <input
                      type="checkbox"
                      checked={clockOverlayEnabled}
                      onChange={(e) => persistClockOverlay(e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                    />
                    Rodyti laikrodį ant klipo
                  </label>
                  <p className="mt-2 text-[11px] text-gray-400">Zona: apačia · po Live publish</p>
                </div>
              )}
            </div>
            {clockOverlayEnabled && (
              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                Laikrodis
              </span>
            )}
          </div>
        </div>
        <div
          className={`rounded-full px-3 py-1 text-xs font-semibold ${
            plan.isComplete
              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-200'
              : plan.missingScreenResolutions
                ? 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-200'
                : plan.hasMatchingClips
                  ? 'bg-amber-50 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200'
                  : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
          }`}
        >
          {evaluation.live.coverageLabel}
        </div>
      </div>

      {loading && screens.length === 0 ? (
        <p className="text-sm text-gray-500">Kraunama…</p>
      ) : (
        <>
          <div className="space-y-6">
            {typeSections.map((section) => {
              if (section.slots.length === 0 && section.leftover.length === 0) {
                return null;
              }
              const saving = uploadingKind === section.kind;
              return (
                <section key={section.kind} className="space-y-3">
                  <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
                    {section.title}
                  </h4>
                  {section.slots.map((slot) => {
                    const hot = dragOverSlot === slot.id;
                    return (
                      <div
                        key={slot.id}
                        {...dropHandlers(slot.id, section.kind)}
                        className={`rounded-2xl border p-4 transition-colors ${
                          hot
                            ? 'border-blue-400 bg-blue-50 dark:border-blue-500 dark:bg-blue-950/30'
                            : 'border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800/40'
                        }`}
                      >
                        <div className="mb-3 flex items-start justify-between gap-3">
                          <div className="flex items-center gap-1.5 text-sm font-semibold text-gray-900 dark:text-white">
                            {slot.covered ? (
                              <CheckCircleIcon className="h-4 w-4 text-emerald-500" />
                            ) : (
                              <ExclamationTriangleIcon className="h-4 w-4 text-amber-500" />
                            )}
                            {slot.resolutionLabel}
                          </div>
                          <button
                            type="button"
                            onClick={() => section.inputRef.current?.click()}
                            className="shrink-0 rounded-lg border border-dashed border-gray-300 bg-gray-50 px-3 py-2 text-xs font-medium text-gray-700 hover:border-gray-400 dark:border-gray-600 dark:bg-gray-900/40 dark:text-gray-200"
                          >
                            {saving ? 'Saugoma…' : 'Įkelti'}
                          </button>
                        </div>
                        <ul className="space-y-1.5">
                          {slot.screens.map((screen) => {
                            const status = screenAlertFor(screen.name, screen.covered);
                            const isOk = status?.kind === 'ok';
                            const isAlert = status?.kind === 'alert';
                            return (
                            <li
                              key={screen.key}
                              className="flex items-center gap-2 text-sm text-gray-800 dark:text-gray-100"
                            >
                              {isOk ? (
                                <CheckCircleIcon className="h-4 w-4 shrink-0 text-emerald-500" />
                              ) : isAlert ? (
                                <ExclamationTriangleIcon className="h-4 w-4 shrink-0 text-red-500" />
                              ) : (
                                <span className="h-4 w-4 shrink-0" aria-hidden />
                              )}
                              <span className="min-w-0">{screen.label}</span>
                              {isAlert ? (
                                <span
                                  className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-red-600 animate-pulse dark:text-red-400"
                                  title={status.title}
                                >
                                  ⚠️ {status.label}
                                </span>
                              ) : isOk ? (
                                <span
                                  className="text-xs font-medium text-emerald-700 dark:text-emerald-300"
                                  title={status.title}
                                >
                                  {status.label}
                                </span>
                              ) : null}
                            </li>
                            );
                          })}
                        </ul>
                        {slot.clips.length > 0 ||
                        removalsForSlot(removals, section.kind, slot.resolutionKey).length > 0 ? (
                          <div className="mt-3 space-y-2">
                            {slot.clips.map(renderClipCard)}
                            {removalsForSlot(removals, section.kind, slot.resolutionKey).map(
                              (notice) => {
                                const line = removalChangeLine(notice);
                                if (!line) return null;
                                return (
                                  <div
                                    key={`${notice.clipId}-${notice.at}`}
                                    className="inline-block rounded-lg bg-[#fff6e8] px-2 py-1.5 text-[12.5px] leading-snug text-[#8a5a12] dark:bg-amber-950/40 dark:text-amber-200"
                                  >
                                    {line.label} · {line.at}
                                  </div>
                                );
                              }
                            )}
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                  {section.leftover.length > 0 ||
                  looseRemovals(
                    removals,
                    section.kind,
                    section.slots.map((slot) => slot.resolutionKey)
                  ).length > 0 ? (
                    <div className="space-y-2">
                      {section.leftover.length > 0 ? (
                        <p className="text-xs font-medium text-amber-700 dark:text-amber-300">
                          {section.title} klipai, kurie dar neprisiskyrė prie rezoliucijos
                        </p>
                      ) : null}
                      {section.leftover.map(renderClipCard)}
                      {looseRemovals(
                        removals,
                        section.kind,
                        section.slots.map((slot) => slot.resolutionKey)
                      ).map((notice) => {
                        const line = removalChangeLine(notice);
                        if (!line) return null;
                        return (
                          <div
                            key={`${notice.clipId}-${notice.at}`}
                            className="inline-block rounded-lg bg-[#fff6e8] px-2 py-1.5 text-[12.5px] leading-snug text-[#8a5a12] dark:bg-amber-950/40 dark:text-amber-200"
                          >
                            {line.label} · {line.at}
                          </div>
                        );
                      })}
                    </div>
                  ) : null}
                </section>
              );
            })}
            {pikselPlanScreens.length === 0 ? (
              <p className="text-sm text-gray-500">
                Šiame orderyje nėra ekranų (arba planas dar neišsaugotas).
              </p>
            ) : null}
            {unknownScreens.length > 0 ? (
              <section>
                <h4 className="mb-2 text-sm font-semibold text-gray-900 dark:text-white">
                  Ekranai be tipo
                </h4>
                <p className="mb-2 text-xs text-gray-500">
                  Plane nenurodyta, ar tai statinis, ar video — patikrink skaičiuoklę.
                </p>
                <ul className="space-y-1.5 text-sm">
                  {unknownScreens.map((screen) => {
                    const name = String(screen.name || '').trim();
                    const status = screenAlertFor(name, screenCovered(screen));
                    const isOk = status?.kind === 'ok';
                    return (
                    <li
                      key={`${screen.id || screen.name}-${screen.resolution || ''}-unknown`}
                      className="flex items-center gap-2 text-gray-800 dark:text-gray-100"
                    >
                      {isOk ? (
                        <CheckCircleIcon className="h-4 w-4 shrink-0 text-emerald-500" />
                      ) : (
                        <ExclamationTriangleIcon className="h-4 w-4 shrink-0 text-red-500" />
                      )}
                      <span>{screenLabel(screen)}</span>
                      {renderScreenAlert(name, screenCovered(screen))}
                    </li>
                    );
                  })}
                </ul>
              </section>
            ) : null}
          </div>
          <input
            ref={videoInputRef}
            type="file"
            accept="video/*,image/*,.mp4,.mov,.m4v,.webm"
            multiple
            className="sr-only"
            tabIndex={-1}
            onChange={(e) => {
              const selected = e.target.files ? Array.from(e.target.files) : [];
              e.target.value = '';
              if (selected.length) void handleFiles(selected, 'video');
            }}
          />
          <input
            ref={staticInputRef}
            type="file"
            accept="image/*,video/*,.jpg,.jpeg,.png,.webp,.mp4"
            multiple
            className="sr-only"
            tabIndex={-1}
            onChange={(e) => {
              const selected = e.target.files ? Array.from(e.target.files) : [];
              e.target.value = '';
              if (selected.length) void handleFiles(selected, 'static');
            }}
          />

          <div className="flex flex-wrap items-center justify-end gap-3 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 dark:border-gray-700 dark:bg-gray-900/40">
            <div className="flex flex-wrap gap-2">
              {allowLivePublish && (
                <>
                  {liveActive && livePublishPhase !== 'sending' && (
                    <button
                      type="button"
                      disabled={stoppingLive}
                      onClick={() => void handleStopLive()}
                      className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300 dark:hover:bg-red-950/50"
                    >
                      {stoppingLive ? 'Stabdoma…' : 'Stabdyti'}
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={
                      livePublishPhase === 'sending' ||
                      livePublishBusy ||
                      stoppingLive ||
                      (liveActive && !liveNeedsUpdate)
                    }
                    onClick={() => void handlePublishLive()}
                    className={`rounded-lg px-3 py-2 text-sm font-medium disabled:cursor-not-allowed ${
                      livePublishPhase === 'sending' || livePublishBusy
                        ? 'border border-emerald-200 bg-emerald-50 text-emerald-700 opacity-80 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300'
                        : liveActive && liveNeedsUpdate
                          ? 'border border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700'
                          : liveActive
                            ? 'border border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300'
                            : 'border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300 dark:hover:bg-emerald-950/50'
                    }`}
                  >
                    {livePublishPhase === 'sending' || livePublishBusy
                      ? 'Siunčiama…'
                      : liveActive && liveNeedsUpdate
                        ? 'Live'
                        : liveActive
                          ? 'Išsiųsta'
                          : 'Live'}
                  </button>
                </>
              )}
            </div>
          </div>

          {message && (
            <p className="text-sm text-emerald-700 dark:text-emerald-300">{message}</p>
          )}
          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        </>
      )}

      {scheduleClipId && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="clip-schedule-title"
          onClick={() => {
            if (!scheduleSaving) setScheduleClipId(null);
          }}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-5 shadow-xl dark:border-gray-600 dark:bg-gray-800"
            onClick={(e) => e.stopPropagation()}
          >
            <h4
              id="clip-schedule-title"
              className="text-base font-semibold text-gray-900 dark:text-white"
            >
              Rodymo datos
            </h4>
            {scheduleClip ? (
              <p className="mt-1 truncate text-sm text-gray-600 dark:text-gray-300">
                {scheduleClip.filename}
              </p>
            ) : null}
            <p className="mt-2 text-sm leading-relaxed text-gray-500 dark:text-gray-400">
              Jei nenustatote — klipas rodomas visą kampanijos periodą
              {campaignFrom && campaignTo ? ` (${campaignFrom} – ${campaignTo})` : ''} visuose
              tinkamuose ekranuose.
            </p>
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Nuo
                <span className="relative mt-1.5 block">
                  <CalendarDaysIcon className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    readOnly
                    placeholder="yyyy-mm-dd"
                    value={scheduleFrom}
                    onClick={() => openNativeDatePicker(scheduleFromPickerRef)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        openNativeDatePicker(scheduleFromPickerRef);
                      }
                    }}
                    className="w-full cursor-pointer rounded-lg border border-gray-300 bg-white py-2.5 pl-10 pr-3 font-inherit text-sm tracking-wide text-gray-900 shadow-sm placeholder:text-gray-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder:text-gray-500 dark:focus:border-emerald-400 dark:focus:ring-emerald-400/20"
                  />
                  <input
                    ref={scheduleFromPickerRef}
                    type="date"
                    tabIndex={-1}
                    aria-hidden
                    value={isoDateValue(scheduleFrom)}
                    min={campaignFrom || undefined}
                    max={campaignTo || undefined}
                    onChange={(e) => setScheduleFrom(e.target.value)}
                    className="pointer-events-none absolute inset-0 h-full w-full opacity-0"
                  />
                </span>
              </label>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Iki
                <span className="relative mt-1.5 block">
                  <CalendarDaysIcon className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    readOnly
                    placeholder="yyyy-mm-dd"
                    value={scheduleTo}
                    onClick={() => openNativeDatePicker(scheduleToPickerRef)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        openNativeDatePicker(scheduleToPickerRef);
                      }
                    }}
                    className="w-full cursor-pointer rounded-lg border border-gray-300 bg-white py-2.5 pl-10 pr-3 font-inherit text-sm tracking-wide text-gray-900 shadow-sm placeholder:text-gray-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder:text-gray-500 dark:focus:border-emerald-400 dark:focus:ring-emerald-400/20"
                  />
                  <input
                    ref={scheduleToPickerRef}
                    type="date"
                    tabIndex={-1}
                    aria-hidden
                    value={isoDateValue(scheduleTo)}
                    min={campaignFrom || undefined}
                    max={campaignTo || undefined}
                    onChange={(e) => setScheduleTo(e.target.value)}
                    className="pointer-events-none absolute inset-0 h-full w-full opacity-0"
                  />
                </span>
              </label>
            </div>

            <div className="mt-4">
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Ekranai
                  {scheduleCompatibleScreens.length
                    ? ` (${scheduleScreenNames.length}/${scheduleCompatibleScreens.length})`
                    : ''}
                </span>
                {scheduleCompatibleScreens.length > 0 ? (
                  <button
                    type="button"
                    disabled={scheduleSaving}
                    onClick={() =>
                      setScheduleScreenNames(
                        scheduleCompatibleScreens.map((s) => String(s.name || '').trim())
                      )
                    }
                    className="text-xs font-medium text-emerald-700 hover:underline disabled:opacity-50 dark:text-emerald-300"
                  >
                    Visi
                  </button>
                ) : null}
              </div>
              {scheduleCompatibleScreens.length === 0 ? (
                <p className="rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-500 dark:bg-gray-900/40 dark:text-gray-400">
                  Nėra tinkamų plano ekranų šiam klipui.
                </p>
              ) : (
                <ul className="max-h-40 space-y-1.5 overflow-y-auto rounded-lg border border-gray-200 p-2 dark:border-gray-600">
                  {scheduleCompatibleScreens.map((screen) => {
                    const name = String(screen.name || '').trim();
                    const checked = scheduleScreenNames.some(
                      (n) => n.trim().toLowerCase() === name.toLowerCase()
                    );
                    return (
                      <li key={`${screen.id || name}-${screen.resolution || ''}`}>
                        <label className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-900/40">
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={scheduleSaving}
                            onChange={() => toggleScheduleScreen(name)}
                            className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                          />
                          <span className="min-w-0 flex-1 truncate text-sm text-gray-800 dark:text-gray-100">
                            {name}
                            {screen.city ? (
                              <span className="ml-1 font-normal text-gray-500">
                                {screen.city}
                              </span>
                            ) : null}
                          </span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                disabled={scheduleSaving}
                onClick={() => void saveSchedule(true)}
                className="text-sm font-medium text-gray-500 hover:text-gray-800 disabled:opacity-50 dark:hover:text-gray-200"
              >
                Išvalyti
              </button>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={scheduleSaving}
                  onClick={() => setScheduleClipId(null)}
                  className="rounded-lg px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
                >
                  Atšaukti
                </button>
                <button
                  type="button"
                  disabled={scheduleSaving}
                  onClick={() => void saveSchedule(false)}
                  className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  {scheduleSaving ? 'Saugoma…' : 'Išsaugoti'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
