'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  addDays,
  addMonths,
  subDays,
  subMonths,
  getISOWeek,
} from 'date-fns';
import {
  ChevronLeftIcon,
  ChevronRightIcon,
} from '@heroicons/react/24/outline';
import type { PlayerCampaign, PlayerDevice } from '@/lib/player-devices';
import {
  fetchDeviceSchedule,
  saveDeviceSchedule,
} from '@/lib/player-devices';
import {
  SCHEDULE_HOURS,
  campaignInDateRange,
  campaignsForScreenInMonth,
  campaignsForScreenOnDay,
  campaignsOnHour,
  dateIsoLocal,
  effectiveCampaignDay,
  effectiveCampaignHour,
  expandCampaignPlayOrder,
  formatDayTitle,
  formatMonthTitle,
  campaignMediaIds,
  getOverride,
  loadOverrides,
  loadPlayOrder,
  movePlayOrderKey,
  nextCampaignHourOverride,
  orderCampaigns,
  reconcilePlayOrder,
  saveOverrides,
  savePlayOrder,
  setOverrideAllMedia,
  campaignsForScreen,
  type CellKind,
  type DeviceScheduleOverrides,
} from '@/lib/device-schedule';
import { EditOrderModal } from '@/components/EditOrderModal';
import { DeviceOrderTimelineModal } from '@/components/DeviceOrderTimelineModal';
import { PocketBaseService } from '@/lib/pocketbase';
import { getTestOrder, subscribeTestOrders } from '@/lib/test-orders';
import { ensureTestOrderFromPlayer } from '@/lib/import-player-test-orders';
import type { Order } from '@/types';

const WEEKDAYS = ['Pr', 'An', 'Tr', 'Kt', 'Pn', 'Št', 'Sk'];

function campaignTitle(campaign: PlayerCampaign): string {
  const local = getTestOrder(campaign.id);
  return String(local?.client || campaign.client || campaign.id).trim() || campaign.id;
}

function cellFillClass(kind: CellKind, on: boolean): string {
  if (kind === 'forced') return 'bg-blue-500';
  if (kind === 'off-override') {
    return 'bg-[repeating-linear-gradient(-45deg,#fff,#fff_5px,#f3f4f6_5px,#f3f4f6_10px)] shadow-[inset_0_0_0_1px_#e5e7eb]';
  }
  if (on || kind === 'on') return 'bg-amber-300/55';
  return 'bg-transparent';
}

type ViewMode = 'month' | 'day';

export function DeviceSchedulingView({
  device,
  campaigns,
}: {
  device: PlayerDevice;
  campaigns: PlayerCampaign[];
}) {
  const [view, setView] = useState<ViewMode>('month');
  const [viewDate, setViewDate] = useState(() => new Date());
  const [dayIso, setDayIso] = useState(() => dateIsoLocal(new Date()));
  const [search, setSearch] = useState('');
  const [overrides, setOverrides] = useState<DeviceScheduleOverrides>({});
  const [playOrder, setPlayOrder] = useState<string[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const [dragKey, setDragKey] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [scheduleReady, setScheduleReady] = useState(false);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [orderNamesTick, setOrderNamesTick] = useState(0);
  const [openingOrderId, setOpeningOrderId] = useState<string | null>(null);
  const [timelineCampaign, setTimelineCampaign] =
    useState<PlayerCampaign | null>(null);
  const overridesRef = useRef(overrides);
  const playOrderRef = useRef(playOrder);
  overridesRef.current = overrides;
  playOrderRef.current = playOrder;

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2000);
  }, []);

  const pushSchedule = useCallback(
    async (nextOverrides: DeviceScheduleOverrides, nextOrder: string[]) => {
      saveOverrides(device.deviceCode, nextOverrides);
      savePlayOrder(device.deviceCode, nextOrder);
      const result = await saveDeviceSchedule(device.deviceCode, {
        overrides: nextOverrides,
        playOrder: nextOrder,
      });
      if (!result.ok) {
        showToast(result.error || 'Nepavyko išsaugoti į player API');
      }
    },
    [device.deviceCode, showToast]
  );

  useEffect(() => {
    let cancelled = false;
    setScheduleReady(false);
    (async () => {
      const localOv = loadOverrides(device.deviceCode);
      const localOrder = loadPlayOrder(device.deviceCode);
      const result = await fetchDeviceSchedule(device.deviceCode);
      if (cancelled) return;
      if (result.ok && result.schedule) {
        const apiEmpty =
          Object.keys(result.schedule.overrides).length === 0 &&
          result.schedule.playOrder.length === 0;
        const localHas = Object.keys(localOv).length > 0 || localOrder.length > 0;
        if (apiEmpty && localHas) {
          setOverrides(localOv);
          setPlayOrder(localOrder);
          await pushSchedule(localOv, localOrder);
        } else {
          setOverrides(result.schedule.overrides as DeviceScheduleOverrides);
          setPlayOrder(result.schedule.playOrder);
          saveOverrides(
            device.deviceCode,
            result.schedule.overrides as DeviceScheduleOverrides
          );
          savePlayOrder(device.deviceCode, result.schedule.playOrder);
        }
      } else {
        setOverrides(localOv);
        setPlayOrder(localOrder);
        if (result.error) showToast(`${result.error} — lokalus režimas`);
      }
      setScheduleReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [device.deviceCode, pushSchedule, showToast]);

  // Senas playOrder po republish nebedengia dabartinių ID — Scheduling rodo abėcėlę,
  // o grotuvas naudoja publishedAt. Sutapatinam ir įrašom tą pačią eilę į API.
  useEffect(() => {
    if (!scheduleReady) return;
    const screenCampaigns = campaignsForScreen(campaigns, device.screenName);
    if (!screenCampaigns.length) return;
    const next = reconcilePlayOrder(playOrderRef.current, screenCampaigns);
    if (next.join('\0') === playOrderRef.current.join('\0')) return;
    setPlayOrder(next);
    void pushSchedule(overridesRef.current, next);
  }, [scheduleReady, campaigns, device.screenName, pushSchedule]);

  const persistOv = useCallback(
    (updater: (prev: DeviceScheduleOverrides) => DeviceScheduleOverrides) => {
      setOverrides((prev) => {
        const next = updater(prev);
        void pushSchedule(next, playOrderRef.current);
        return next;
      });
    },
    [pushSchedule]
  );

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth() + 1;
  const daysInMonth = new Date(year, month, 0).getDate();
  const todayIso = dateIsoLocal(new Date());

  const days = useMemo(
    () => Array.from({ length: daysInMonth }, (_, i) => new Date(year, month - 1, i + 1)),
    [daysInMonth, year, month]
  );

  useEffect(() => subscribeTestOrders(() => setOrderNamesTick((n) => n + 1)), []);

  const monthCampaigns = useMemo(() => {
    const list = campaignsForScreenInMonth(campaigns, device.screenName, year, month);
    const q = search.trim().toLocaleLowerCase('lt-LT');
    const filtered = !q
      ? list
      : list.filter((c) =>
          campaignTitle(c).toLocaleLowerCase('lt-LT').includes(q)
        );
    return orderCampaigns(filtered, playOrder);
  }, [campaigns, device.screenName, year, month, search, playOrder, orderNamesTick]);

  const dayCampaigns = useMemo(() => {
    const list = campaignsForScreenOnDay(campaigns, device.screenName, dayIso);
    const q = search.trim().toLocaleLowerCase('lt-LT');
    const filtered = !q
      ? list
      : list.filter((c) =>
          campaignTitle(c).toLocaleLowerCase('lt-LT').includes(q)
        );
    return orderCampaigns(filtered, playOrder);
  }, [campaigns, device.screenName, dayIso, search, playOrder, orderNamesTick]);

  const openDay = (iso: string) => {
    setDayIso(iso);
    setView('day');
  };

  const toggleDayCell = (campaign: PlayerCampaign, dateIso: string) => {
    const inRange = campaignInDateRange(campaign, dateIso);
    persistOv((prev) => {
      const firstId = campaignMediaIds(campaign)[0];
      const cur = getOverride(prev, campaign.id, firstId, dateIso, 'day');
      let nextVal: 'on' | 'off' | null = null;
      let msg = '';
      if (cur == null) {
        nextVal = inRange ? 'off' : 'on';
        msg = inRange
          ? `${dateIso} išjungta (forceOff)`
          : `${dateIso} įjungta papildomai (forceOn)`;
      } else {
        nextVal = null;
        msg = `${dateIso} grąžinta į planą`;
      }
      showToast(msg);
      return setOverrideAllMedia(prev, campaign, dateIso, 'day', nextVal);
    });
  };

  const toggleHourCell = (campaign: PlayerCampaign, hour: number) => {
    persistOv((prev) => {
      const { value, message } = nextCampaignHourOverride(
        campaign,
        dayIso,
        hour,
        prev
      );
      showToast(message);
      return setOverrideAllMedia(prev, campaign, dayIso, hour, value);
    });
  };

  const overIdRef = useRef<string | null>(null);
  const dragIdRef = useRef<string | null>(null);

  const finishReorder = useCallback(
    (fromId: string, toId: string) => {
      if (!fromId || !toId || fromId === toId) return;
      const list = view === 'month' ? monthCampaigns : dayCampaigns;
      const keys = list.map((c) => c.id);
      const nextKeys = movePlayOrderKey(keys, fromId, toId);
      if (nextKeys.join('\0') === keys.join('\0')) return;
      const ordered = nextKeys
        .map((id) => list.find((c) => c.id === id))
        .filter(Boolean) as PlayerCampaign[];
      const merged = expandCampaignPlayOrder(ordered, playOrderRef.current);
      const cleaned = reconcilePlayOrder(
        merged,
        campaignsForScreen(campaigns, device.screenName)
      );
      setPlayOrder(cleaned);
      void pushSchedule(overridesRef.current, cleaned);
      showToast('Playlist tvarka atnaujinta');
    },
    [view, monthCampaigns, dayCampaigns, campaigns, device.screenName, pushSchedule, showToast]
  );

  const endPointerDrag = useCallback(() => {
    const from = dragIdRef.current;
    const to = overIdRef.current;
    dragIdRef.current = null;
    overIdRef.current = null;
    setDragKey(null);
    setOverId(null);
    if (from && to) finishReorder(from, to);
  }, [finishReorder]);

  const startPointerDrag = (campaignId: string, e: React.PointerEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    dragIdRef.current = campaignId;
    overIdRef.current = campaignId;
    setDragKey(campaignId);
    setOverId(campaignId);

    const onMove = (ev: PointerEvent) => {
      const el = document.elementFromPoint(ev.clientX, ev.clientY);
      const row = el?.closest('[data-campaign-id]') as HTMLElement | null;
      const id = row?.getAttribute('data-campaign-id');
      if (id && id !== overIdRef.current) {
        overIdRef.current = id;
        setOverId(id);
      }
    };
    const onUp = () => {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      document.removeEventListener('pointercancel', onUp);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
      endPointerDrag();
    };
    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
    document.addEventListener('pointercancel', onUp);
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'grabbing';
  };

  const openCampaignOrder = async (campaignId: string) => {
    if (dragIdRef.current || openingOrderId) return;
    setOpeningOrderId(campaignId);
    try {
      const test = getTestOrder(campaignId) || (await ensureTestOrderFromPlayer(campaignId));
      if (test) {
        setEditingOrder(test);
        return;
      }
      if (String(campaignId).startsWith('test-')) {
        showToast('Test orderis nerastas šiame naršyklėje ir player API');
        return;
      }
      const order = await PocketBaseService.getOrder(campaignId);
      setEditingOrder(order);
    } catch {
      showToast('Orderis nerastas PocketBase');
    } finally {
      setOpeningOrderId(null);
    }
  };

  const monthCols = `14rem repeat(${daysInMonth}, minmax(1.75rem, 1fr))`;
  const dayCols = `14rem repeat(${SCHEDULE_HOURS.length}, max(1.75rem, calc((100% - 14rem) / ${daysInMonth})))`;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Ieškoti kampanijos…"
          className="h-9 min-w-[220px] rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
        />
        <div className="inline-flex rounded-lg bg-gray-100 p-0.5 dark:bg-gray-700">
          <button
            type="button"
            onClick={() => setView('month')}
            className={`rounded-md px-3.5 py-1.5 text-[13px] font-medium ${
              view === 'month'
                ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900'
                : 'text-gray-600 dark:text-gray-300'
            }`}
          >
            Mėnuo
          </button>
          <button
            type="button"
            onClick={() => setView('day')}
            className={`rounded-md px-3.5 py-1.5 text-[13px] font-medium ${
              view === 'day'
                ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900'
                : 'text-gray-600 dark:text-gray-300'
            }`}
          >
            Diena
          </button>
        </div>
      </div>

      {view === 'month' ? (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 px-4 py-3 dark:border-gray-700">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setViewDate((d) => subMonths(d, 1))}
                className="rounded-lg p-2 text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
                aria-label="Ankstesnis mėnuo"
              >
                <ChevronLeftIcon className="h-5 w-5" />
              </button>
              <h2 className="min-w-[6rem] text-center text-sm font-semibold capitalize text-gray-900 dark:text-white">
                {formatMonthTitle(viewDate)}
              </h2>
              <button
                type="button"
                onClick={() => setViewDate((d) => addMonths(d, 1))}
                className="rounded-lg p-2 text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
                aria-label="Kitas mėnuo"
              >
                <ChevronRightIcon className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={() => openDay(todayIso)}
                className="ml-1 text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400"
              >
                Šiandien
              </button>
            </div>
            <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-3 w-3 rounded bg-amber-300/55" /> Pagal planą
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-3 w-3 rounded bg-blue-500" /> forceOn
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-3 w-3 rounded border border-dashed border-gray-400 bg-white" />{' '}
                forceOff
              </span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <div className="min-w-[48rem]">
              <div
                className="sticky top-0 z-[5] grid border-b border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-900/50"
                style={{ gridTemplateColumns: monthCols }}
              >
                <div className="sticky left-0 z-[6] border-r border-gray-200 bg-gray-50 px-3 py-2 text-xs font-medium uppercase tracking-wide text-gray-500 dark:border-gray-700 dark:bg-gray-900/50">
                  Kampanija
                </div>
                {days.map((d, i) => {
                  const iso = dateIsoLocal(d);
                  const isToday = iso === todayIso;
                  const weekend = d.getDay() === 0 || d.getDay() === 6;
                  const week = getISOWeek(d);
                  const showWeek = i === 0 || getISOWeek(days[i - 1]) !== week;
                  return (
                    <button
                      key={iso}
                      type="button"
                      onClick={() => openDay(iso)}
                      className={`border-r border-gray-100 py-1 text-center text-[10px] leading-tight dark:border-gray-700/80 ${
                        weekend && !isToday ? 'text-gray-400' : 'text-gray-600'
                      } ${isToday ? 'bg-gray-100/80 dark:bg-gray-800/55' : ''}`}
                      title="Atidaryti valandas"
                    >
                      <div
                        className={`mb-0.5 text-[9px] font-semibold ${
                          showWeek ? 'text-gray-500' : 'select-none text-transparent'
                        }`}
                      >
                        W{week}
                      </div>
                      {isToday ? (
                        <div className="mx-auto flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white shadow-sm">
                          {d.getDate()}
                        </div>
                      ) : (
                        <div>{d.getDate()}</div>
                      )}
                      <div>{WEEKDAYS[(d.getDay() + 6) % 7]}</div>
                    </button>
                  );
                })}
              </div>

              {monthCampaigns.length === 0 ? (
                <div className="p-12 text-center text-sm text-gray-500">
                  Šį mėnesį šiame device nėra kampanijų.
                </div>
              ) : (
                monthCampaigns.map((campaign) => (
                  <div
                    key={campaign.id}
                    data-campaign-id={campaign.id}
                    className={`grid border-b border-gray-100 hover:bg-gray-50 dark:border-gray-700/80 dark:hover:bg-gray-700/40 ${
                      dragKey === campaign.id ? 'opacity-45' : ''
                    } ${
                      overId === campaign.id && dragKey && overId !== dragKey
                        ? 'shadow-[inset_0_2px_0_0_#2563eb]'
                        : ''
                    }`}
                    style={{ gridTemplateColumns: monthCols }}
                  >
                    <div className="sticky left-0 z-[6] border-r border-gray-200 bg-white px-3 py-2 dark:border-gray-700 dark:bg-gray-800">
                      <div className="flex items-start gap-1.5">
                        <button
                          type="button"
                          title="Tempk — playlist tvarka"
                          aria-label="Keisti tvarką"
                          onPointerDown={(e) => startPointerDrag(campaign.id, e)}
                          className="mt-0.5 cursor-grab touch-none select-none rounded px-0.5 text-[11px] tracking-tighter text-gray-400 hover:bg-gray-100 hover:text-gray-600 active:cursor-grabbing"
                        >
                          ⠿
                        </button>
                        <div className="min-w-0">
                          <button
                            type="button"
                            title="Atidaryti orderį"
                            disabled={openingOrderId === campaign.id}
                            onClick={(e) => {
                              e.currentTarget.blur();
                              void openCampaignOrder(campaign.id);
                            }}
                            className="block w-full truncate text-left text-sm font-medium text-gray-900 outline-none hover:text-blue-600 focus:outline-none disabled:opacity-60 dark:text-white dark:hover:text-blue-400"
                          >
                            {openingOrderId === campaign.id
                              ? 'Kraunama…'
                              : campaignTitle(campaign)}
                          </button>
                          <div className="flex items-center gap-2 truncate text-xs text-gray-500">
                            <span>
                              {(campaign.media || []).length}{' '}
                              {(campaign.media || []).length === 1
                                ? 'klipas'
                                : 'klipai'}
                            </span>
                            <button
                              type="button"
                              title="Iškloinė — kada įkelta / publikuota / pirmas play"
                              onClick={() => setTimelineCampaign(campaign)}
                              className="shrink-0 font-medium text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                            >
                              Iškloinė
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                    {days.map((d) => {
                      const iso = dateIsoLocal(d);
                      const isToday = iso === todayIso;
                      const weekend = d.getDay() === 0 || d.getDay() === 6;
                      const eff = effectiveCampaignDay(campaign, iso, overrides);
                      return (
                        <div
                          key={iso}
                          className={`min-h-[2.75rem] border-r border-gray-50 dark:border-gray-700/50 ${
                            isToday ? 'bg-gray-100/80 dark:bg-gray-800/55' : ''
                          } ${weekend && !eff.on ? 'bg-gray-50/35' : ''}`}
                        >
                          <button
                            type="button"
                            title={`${iso} · ${eff.kind}`}
                            onClick={() => toggleDayCell(campaign, iso)}
                            className={`block h-full min-h-[2.75rem] w-full ${cellFillClass(eff.kind, eff.on)}`}
                          />
                        </div>
                      );
                    })}
                  </div>
                ))
              )}

              {monthCampaigns.length > 0 && (
                <div
                  className="grid border-t border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-900/50"
                  style={{ gridTemplateColumns: monthCols }}
                >
                  <div className="sticky left-0 z-[6] border-r border-gray-200 bg-gray-50 px-3 py-2 text-xs font-medium text-gray-500 dark:border-gray-700 dark:bg-gray-900/50">
                    Viso
                  </div>
                  {days.map((d) => {
                    const iso = dateIsoLocal(d);
                    let total = 0;
                    for (const campaign of monthCampaigns) {
                      if (effectiveCampaignDay(campaign, iso, overrides).on) total += 1;
                    }
                    return (
                      <div
                        key={iso}
                        className={`border-r border-gray-100 py-2 text-center text-xs font-semibold ${
                          total <= 0 ? 'font-medium text-gray-300' : 'text-gray-700'
                        }`}
                      >
                        {total || '—'}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 px-4 py-3 dark:border-gray-700">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  setDayIso(dateIsoLocal(subDays(new Date(dayIso + 'T12:00:00'), 1)))
                }
                className="rounded-lg p-2 text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
                aria-label="Ankstesnė diena"
              >
                <ChevronLeftIcon className="h-5 w-5" />
              </button>
              <h2 className="min-w-[8rem] text-center text-sm font-semibold capitalize text-gray-900 dark:text-white">
                {formatDayTitle(dayIso)}
              </h2>
              <button
                type="button"
                onClick={() =>
                  setDayIso(dateIsoLocal(addDays(new Date(dayIso + 'T12:00:00'), 1)))
                }
                className="rounded-lg p-2 text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
                aria-label="Kita diena"
              >
                <ChevronRightIcon className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={() => setDayIso(todayIso)}
                className="ml-1 text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400"
              >
                Šiandien
              </button>
            </div>
            <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-3 w-3 rounded bg-amber-300/55" /> Pagal planą
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-3 w-3 rounded bg-blue-500" /> forceOn
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-3 w-3 rounded border border-dashed border-gray-400 bg-white" />{' '}
                forceOff
              </span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <div className="w-full min-w-[48rem]">
              <div
                className="sticky top-0 z-[5] grid w-full border-b border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-900/50"
                style={{ gridTemplateColumns: dayCols }}
              >
                <div className="sticky left-0 z-[6] border-r border-gray-200 bg-gray-50 px-3 py-2 text-xs font-medium uppercase tracking-wide text-gray-500 dark:border-gray-700 dark:bg-gray-900/50">
                  Kampanija
                </div>
                {SCHEDULE_HOURS.map((h) => (
                  <div
                    key={h}
                    className="border-r border-gray-100 py-2 text-center text-xs font-semibold text-gray-900 dark:border-gray-700 dark:text-white"
                  >
                    {h}
                  </div>
                ))}
              </div>

              {dayCampaigns.length === 0 ? (
                <div className="p-12 text-center text-sm text-gray-500">
                  Šią dieną nėra kampanijų.
                </div>
              ) : (
                dayCampaigns.map((campaign) => (
                  <div
                    key={campaign.id}
                    data-campaign-id={campaign.id}
                    className={`grid w-full border-b border-gray-100 hover:bg-gray-50 dark:border-gray-700/80 dark:hover:bg-gray-700/40 ${
                      dragKey === campaign.id ? 'opacity-45' : ''
                    } ${
                      overId === campaign.id && dragKey && overId !== dragKey
                        ? 'shadow-[inset_0_2px_0_0_#2563eb]'
                        : ''
                    }`}
                    style={{ gridTemplateColumns: dayCols }}
                  >
                    <div className="sticky left-0 z-[6] border-r border-gray-200 bg-white px-3 py-2 dark:border-gray-700 dark:bg-gray-800">
                      <div className="flex items-start gap-1.5">
                        <button
                          type="button"
                          title="Tempk — playlist tvarka"
                          aria-label="Keisti tvarką"
                          onPointerDown={(e) => startPointerDrag(campaign.id, e)}
                          className="mt-0.5 cursor-grab touch-none select-none rounded px-0.5 text-[11px] tracking-tighter text-gray-400 hover:bg-gray-100 hover:text-gray-600 active:cursor-grabbing"
                        >
                          ⠿
                        </button>
                        <div className="min-w-0">
                          <button
                            type="button"
                            title="Atidaryti orderį"
                            disabled={openingOrderId === campaign.id}
                            onClick={(e) => {
                              e.currentTarget.blur();
                              void openCampaignOrder(campaign.id);
                            }}
                            className="block w-full truncate text-left text-sm font-medium text-gray-900 outline-none hover:text-blue-600 focus:outline-none disabled:opacity-60 dark:text-white dark:hover:text-blue-400"
                          >
                            {openingOrderId === campaign.id
                              ? 'Kraunama…'
                              : campaignTitle(campaign)}
                          </button>
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-gray-500">
                            <span className="truncate">
                              {(campaign.media || []).length}{' '}
                              {(campaign.media || []).length === 1
                                ? 'klipas'
                                : 'klipai'}
                              {' · '}
                              {campaign.published === false
                                ? 'Nepublikuota'
                                : 'Live'}
                            </span>
                            <button
                              type="button"
                              title="Iškloinė — kada įkelta / publikuota / pirmas play"
                              onClick={() => setTimelineCampaign(campaign)}
                              className="shrink-0 font-medium text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                            >
                              Iškloinė
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                    {SCHEDULE_HOURS.map((hour) => {
                      const eff = effectiveCampaignHour(
                        campaign,
                        dayIso,
                        hour,
                        overrides
                      );
                      return (
                        <div
                          key={hour}
                          className="min-h-[2.75rem] border-r border-gray-50 dark:border-gray-700/50"
                        >
                          <button
                            type="button"
                            title={`${hour}:00 · ${eff.kind}`}
                            onClick={() => toggleHourCell(campaign, hour)}
                            className={`block h-full min-h-[2.75rem] w-full ${cellFillClass(eff.kind, eff.on)}`}
                          />
                        </div>
                      );
                    })}
                  </div>
                ))
              )}

              {dayCampaigns.length > 0 && (
                <div
                  className="grid w-full border-t border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-900/50"
                  style={{ gridTemplateColumns: dayCols }}
                >
                  <div className="sticky left-0 z-[6] border-r border-gray-200 bg-gray-50 px-3 py-2 text-xs font-medium text-gray-500 dark:border-gray-700 dark:bg-gray-900/50">
                    Užimtumas · kampanijos
                  </div>
                  {SCHEDULE_HOURS.map((hour) => {
                    const n = campaignsOnHour(dayCampaigns, dayIso, hour, overrides);
                    return (
                      <div
                        key={hour}
                        className={`border-r border-gray-100 py-2 text-center text-xs font-semibold ${
                          n === 0 ? 'font-medium text-gray-300' : 'text-gray-700'
                        }`}
                        title={`${hour}:00 — ${n} kampanijos`}
                      >
                        {n || '—'}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
          <div className="border-t border-gray-200 px-4 py-2 text-xs text-gray-500 dark:border-gray-700">
            {dayCampaigns.length} kampanijos · apačioje užimtumas (kiek kampanijų tą
            valandą) · tempk eilutes = playlist tvarka
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-5 right-5 z-50 max-w-xs rounded-lg bg-gray-900 px-3.5 py-2.5 text-xs text-white shadow-lg">
          {toast}
        </div>
      )}

      <EditOrderModal
        order={editingOrder}
        isOpen={!!editingOrder}
        onClose={() => {
          setEditingOrder(null);
          if (document.activeElement instanceof HTMLElement) {
            document.activeElement.blur();
          }
        }}
        onOrderUpdated={(updated) => {
          setEditingOrder(updated);
          setOrderNamesTick((n) => n + 1);
        }}
      />

      {timelineCampaign ? (
        <DeviceOrderTimelineModal
          isOpen
          device={device}
          campaign={timelineCampaign}
          onClose={() => setTimelineCampaign(null)}
        />
      ) : null}
    </div>
  );
}
