'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  XMarkIcon,
  ClipboardDocumentIcon,
  TableCellsIcon,
  ArrowDownTrayIcon,
  CheckCircleIcon,
  DocumentTextIcon,
  PaperAirplaneIcon,
  PlusCircleIcon,
  ArrowsRightLeftIcon,
  BanknotesIcon,
  CalendarDaysIcon,
  ChartBarIcon,
  FilmIcon,
} from '@heroicons/react/24/outline';
import {
  downloadReklamosPlanas,
  downloadReklamosPlanasCombined,
} from '@/lib/export-reklamos-planas';
import { OrderAtaskaitaModal } from '@/components/OrderAtaskaitaModal';
import {
  toCampaignOrderInput,
  toCampaignScreen,
} from '@/lib/reklamos-planas-data';
import Image from 'next/image';
import { Order, Comment, Reminder, FileAttachment } from '@/types';
import { usePlaySandboxEnabled } from '@/hooks/usePlaySandboxEnabled';
import { PocketBaseService } from '@/lib/pocketbase';
import { SupabaseService } from '@/lib/supabase-service';
import { formatDateInputValue, parseDateOnlyLocal } from '@/lib/date-utils';
import { isMultiMonthOrder } from '@/lib/invoice-utils';
import { validateBillingPeriods } from '@/lib/order-billing-periods';
import { resolveOrderPrice } from '@/lib/order-price';
import { OrderBillingPeriodsSection } from '@/components/OrderBillingPeriodsSection';
import { OrderBillingPeriodsReadOnly } from '@/components/OrderBillingPeriodsReadOnly';
import { OrderSpecPriceSection } from '@/components/OrderSpecPriceSection';
import type { OrderBillingPeriod } from '@/types';
import {
  invoiceToggleRequiresBillingMonth,
  nextInvoiceStatusOnToggle,
  readInvoiceStatusField,
  resolveBillingContext,
  type BillingMonthContext,
} from '@/lib/invoice-month-status';
import { resolveListMonthYear } from '@/lib/orders-filters';
import {
  computeCityOtsBreakdown,
  formatOts,
  loadCampaignExportData,
  type CityOtsRow,
} from '@/lib/agency-orders';
import {
  modalBtnDanger,
  modalBtnInline,
  modalBtnPrimary,
  modalBtnSecondary,
} from '@/lib/portal-ui';
import { StatusIconButton } from '@/components/StatusIconButton';
import { OrderClipsPanel } from '@/components/OrderClipsPanel';
import { useOrderScreenAlerts } from '@/hooks/useOrderScreenAlerts';
import {
  deleteTestOrder,
  getTestOrder,
  hydrateTestOrderFromPlayCampaign,
  isTestOrder,
  upsertTestOrder,
  type TestOrder,
} from '@/lib/test-orders';
import { getOrderLiveState, reconcileOrderLiveState, publishOrderLive, unpublishOrderLive, orderLiveContentKey, orderLiveNeedsUpdate, buildOrderLiveSnapshot, describeLiveUpdateNotice, snapshotFromLiveState, clipIdsFromLiveStamp, type LiveClipFact, type LiveClipRemoval, type OrderLiveState } from '@/lib/order-live';
import { LivePublishStatus } from '@/components/LivePublishStatus';
import { fetchMonitoring } from '@/lib/player-devices';
import { orderLiveSeenOnPlayer } from '@/lib/screen-clip-alert';
import { unpublishOrderFromPlayer } from '@/lib/player-bridge';
import { setPlayPublicPlanLock } from '@/lib/play-public-plan-lock';
import { resolvePlanChangedAt } from '@/lib/plan-changed-at';

interface EditOrderModalProps {
  order: Order | null;
  isOpen: boolean;
  onClose: () => void;
  onOrderUpdated?: (order: Order) => void;
  onGenerateInvoice?: (order: Order) => void;
  variant?: 'internal' | 'agency';
  billingMonth?: string;
  billingYear?: string;
}

function calculatorEditHref(orderId: string, isLocalTest: boolean, playSandbox: boolean): string {
  if (playSandbox && !isLocalTest) {
    return `/skaiciuokle/index.html?liveOrderId=${encodeURIComponent(orderId)}#calculator`;
  }
  if (isLocalTest) {
    return `/skaiciuokle/index.html?testOrderId=${encodeURIComponent(orderId)}&from=hub#calculator`;
  }
  return `/calculator/${encodeURIComponent(orderId)}`;
}

type OrderExportPartner = {
  id: string;
  name: string;
  slug: string;
  screenCount: number;
};

function LiveStatusBadge({
  alerts,
  className,
}: {
  alerts: { name: string; alert: { label: string; title: string } }[];
  className: string;
}) {
  const hasAlert = alerts.length > 0;
  const title = hasAlert
    ? alerts.map((item) => `${item.name}: ${item.alert.label}`).join('\n')
    : 'Transliacija aktyvi Piksel ekranuose';
  return (
    <span className={className} title={title}>
      {hasAlert ? (
        <span className="animate-pulse" aria-hidden>
          ⚠️
        </span>
      ) : (
        <span className="h-1.5 w-1.5 rounded-full bg-white" aria-hidden />
      )}
      Live
    </span>
  );
}

export function EditOrderModal({
  order,
  isOpen,
  onClose,
  onOrderUpdated,
  onGenerateInvoice,
  variant = 'internal',
  billingMonth = '',
  billingYear = '',
}: EditOrderModalProps) {
  const isAgency = variant === 'agency';
  const isLocalTest = isTestOrder(order);
  const playSandbox = usePlaySandboxEnabled();
  const exportScreenIdsKey = [...new Set(order?.screens?.filter(Boolean) || [])].join(',');
  const billingContext = useMemo(
    (): BillingMonthContext | null => resolveBillingContext(billingMonth, billingYear),
    [billingMonth, billingYear]
  );
  const multiMonthOrder = useMemo(
    () => (order ? isMultiMonthOrder(order) : false),
    [order]
  );
  const collaborationScope = isAgency ? 'agency' : 'internal';
  const readOnlyFieldClass = isAgency
    ? 'read-only:opacity-100 read-only:cursor-default disabled:opacity-100'
    : '';
  const [formData, setFormData] = useState<Partial<Order>>({});
  const [invoiceStatus, setInvoiceStatus] = useState({ invoice_issued: false, invoice_sent: false });
  const [comments, setComments] = useState<Comment[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [printScreens, setPrintScreens] = useState<FileAttachment[]>([]);
  const [loading, setLoading] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingCommentText, setEditingCommentText] = useState('');
  const [reminderDate, setReminderDate] = useState('');
  const [reminderMessage, setReminderMessage] = useState('');
  const [pendingPrintscreens, setPendingPrintscreens] = useState<FileAttachment[]>([]);
  const [quote, setQuote] = useState<{ link: string; viaduct_link: string } | null>(null);
  const [attachmentUploading, setAttachmentUploading] = useState(false);
  const [modalSection, setModalSection] = useState<'details' | 'clips'>('details');
  const [liveState, setLiveState] = useState<OrderLiveState>({ status: 'idle' });
  const [liveOpenNotice, setLiveOpenNotice] = useState('');
  const liveScreenAlerts = useOrderScreenAlerts(
    isOpen ? order : null,
    liveState.status === 'live',
    liveState.screenNames
  );
  const [exportPartners, setExportPartners] = useState<OrderExportPartner[]>([]);
  const [exportPartnersLoading, setExportPartnersLoading] = useState(false);
  const [exportingPartnerId, setExportingPartnerId] = useState<string | null>(null);
  const [exportingCombined, setExportingCombined] = useState(false);
  const [sendingPartnerPlans, setSendingPartnerPlans] = useState(false);
  const [clipsUrl, setClipsUrl] = useState('');
  const [deliveryNote, setDeliveryNote] = useState('');
  const [partnerDeliveryById, setPartnerDeliveryById] = useState<
    Record<string, { plan?: { sent: boolean; confirmed: boolean }; clips?: { sent: boolean; confirmed: boolean } }>
  >({});
  const [exportError, setExportError] = useState<string | null>(null);
  const [ataskaitaOpen, setAtaskaitaOpen] = useState(false);
  const [cityOtsRows, setCityOtsRows] = useState<CityOtsRow[]>([]);
  const [otsLoading, setOtsLoading] = useState(false);
  const [customBillingPeriodsEnabled, setCustomBillingPeriodsEnabled] = useState(false);
  const [billingPeriods, setBillingPeriods] = useState<OrderBillingPeriod[]>([]);
  const [billingPeriodsPanelOpen, setBillingPeriodsPanelOpen] = useState(false);
  const [isSpecOrder, setIsSpecOrder] = useState(false);
  const [specOrderPanelOpen, setSpecOrderPanelOpen] = useState(false);
  const attachmentInputRef = useRef<HTMLInputElement>(null);
  const openedOrderIdRef = useRef<string | null>(null);
  const liveContentKeyRef = useRef<string | null>(null);
  const skipLiveDirtyRef = useRef(false);
  const [liveDirty, setLiveDirty] = useState(false);
  const [liveUpdating, setLiveUpdating] = useState(false);
  const [liveClipStamp, setLiveClipStamp] = useState('');
  const [liveClipFacts, setLiveClipFacts] = useState<LiveClipFact[]>([]);
  const [liveRemovals, setLiveRemovals] = useState<LiveClipRemoval[]>([]);
  const [liveReceipt, setLiveReceipt] = useState<{ server: boolean; player: boolean } | null>(
    null
  );
  const [approvalBusy, setApprovalBusy] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const deleteConfirmRef = useRef<HTMLDivElement>(null);

  const scheduleOrder = useMemo((): Order | null => {
    if (!order) return null;
    return {
      ...order,
      from: formData.from ?? order.from,
      to: formData.to ?? order.to,
      final_price: formData.final_price ?? order.final_price,
    };
  }, [order, formData.from, formData.to, formData.final_price]);

  const liveViewOrder = useMemo(() => {
    if (!order) return null;
    return {
      ...order,
      client: String(formData.client ?? order.client),
      from: String(formData.from ?? order.from),
      to: String(formData.to ?? order.to),
      intensity: String(formData.intensity ?? order.intensity ?? ''),
    };
  }, [order, formData.client, formData.from, formData.to, formData.intensity]);

  const liveContentKey = useMemo(() => {
    if (!liveViewOrder) return '';
    return orderLiveContentKey(liveViewOrder);
  }, [liveViewOrder]);

  const liveChangeLines = useMemo(() => {
    if (!isOpen || !order || !liveViewOrder || liveState.status !== 'live') return [];
    const published = snapshotFromLiveState(liveState, order);
    const current = buildOrderLiveSnapshot(liveViewOrder, liveClipStamp);
    const publishedIntensity =
      published?.intensity ||
      (!liveState.publishedSnapshot && !liveState.publishedContentKey
        ? String(order.intensity || order.details?.plan?.intensity || '')
        : '');
    return describeLiveUpdateNotice(published, current, {
      publishedClipCount: liveState.clipCount,
      publishedAt: liveState.publishedAt,
      intensityPublished: publishedIntensity,
      intensityCurrent: String(
        liveViewOrder.intensity || order.details?.plan?.intensity || ''
      ),
      planChangedAt: order.details?.planChangedAt,
      clips: liveClipFacts,
      removals: liveRemovals,
    });
  }, [isOpen, order, liveViewOrder, liveState, liveClipStamp, liveClipFacts, liveRemovals]);

  useEffect(() => {
    if (!isOpen || liveState.status !== 'live') {
      liveContentKeyRef.current = null;
      skipLiveDirtyRef.current = false;
      setLiveDirty(false);
      if (!isOpen) setLiveReceipt(null);
      return;
    }
    if (skipLiveDirtyRef.current) {
      liveContentKeyRef.current = liveContentKey;
      skipLiveDirtyRef.current = false;
      setLiveDirty(false);
      return;
    }
    if (liveContentKeyRef.current == null) {
      const published = String(liveState.publishedContentKey || '');
      liveContentKeyRef.current = published || liveContentKey;
      if (published ? published !== liveContentKey : order ? orderLiveNeedsUpdate(order) : false) {
        setLiveDirty(true);
      }
      return;
    }
    if (liveContentKey !== liveContentKeyRef.current) {
      setLiveDirty(true);
    }
  }, [isOpen, liveState.status, liveState.publishedContentKey, liveContentKey, order]);

  useEffect(() => {
    if (liveDirty) setLiveReceipt(null);
  }, [liveDirty]);

  useEffect(() => {
    if (!liveReceipt?.server || liveDirty) return;
    const ms = liveReceipt.player ? 4000 : 8000;
    const timer = window.setTimeout(() => setLiveReceipt(null), ms);
    return () => window.clearTimeout(timer);
  }, [liveReceipt, liveDirty]);

  useEffect(() => {
    if (!isOpen || !order || !liveReceipt?.server || liveReceipt.player) return;
    let cancelled = false;
    const tick = async () => {
      const monitoring = await fetchMonitoring();
      if (cancelled) return;
      if (
        orderLiveSeenOnPlayer(
          monitoring.ok ? monitoring.data?.screens : null,
          order.id,
          liveState.screenNames,
          clipIdsFromLiveStamp(liveState.publishedSnapshot?.clipStamp)
        )
      ) {
        setLiveReceipt({ server: true, player: true });
      }
    };
    void tick();
    const timer = window.setInterval(() => void tick(), 4000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [isOpen, order, liveReceipt, liveState.screenNames, liveState.publishedSnapshot?.clipStamp]);

  useEffect(() => {
    if (!isOpen) return;
    [
      '/skaiciuokle/styles.css?v=20260921-softg',
      '/skaiciuokle/plan-paint.js?v=20260921-1',
      '/skaiciuokle/app.js?v=20260925-planat',
      '/skaiciuokle/screen-catalog.js?v=20260721-photos',
    ].forEach((href) => {
      if (document.querySelector(`link[rel="prefetch"][href="${href}"]`)) return;
      const link = document.createElement('link');
      link.rel = 'prefetch';
      link.href = href;
      document.head.appendChild(link);
    });
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !order) {
      openedOrderIdRef.current = null;
      setLiveOpenNotice('');
      return;
    }

    const orderId = order.id;
    openedOrderIdRef.current = orderId;

    let cancelled = false;

    const loadOrderForm = async () => {
      const specPrice = await SupabaseService.getOrderSpecPrice(orderId);
      if (cancelled) return;

      let latest = order;
      if (isTestOrder(order)) {
        latest = (await hydrateTestOrderFromPlayCampaign(orderId)) || getTestOrder(orderId) || order;
      } else if (playSandbox) {
        try {
          latest = await PocketBaseService.getOrder(orderId);
        } catch {
          latest = order;
        }
      }
      if (cancelled) return;
      if (latest !== order) onOrderUpdated?.(latest);
      const hasSpecPrice = specPrice != null && specPrice > 0;
      setIsSpecOrder(hasSpecPrice);
      setSpecOrderPanelOpen(hasSpecPrice);

      setFormData({
        client: latest.client,
        agency: latest.agency,
        invoice_id: latest.invoice_id,
        from: latest.from,
        to: latest.to,
        final_price: hasSpecPrice ? specPrice : resolveOrderPrice(latest) || 0,
        approved: latest.approved,
        media_received: latest.media_received,
        viaduct: latest.viaduct,
      });
      setModalSection('details');
      setLiveState({ status: 'idle' });
      setLiveOpenNotice('');
      let reconciled = getOrderLiveState(latest);
      try {
        const result = await reconcileOrderLiveState(latest);
        reconciled = result.state;
        if (!cancelled && result.notice) setLiveOpenNotice(result.notice);
      } catch {
        if (!cancelled) {
          setLiveOpenNotice('Live būsena nekeista. Užsakymą galima redaguoti.');
        }
      }
      if (cancelled) return;
      setLiveState(reconciled);
      if (
        reconciled.status === 'idle' &&
        latest.details?.live?.status === 'live' &&
        isTestOrder(latest)
      ) {
        const updated = getTestOrder(orderId);
        if (updated) onOrderUpdated?.(updated);
      }
    };

    void loadOrderForm();
    void (async () => {
      try {
        const quoteData =
          (await PocketBaseService.getQuoteByOrderId(orderId)) ??
          (await PocketBaseService.getQuoteByOrderId(order.invoice_id));
        if (!cancelled) setQuote(quoteData);
      } catch {
        if (!cancelled) setQuote(null);
      }
    })();
    void SupabaseService.getOrderBillingPeriod(orderId).then((entries) => {
      if (cancelled) return;
      setBillingPeriods(entries);
      const hasCustomPeriods = entries.length > 0;
      setCustomBillingPeriodsEnabled(hasCustomPeriods);
      setBillingPeriodsPanelOpen(hasCustomPeriods);
    });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- tik naujam orderio ID, ne kiekvienam plano patch'ui
  }, [isOpen, order?.id]);

  useEffect(() => {
    if (!isOpen || !order) return;
    if (openedOrderIdRef.current !== order.id) return;

    setFormData((prev) => {
      const nextPrice = isSpecOrder ? prev.final_price : resolveOrderPrice(order) || 0;
      if (
        prev.client === order.client &&
        prev.agency === order.agency &&
        prev.invoice_id === order.invoice_id &&
        prev.from === order.from &&
        prev.to === order.to &&
        prev.approved === order.approved &&
        prev.media_received === order.media_received &&
        prev.viaduct === order.viaduct &&
        prev.final_price === nextPrice
      ) {
        return prev;
      }
      return {
        ...prev,
        client: order.client,
        agency: order.agency,
        invoice_id: order.invoice_id,
        from: order.from,
        to: order.to,
        approved: order.approved,
        media_received: order.media_received,
        viaduct: order.viaduct,
        final_price: nextPrice,
      };
    });
  }, [isOpen, order, isSpecOrder]);

  useEffect(() => {
    if (!order || !isOpen || isAgency || isSpecOrder || isTestOrder(order)) return;

    let cancelled = false;
    void PocketBaseService.syncOrderPriceIfNeeded(order).then((synced) => {
      if (cancelled) return;
      if (Math.abs(synced.final_price - (order.final_price || 0)) >= 0.01) {
        setFormData((prev) => ({ ...prev, final_price: synced.final_price }));
        onOrderUpdated?.(synced);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [order, isOpen, isAgency, isSpecOrder, onOrderUpdated]);

  useEffect(() => {
    if (!isOpen || !order || isAgency) {
      setExportPartners([]);
      return;
    }

    let cancelled = false;

    const loadExportPartners = async () => {
      const hadPartners = exportPartners.length > 0;
      if (!hadPartners) setExportPartnersLoading(true);
      try {
        let screenIds = [...new Set(order.screens?.filter(Boolean) || [])];
        if (screenIds.length === 0 && !isLocalTest) {
          const fullOrder = await PocketBaseService.getOrder(order.id);
          screenIds = [...new Set(fullOrder.screens?.filter(Boolean) || [])];
        }

        if (screenIds.length === 0) {
          if (!cancelled) setExportPartners([]);
          return;
        }

        const [screensMap, partners] = await Promise.all([
          PocketBaseService.getScreensWithPartner(screenIds),
          PocketBaseService.getPartners(),
        ]);
        const partnerById = new Map(partners.map((p) => [p.id, p]));
        const screenCountByPartner = new Map<string, number>();

        for (const screenId of screenIds) {
          const partnerId = screensMap[screenId]?.partner;
          if (!partnerId) continue;
          screenCountByPartner.set(partnerId, (screenCountByPartner.get(partnerId) || 0) + 1);
        }

        const list: OrderExportPartner[] = [];
        for (const [partnerId, screenCount] of screenCountByPartner) {
          const partner = partnerById.get(partnerId);
          if (!partner) continue;
          list.push({
            id: partner.id,
            name: partner.name,
            slug: partner.slug || partner.name.toLowerCase(),
            screenCount,
          });
        }

        list.sort((a, b) => a.name.localeCompare(b.name, 'lt'));
        if (!cancelled) setExportPartners(list);
      } catch {
        if (!cancelled) setExportPartners([]);
      } finally {
        if (!cancelled) setExportPartnersLoading(false);
      }
    };

    loadExportPartners();
    return () => {
      cancelled = true;
    };
  }, [isOpen, isAgency, order?.id, exportScreenIdsKey, isLocalTest]);

  useEffect(() => {
    if (!isOpen || !order || !isAgency) {
      setCityOtsRows([]);
      return;
    }

    let cancelled = false;
    const loadOts = async () => {
      setOtsLoading(true);
      try {
        const { campaignOrder, screens, bundles } = await loadCampaignExportData(order.id);
        if (!cancelled) setCityOtsRows(computeCityOtsBreakdown(campaignOrder, screens, bundles));
      } catch {
        if (!cancelled) setCityOtsRows([]);
      } finally {
        if (!cancelled) setOtsLoading(false);
      }
    };
    loadOts();
    return () => {
      cancelled = true;
    };
  }, [isOpen, order, isAgency]);

  const invoiceStatusToggleDisabled = useMemo(
    () => (order ? invoiceToggleRequiresBillingMonth(order, billingContext) : false),
    [order, billingContext]
  );

  const loadInvoiceStatus = useCallback(async () => {
    if (!order) return;

    try {
      if (billingContext) {
        const statusMap = await SupabaseService.getMonthInvoiceStatuses([order], billingContext);
        const status = statusMap[order.id];
        setInvoiceStatus({
          invoice_issued: readInvoiceStatusField(order, status, 'invoice_issued'),
          invoice_sent: readInvoiceStatusField(order, status, 'invoice_sent'),
        });
        return;
      }

      const statusMap = await SupabaseService.getInvoiceStatuses([order.id]);
      const status = statusMap[order.id];
      setInvoiceStatus({
        invoice_issued: readInvoiceStatusField(order, status, 'invoice_issued'),
        invoice_sent: readInvoiceStatusField(order, status, 'invoice_sent'),
      });
    } catch (error) {
      console.error('Error loading invoice status:', error);
      setInvoiceStatus({
        invoice_issued: readInvoiceStatusField(order, null, 'invoice_issued'),
        invoice_sent: false,
      });
    }
  }, [order, billingContext]);

  useEffect(() => {
    if (isOpen) {
      const modalElement = document.querySelector('[role="dialog"]') as HTMLElement;
      if (modalElement) {
        modalElement.focus();
      }
    }
  }, [isOpen]);

  const loadComments = useCallback(async () => {
    if (!order) return;
    try {
      const commentsData = await SupabaseService.getComments(order.id, {
        visibility: isAgency ? 'agency' : undefined,
      });
      const sortedComments = commentsData.sort((a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      setComments(sortedComments);
    } catch {
      console.error('Error loading comments');
    }
  }, [order, isAgency]);

  const loadReminders = useCallback(async () => {
    if (!order) return;
    try {
      const remindersData = await SupabaseService.getReminders(order.id, {
        visibility: collaborationScope,
      });
      setReminders(remindersData);
    } catch {
      console.error('Error loading reminders');
    }
  }, [order, collaborationScope]);

  const loadPrintScreens = useCallback(async () => {
    if (!order) return;
    try {
      const printScreensData = await SupabaseService.getPrintscreensForOrder(
        order.id,
        collaborationScope
      );
      setPrintScreens(printScreensData);
      setPendingPrintscreens([]);
    } catch {
      console.error('Error loading print screens');
    }
  }, [order, collaborationScope]);

  const loadPartnerDeliveryStatuses = useCallback(async (orderId: string) => {
    try {
      const res = await fetch(
        `/api/partner-plans/status?orderId=${encodeURIComponent(orderId)}`
      );
      if (!res.ok) return;
      const data = (await res.json()) as {
        statuses?: Array<{
          partnerId: string;
          sent: boolean;
          confirmed: boolean;
          stage: string;
        }>;
      };
      const map: Record<
        string,
        {
          plan?: { sent: boolean; confirmed: boolean };
          clips?: { sent: boolean; confirmed: boolean };
        }
      > = {};
      for (const row of data.statuses || []) {
        if (row.stage !== 'plan' && row.stage !== 'clips') continue;
        const current = map[row.partnerId] || {};
        current[row.stage] = {
          sent: row.sent,
          confirmed: row.confirmed,
        };
        map[row.partnerId] = current;
      }
      setPartnerDeliveryById(map);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (!isOpen || !order || isAgency) {
      setPartnerDeliveryById({});
      return;
    }
    void loadPartnerDeliveryStatuses(order.id);
    const timer = window.setInterval(() => {
      void loadPartnerDeliveryStatuses(order.id);
    }, 8000);
    return () => window.clearInterval(timer);
  }, [isOpen, order, isAgency, loadPartnerDeliveryStatuses]);

  useEffect(() => {
    if (order && isOpen) {
      loadComments();
      loadInvoiceStatus();

      const timer = setTimeout(() => {
        loadReminders();
        loadPrintScreens();
      }, 500);

      return () => clearTimeout(timer);
    }
  }, [order, isOpen, isAgency, loadComments, loadReminders, loadPrintScreens, loadInvoiceStatus, billingContext]);

  useEffect(() => {
    if (!isOpen) {
      setAtaskaitaOpen(false);
      setDeleteConfirmOpen(false);
      setDeleting(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!deleteConfirmOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (!deleteConfirmRef.current?.contains(event.target as Node)) {
        setDeleteConfirmOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [deleteConfirmOpen]);

  useEffect(() => {
    setClipsUrl('');
    setDeliveryNote('');
  }, [order?.id]);

  useEffect(() => {
    if (!formData.approved) setAtaskaitaOpen(false);
  }, [formData.approved]);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      if (deleteConfirmOpen) {
        setDeleteConfirmOpen(false);
        return;
      }
      if (ataskaitaOpen) {
        setAtaskaitaOpen(false);
        return;
      }
      onClose();
    };
    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, [isOpen, onClose, ataskaitaOpen, deleteConfirmOpen]);

  const handleInputChange = (field: keyof Order, value: string | number | boolean) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    if (field === 'client' && isLocalTest && order) {
      const fresh = getTestOrder(order.id) || (order as TestOrder);
      upsertTestOrder({ ...fresh, client: String(value) });
    }
  };

  const handleUpdateLive = async () => {
    if (!order || isAgency || liveUpdating || liveState.status !== 'live') return;
    setLiveUpdating(true);
    try {
      const liveOrder = {
        ...(isLocalTest ? getTestOrder(order.id) || order : order),
        client: String(formData.client ?? order.client),
        from: String(formData.from ?? order.from),
        to: String(formData.to ?? order.to),
      };
      const result = await publishOrderLive(liveOrder);
      setLiveState(result.live);
      skipLiveDirtyRef.current = true;
      liveContentKeyRef.current = liveContentKey;
      setLiveDirty(false);
      setLiveReceipt({ server: true, player: false });
      handleInputChange('media_received', true);
      if (isLocalTest) {
        const updated = getTestOrder(order.id);
        if (updated) onOrderUpdated?.(updated);
      } else {
        onOrderUpdated?.({
          ...order,
          media_received: true,
          details: {
            ...(order.details || {}),
            live: result.live,
          },
        });
      }
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Nepavyko atnaujinti Live.');
    } finally {
      setLiveUpdating(false);
    }
  };

  /** Patvirtinus — iškart įrašom (test); nuimant — tik po sėkmingo Live atšaukimo. */
  const handleApprovedChange = (nextApproved: boolean) => {
    if (!order || approvalBusy) return;

    if (nextApproved) {
      handleInputChange('approved', true);
      if (isLocalTest) {
        const fresh = getTestOrder(order.id) || (order as TestOrder);
        const saved = upsertTestOrder({ ...fresh, approved: true });
        onOrderUpdated?.(saved);
      } else {
        onOrderUpdated?.({ ...order, approved: true });
      }
      void setPlayPublicPlanLock(order.id, true);
      return;
    }

    if (!formData.approved && liveState.status !== 'live') return;

    const previousLive = liveState;
    setApprovalBusy(true);
    void (async () => {
      try {
        if (isLocalTest) {
          await unpublishOrderLive({ ...order, approved: false });
          const updated = getTestOrder(order.id);
          if (updated) onOrderUpdated?.(updated);
        } else {
          await unpublishOrderFromPlayer(order.id);
          onOrderUpdated?.({
            ...order,
            approved: false,
            details: {
              ...(order.details || {}),
              live: { status: 'idle' },
            },
          });
        }
        handleInputChange('approved', false);
        setLiveState({ status: 'idle' });
        if (modalSection === 'clips') {
          setModalSection('details');
        }
        await setPlayPublicPlanLock(order.id, false);
      } catch (err) {
        handleInputChange('approved', true);
        setLiveState(previousLive);
        window.alert(
          err instanceof Error ? err.message : 'Nepavyko nuimti Live — patvirtinimas paliktas.'
        );
      } finally {
        setApprovalBusy(false);
      }
    })();
  };

  const handleToggleInvoiceStatus = async (
    field: 'invoice_issued' | 'invoice_sent',
    value: boolean
  ) => {
    if (!order) return;

    if (invoiceToggleRequiresBillingMonth(order, billingContext)) {
      return;
    }

    const previousStatus = { ...invoiceStatus };
    const nextStatus = nextInvoiceStatusOnToggle(invoiceStatus, field, value);
    setInvoiceStatus(nextStatus);

    try {
      if (multiMonthOrder && billingContext?.month && billingContext.year) {
        await SupabaseService.persistInvoiceStatusToggle(order, billingContext, nextStatus);
        return;
      }

      if (!multiMonthOrder) {
        await SupabaseService.upsertInvoiceStatus(order.id, nextStatus);
      }
    } catch (error) {
      console.error('Error updating invoice status:', error);
      setInvoiceStatus(previousStatus);
    }
  };

  const handleSave = async () => {
    if (!order) return;

    if (customBillingPeriodsEnabled && billingPeriods.length > 0) {
      const periodError = validateBillingPeriods(
        billingPeriods,
        formData.from ?? order.from,
        formData.to ?? order.to
      );
      if (periodError) {
        alert(periodError);
        return;
      }
    }
    
    setLoading(true);
    try {
      if (isLocalTest) {
        const fresh = getTestOrder(order.id) || (order as TestOrder);
        const nextApproved =
          typeof formData.approved === 'boolean' ? formData.approved : fresh.approved;
        const nextLive: OrderLiveState =
          nextApproved && liveState.status === 'live' ? liveState : { status: 'idle' };
        if (!nextApproved && (fresh.details?.live?.status === 'live' || liveState.status === 'live')) {
          await unpublishOrderFromPlayer(order.id);
        }
        const nextFrom = String(formData.from ?? fresh.from);
        const nextTo = String(formData.to ?? fresh.to);
        const nextIntensity = formData.intensity ?? fresh.intensity;
        const planChangedAt = resolvePlanChangedAt(
          fresh,
          { ...fresh, from: nextFrom, to: nextTo, intensity: nextIntensity },
          new Date().toISOString()
        );
        const saved = upsertTestOrder({
          ...fresh,
          client: String(formData.client ?? fresh.client),
          agency: fresh.agency,
          invoice_id: fresh.invoice_id,
          approved: nextApproved,
          from: nextFrom,
          to: nextTo,
          media_received: !!formData.media_received,
          final_price: Number(formData.final_price ?? fresh.final_price) || 0,
          invoice_sent: invoiceStatus.invoice_sent,
          invoice_issued: invoiceStatus.invoice_issued,
          intensity: nextIntensity,
          screens: fresh.screens,
          grid: fresh.grid,
          clip_duration: fresh.clip_duration ?? fresh.details?.plan?.clip_duration ?? 10,
          viaduct_frequency:
            fresh.viaduct_frequency ?? fresh.details?.plan?.viaductFrequency ?? 1,
          on_sale_screens: fresh.on_sale_screens || [],
          on_sale_discount: fresh.on_sale_discount ?? 0,
          hidden_screens: fresh.hidden_screens || [],
          viaduct: typeof formData.viaduct === 'boolean' ? formData.viaduct : fresh.viaduct,
          details: {
            ...(fresh.details || {}),
            ...(planChangedAt ? { planChangedAt } : {}),
            isTest: true,
            discount: fresh.details?.discount ?? 80,
            total: Number(formData.final_price ?? fresh.final_price) || 0,
            finalPrice: Number(formData.final_price ?? fresh.final_price) || 0,
            live: nextLive,
            clockOverlay:
              formData.details?.clockOverlay ?? fresh.details?.clockOverlay,
          },
        });
        onOrderUpdated?.(saved);
        onClose();
        return;
      }

      const nextApproved =
        typeof formData.approved === 'boolean' ? formData.approved : order.approved;
      const wasApproved = !!order.approved;
      const orderPayload = { ...formData };
      delete orderPayload.invoice_sent;

      let specManualPrice: number | null = null;
      if (!isAgency) {
        if (isSpecOrder) {
          specManualPrice = Number(formData.final_price);
          if (!specManualPrice || specManualPrice <= 0) {
            alert('Įveskite spec. užsakymo kainą (didesnę už 0).');
            return;
          }
          await SupabaseService.upsertOrderSpecPrice(order.id, specManualPrice);
          delete orderPayload.final_price;
        } else {
          await SupabaseService.deleteOrderSpecPrice(order.id);
        }
      }

      const updatedOrder = await PocketBaseService.updateOrder(order.id, orderPayload);
      const displayOrder =
        isSpecOrder && specManualPrice != null
          ? { ...updatedOrder, final_price: specManualPrice, is_spec_order: true }
          : { ...updatedOrder, is_spec_order: false };

      try {
        if (multiMonthOrder && billingContext?.month && billingContext.year) {
          await SupabaseService.persistInvoiceStatusToggle(order, billingContext, invoiceStatus);
        } else if (!multiMonthOrder) {
          await SupabaseService.upsertInvoiceStatus(order.id, {
            invoice_issued: invoiceStatus.invoice_issued,
            invoice_sent: invoiceStatus.invoice_sent,
          });
        }
      } catch (invoiceError) {
        // Do not block order save if Supabase invoice status is temporarily unavailable.
        console.error('Failed to save invoice status:', invoiceError);
      }

      if (!isAgency) {
        try {
          await SupabaseService.replaceOrderBillingPeriods(
            order.id,
            customBillingPeriodsEnabled ? billingPeriods : []
          );
        } catch (periodError) {
          console.error('Failed to save billing periods:', periodError);
        }
      }

      // Track approval moment in Supabase when status changes from not approved to approved.
      if (!wasApproved && nextApproved) {
        try {
          await SupabaseService.addApprovalEvent({
            order_id: displayOrder.id,
            snapshot_client: displayOrder.client,
            snapshot_amount: displayOrder.final_price,
          });
        } catch (approvalError) {
          // Do not block order updates if Supabase approval events are not configured yet.
          console.error('Failed to save approval event:', approvalError);
        }
      }

      onOrderUpdated?.(displayOrder);
      if (nextApproved !== wasApproved) {
        void setPlayPublicPlanLock(order.id, nextApproved);
      }
      onClose();
    } catch {
      console.error('Error updating order');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!order || deleting) return;
    setDeleting(true);
    try {
      if (isLocalTest) {
        await unpublishOrderFromPlayer(order.id);
        deleteTestOrder(order.id);
        onOrderUpdated?.(order);
        onClose();
        return;
      }
      await PocketBaseService.deleteOrder(order.id);
      onOrderUpdated?.(order);
      onClose();
    } catch {
      console.error('Error deleting order');
      setDeleting(false);
      setDeleteConfirmOpen(false);
    }
  };

  const handleAddComment = async () => {
    if (!order || !newComment.trim()) return;
    
    try {
      const comment = await SupabaseService.addComment({
        order_id: order.id,
        text: newComment.trim(),
        visibility: isAgency ? 'agency' : 'internal',
      });
      setComments(prev => [comment, ...prev]);
      setNewComment('');
      
      // Clear contentEditable element
      const contentEditableElement = document.querySelector('[contenteditable="true"]') as HTMLElement;
      if (contentEditableElement) {
        contentEditableElement.textContent = '';
      }
    } catch (error) {
      console.error('Error adding comment:', error);
    }
  };

  const handleStartEditComment = (comment: Comment) => {
    setEditingCommentId(comment.id);
    setEditingCommentText(comment.text || '');
  };

  const handleCancelEditComment = () => {
    setEditingCommentId(null);
    setEditingCommentText('');
  };

  const handleSaveEditedComment = async (commentId: string) => {
    const nextText = editingCommentText.trim();
    if (!nextText) return;

    try {
      const updated = await SupabaseService.updateComment(commentId, nextText);
      setComments(prev => prev.map(c => (c.id === commentId ? { ...c, ...updated } : c)));
      handleCancelEditComment();
    } catch {
      console.error('Error updating comment');
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    try {
      await SupabaseService.deleteComment(commentId);
      setComments(prev => prev.filter(c => c.id !== commentId));
      if (editingCommentId === commentId) {
        handleCancelEditComment();
      }
    } catch {
      console.error('Error deleting comment');
    }
  };

  const handleAddReminder = async () => {
    if (!order || !reminderDate || !reminderMessage.trim()) return;
    
    try {
      const reminder = await SupabaseService.addReminder(
        order.id,
        {
          due_date: reminderDate,
          title: reminderMessage.trim(),
          is_completed: false,
        },
        collaborationScope
      );
      setReminders(prev => [...prev, reminder]);
      setReminderDate('');
      setReminderMessage('');
    } catch {
      console.error('Error adding reminder');
      const tempReminder = {
          id: `temp-${Date.now()}`,
          due_date: reminderDate,
          title: reminderMessage.trim(),
          is_completed: false,
          order_id: order.id,
          created_at: new Date().toISOString()
        } as Reminder;
      
      setReminders(prev => [...prev, tempReminder]);
      setReminderDate('');
      setReminderMessage('');
    }
  };

  const handleDeleteReminder = async (reminderId: string) => {
    try {
      await SupabaseService.deleteReminder(reminderId);
      setReminders(prev => prev.filter(r => r.id !== reminderId));
    } catch {
      console.error('Error deleting reminder');
    }
  };

  const isSpreadsheetAttachment = (f: FileAttachment) => {
    const ft = (f.file_type || '').toLowerCase();
    const name = (f.filename || '').toLowerCase();
    if (name.endsWith('.xls') || name.endsWith('.xlsx')) return true;
    return (
      ft === 'application/vnd.ms-excel' ||
      ft === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      ft.includes('spreadsheetml')
    );
  };

  const handlePrintscreenView = async (printscreen: FileAttachment) => {
    if (isSpreadsheetAttachment(printscreen)) {
      try {
        const res = await fetch(printscreen.file_url);
        if (!res.ok) throw new Error(String(res.status));
        const blob = await res.blob();
        const objectUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = objectUrl;
        a.download = printscreen.filename || 'ataskaita.xlsx';
        a.rel = 'noopener';
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(objectUrl);
      } catch {
        window.open(printscreen.file_url, '_blank');
      }
      return;
    }
    window.open(printscreen.file_url, '_blank');
  };

  const handleAttachmentFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.currentTarget;
    const files = Array.from(input.files ?? []);
    if (!files.length || !order) return;

    const acceptFile = (file: File) => {
      const t = (file.type ?? '').toLowerCase();
      const n = file.name.toLowerCase();
      if (t.startsWith('image/')) return true;
      if (/\.xlsx?$/i.test(file.name)) return true;
      if (t === 'application/vnd.ms-excel') return true;
      if (t.includes('spreadsheetml') || t.includes('ms-excel')) return true;
      if (t === 'application/octet-stream' && /\.xlsx?$/i.test(file.name)) return true;
      if (t === 'application/zip' && n.endsWith('.xlsx')) return true;
      return false;
    };

    setAttachmentUploading(true);
    try {
      for (const file of files) {
        if (!acceptFile(file)) continue;
        try {
          const uploadedFile = await SupabaseService.uploadPrintscreen(
            order.id,
            file,
            collaborationScope
          );
          setPendingPrintscreens((prev) => [...prev, uploadedFile]);
        } catch (err) {
          console.error('Error uploading attachment', file.name, err);
        }
      }
    } finally {
      setAttachmentUploading(false);
      input.value = '';
    }
  };

  const handlePaste = async (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items || !order) return;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        
        const file = item.getAsFile();
        if (!file) continue;

        try {
          const uploadedFile = await SupabaseService.uploadPrintscreen(
            order.id,
            file,
            collaborationScope
          );
          
          setPendingPrintscreens(prev => [...prev, uploadedFile]);
          
        } catch {
          console.error('Error uploading printscreen');
        }
      }
    }
  };

  const formatDateForDisplay = (dateString: string) => {
    try {
      return formatDateInputValue(dateString);
    } catch {
      return dateString;
    }
  };

  const calculateWeek = (dateString: string) => {
    try {
      const date = new Date(dateString);
      const jan4 = new Date(date.getFullYear(), 0, 4);
      const jan4Weekday = jan4.getDay() || 7;
      const week1Start = new Date(jan4);
      week1Start.setDate(jan4.getDate() - jan4Weekday + 1);
      
      const daysFromWeek1 = Math.floor((date.getTime() - week1Start.getTime()) / (24 * 60 * 60 * 1000));
      const isoWeekNumber = Math.ceil((daysFromWeek1 + 1) / 7);
      
      return `W${isoWeekNumber}`;
    } catch {
      return '';
    }
  };

  const calculateMonthlyDistribution = (fromDate: string, toDate: string, totalAmount: number) => {
    try {
      if (!fromDate || !toDate || !totalAmount) return [];
      const start = parseDateOnlyLocal(fromDate);
      const end = parseDateOnlyLocal(toDate);
      
      if (!start || !end || isNaN(start.getTime()) || isNaN(end.getTime())) {
        return [];
      }
      
      let manualDayCount = 0;
      let checkDate = new Date(start);
      while (checkDate <= end) {
        manualDayCount++;
        const nextCheckDate = new Date(checkDate);
        nextCheckDate.setDate(nextCheckDate.getDate() + 1);
        checkDate = nextCheckDate;
      }
      
      const monthlyDistribution: Array<{
        month: string;
        year: number;
        days: number;
        amount: number;
        monthName: string;
      }> = [];
      
      const monthNames = [
        'sausis', 'vasaris', 'kovas', 'balandis', 'gegužė', 'birželis',
        'liepa', 'rugpjūtis', 'rugsėjis', 'spalis', 'lapkritis', 'gruodis'
      ];
      
              const currentDate = new Date(start);
      const endDate = new Date(end);
      
      while (currentDate <= endDate) {
        const month = currentDate.getMonth() + 1;
        const year = currentDate.getFullYear();
        const monthKey = `${year}-${month}`;
        
        let monthEntry = monthlyDistribution.find(m => m.month === monthKey);
        
        if (!monthEntry) {
          monthEntry = {
            month: monthKey,
            year: year,
            days: 0,
            amount: 0,
            monthName: monthNames[month - 1]
          };
          monthlyDistribution.push(monthEntry);
        }
        
        monthEntry.days++;
        currentDate.setDate(currentDate.getDate() + 1);
      }
      
      monthlyDistribution.forEach(month => {
        month.amount = (month.days / manualDayCount) * totalAmount;
      });
      
      return monthlyDistribution.map(m => ({
        month: parseInt(m.month.split('-')[1]),
        year: m.year,
        monthName: m.monthName,
        days: m.days,
        amount: m.amount
      }));
    } catch {
      console.error('Error in calculateMonthlyDistribution');
      return [];
    }
  };
  
  const startWeek = formData.from ? calculateWeek(formData.from) : '';
  const endWeek = formData.to ? calculateWeek(formData.to) : '';
  const weeksDisplay = startWeek && endWeek ? `${startWeek} → ${endWeek}` : startWeek || endWeek || '';

  const handleCopyPocketBaseId = async () => {
    if (!order) return;
    try {
      await navigator.clipboard.writeText(order.id);
    } catch {
      // ignore — naršyklė gali blokuoti clipboard be HTTPS / leidimo
    }
  };

  const loadCampaignExportData = async (orderId: string) => {
    const fullOrder = await PocketBaseService.getOrder(orderId);
    const [screenRecords, bundles] = await Promise.all([
      PocketBaseService.getCampaignScreens(!!fullOrder.viaduct),
      PocketBaseService.getBundles(),
    ]);
    const campaignOrder = toCampaignOrderInput(
      fullOrder as unknown as Record<string, unknown>
    );
    const screens = screenRecords.map((r) =>
      toCampaignScreen(r as Record<string, unknown>)
    );
    return { campaignOrder, screens, bundles };
  };

  const handlePartnerPlanExcelExport = async (partner: OrderExportPartner) => {
    if (!order) return;
    setExportError(null);
    setExportingPartnerId(partner.id);
    try {
      const { campaignOrder, screens, bundles } = await loadCampaignExportData(
        order.id
      );

      await downloadReklamosPlanas({
        order: campaignOrder,
        partnerId: partner.id,
        partnerName: partner.name,
        screens,
        bundles,
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Nepavyko sugeneruoti Excel failo';
      setExportError(message);
    } finally {
      setExportingPartnerId(null);
    }
  };

  const handleCombinedPlanExcelExport = async () => {
    if (!order) return;
    setExportError(null);
    setExportingCombined(true);
    try {
      const { campaignOrder, screens, bundles } = await loadCampaignExportData(
        order.id
      );
      await downloadReklamosPlanasCombined({
        order: campaignOrder,
        screens,
        bundles,
      });
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'Nepavyko sugeneruoti bendro Excel failo';
      setExportError(message);
    } finally {
      setExportingCombined(false);
    }
  };

  const handleSendPartnerPackage = async () => {
    if (!order || exportPartners.length === 0) return;
    const url = clipsUrl.trim();
    if (!url) {
      setExportError('Įklijuokite video nuorodą (WeTransfer ir pan.)');
      return;
    }
    setExportError(null);
    setSendingPartnerPlans(true);
    try {
      const res = await fetch('/api/partner-plans/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: order.id,
          clipUrl: url,
          note: deliveryNote.trim() || undefined,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        sent?: number;
        errors?: number;
        results?: Array<{ partnerName: string; status: string; error?: string }>;
      };
      if (!res.ok) {
        throw new Error(data.error || 'Nepavyko išsiųsti plano ir klipų');
      }
      await loadPartnerDeliveryStatuses(order.id);
      if ((data.errors || 0) > 0) {
        const firstErr = data.results?.find((r) => r.status === 'error');
        setExportError(
          firstErr?.error ||
            `Išsiųsta ${data.sent || 0}, klaidų: ${data.errors}`
        );
      }
    } catch (err) {
      setExportError(
        err instanceof Error ? err.message : 'Nepavyko išsiųsti plano ir klipų'
      );
    } finally {
      setSendingPartnerPlans(false);
    }
  };

  const isOrderApproved = formData.approved ?? order?.approved ?? false;
  const orderForPanels = order
    ? {
        ...(isLocalTest ? getTestOrder(order.id) || order : order),
        client: String(formData.client ?? order.client),
        from: String(formData.from ?? order.from),
        to: String(formData.to ?? order.to),
        approved: !!isOrderApproved,
        media_received:
          typeof formData.media_received === 'boolean'
            ? formData.media_received
            : !!(isLocalTest ? getTestOrder(order.id)?.media_received : order.media_received),
      }
    : null;

  useEffect(() => {
    if (!isOrderApproved && modalSection === 'clips') {
      setModalSection('details');
    }
  }, [isOrderApproved, modalSection]);

  if (!isOpen || !order) return null;

  return (
    <>
    <div 
      className="fixed inset-0 z-50 flex justify-end bg-black/40"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div className="flex h-full min-w-0">
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onClose();
          }}
          className="m-4 mt-5 flex h-10 w-10 shrink-0 items-center justify-center self-start rounded-full bg-white text-gray-700 shadow-md ring-1 ring-black/5 transition-colors hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
          title="Uždaryti (Esc)"
          aria-label="Uždaryti"
        >
          <XMarkIcon className="h-5 w-5" />
        </button>
      <div
        className={`relative flex h-full shrink-0 flex-col overflow-hidden bg-white shadow-2xl dark:bg-gray-800 ${
          isAgency
            ? 'w-[45rem] max-w-[calc(100vw-5.5rem)]'
            : 'w-[56rem] max-w-[calc(100vw-5.5rem)]'
        }`}
        onClick={(event) => event.stopPropagation()}
      >
        {liveState.status === 'live' ? (
          <div
            className="pointer-events-none absolute inset-x-0 top-0 z-20 h-1 bg-emerald-500"
            aria-hidden
          />
        ) : null}
        <div className="min-h-0 flex-1 overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                {formData.client || order.client}
              </h2>
            </div>
            <p className="text-gray-600 dark:text-gray-400">{order.agency} | {order.invoice_id}</p>
            {formData.approved && !isAgency && (
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                <span className="text-xs text-gray-500 dark:text-gray-400 font-mono tracking-tight select-all">
                  {order.id}
                </span>
                <button
                  type="button"
                  onClick={handleCopyPocketBaseId}
                  className="inline-flex shrink-0 rounded p-0.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-200"
                  title="Kopijuoti PocketBase ID"
                  aria-label="Kopijuoti PocketBase užsakymo ID"
                >
                  <ClipboardDocumentIcon className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>
          
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => {
                window.open(
                  calculatorEditHref(order.id, isLocalTest, playSandbox),
                  '_blank',
                  'noopener,noreferrer'
                );
              }}
              className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium text-gray-700 ring-1 ring-inset ring-gray-300 transition-colors hover:bg-gray-50 dark:text-gray-300 dark:ring-gray-600 dark:hover:bg-gray-700"
              title="Redaguoti planą skaičiuoklėje (naujas langas)"
            >
              <CalendarDaysIcon className="h-4 w-4" />
              Planas
            </button>
            {isOrderApproved && (
              <button
                type="button"
                onClick={() => setModalSection((s) => (s === 'clips' ? 'details' : 'clips'))}
                className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors ${
                  modalSection === 'clips'
                    ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900'
                    : 'text-gray-700 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 dark:text-gray-300 dark:ring-gray-600 dark:hover:bg-gray-700'
                }`}
                title="Klipai Piksel ekranams"
                aria-pressed={modalSection === 'clips'}
              >
                <FilmIcon className="h-4 w-4" />
                Klipai
              </button>
            )}

            <div className="flex items-center gap-1.5">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Sąskaita</span>
              <div className="flex items-center gap-0.5">
                <StatusIconButton
                  active={invoiceStatus.invoice_issued}
                  label={
                    invoiceStatusToggleDisabled
                      ? 'Pasirinkite konkretų mėnesį kelių mėnesių užsakymui'
                      : invoiceStatus.invoice_issued
                        ? 'Sąskaita išrašyta'
                        : 'Sąskaita neišrašyta'
                  }
                  icon={DocumentTextIcon}
                  disabled={isAgency || invoiceStatusToggleDisabled}
                  onClick={() =>
                    void handleToggleInvoiceStatus(
                      'invoice_issued',
                      !invoiceStatus.invoice_issued
                    )
                  }
                />
                {onGenerateInvoice && formData.approved && !isAgency && order && (
                  <button
                    type="button"
                    title="Išrašyti sąskaitą"
                    aria-label="Išrašyti sąskaitą"
                    onClick={() => onGenerateInvoice(order)}
                    className="inline-flex rounded-md p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:hover:bg-gray-700 dark:hover:text-white"
                  >
                    <PlusCircleIcon className="h-5 w-5" strokeWidth={1.5} />
                  </button>
                )}
              </div>
            </div>

            {!isAgency && (
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Išsiųsta</span>
              <StatusIconButton
                active={invoiceStatus.invoice_sent}
                label={
                  invoiceStatusToggleDisabled
                    ? 'Pasirinkite konkretų mėnesį kelių mėnesių užsakymui'
                    : invoiceStatus.invoice_sent
                      ? 'Sąskaita išsiųsta'
                      : 'Sąskaita neišsiųsta'
                }
                icon={PaperAirplaneIcon}
                disabled={invoiceStatusToggleDisabled}
                onClick={() =>
                  void handleToggleInvoiceStatus('invoice_sent', !invoiceStatus.invoice_sent)
                }
              />
            </div>
            )}
        </div>
        </div>
        {!isAgency && liveState.status === 'live' ? (
          <LivePublishStatus
            variant={
              liveUpdating
                ? 'sending'
                : liveChangeLines.length
                  ? 'pending'
                  : liveReceipt
                    ? 'receipt'
                    : 'hidden'
            }
            changes={liveChangeLines}
            serverAccepted={!!liveReceipt?.server}
            playerAccepted={!!liveReceipt?.player}
            liveBusy={liveUpdating}
            onLive={
              liveChangeLines.length || liveUpdating
                ? () => void handleUpdateLive()
                : undefined
            }
          />
        ) : null}

        <div className="p-6 space-y-3">
          {isOrderApproved && orderForPanels ? (
          <div className={modalSection === 'clips' ? '' : 'hidden'}>
            <OrderClipsPanel
              order={orderForPanels}
              liveActive={liveState.status === 'live'}
              liveSentScreenNames={liveState.screenNames}
              liveNeedsUpdate={liveDirty}
              livePublishBusy={liveUpdating}
              publishedClipStamp={liveState.publishedSnapshot?.clipStamp}
              livePublishedAt={liveState.status === 'live' ? liveState.publishedAt : undefined}
              onClipStampChange={setLiveClipStamp}
              onLiveClipFacts={setLiveClipFacts}
              onLiveRemovals={setLiveRemovals}
              onLivePublishBusy={setLiveUpdating}
              onLiveNeedsUpdate={() => setLiveDirty(true)}
              onLiveChange={(next) => {
                setLiveState(next);
                if (next.status === 'live') {
                  skipLiveDirtyRef.current = true;
                  liveContentKeyRef.current = liveContentKey;
                  setLiveDirty(false);
                  setLiveReceipt({ server: true, player: false });
                } else {
                  liveContentKeyRef.current = null;
                  setLiveDirty(false);
                  setLiveReceipt(null);
                }
                handleInputChange('media_received', next.status === 'live' ? true : !!formData.media_received);
                if (isLocalTest) {
                  const updated = getTestOrder(order.id);
                  if (updated) onOrderUpdated?.(updated);
                } else {
                  onOrderUpdated?.({
                    ...order,
                    media_received: next.status === 'live' ? true : order.media_received,
                    details: {
                      ...(order.details || {}),
                      live: next,
                    },
                  });
                }
              }}
              onClockOverlayChange={(enabled) => {
                const clockOverlay = { enabled, zone: 'bottom' as const };
                setFormData((prev) => ({
                  ...prev,
                  details: {
                    ...(prev.details || order.details || {}),
                    clockOverlay,
                  },
                }));
                if (isLocalTest) {
                  const updated = getTestOrder(order.id);
                  if (updated) onOrderUpdated?.(updated);
                } else {
                  onOrderUpdated?.({
                    ...order,
                    details: {
                      ...(order.details || {}),
                      clockOverlay,
                    },
                  });
                }
              }}
              onMediaCoverageChange={(coverage) => {
                const mediaCoverage = {
                  ok: coverage.ok,
                  total: coverage.total,
                  unit: 'resolution' as const,
                  updatedAt: new Date().toISOString(),
                };
                setFormData((prev) => ({
                  ...prev,
                  details: {
                    ...(prev.details || order.details || {}),
                    mediaCoverage,
                  },
                }));
                if (isLocalTest) {
                  const fresh = getTestOrder(order.id);
                  if (fresh) {
                    const updated = upsertTestOrder({
                      ...fresh,
                      details: {
                        ...fresh.details,
                        isTest: true,
                        mediaCoverage,
                      },
                    });
                    onOrderUpdated?.(updated);
                  }
                  return;
                }
                void PocketBaseService.updateOrder(order.id, {
                  details: {
                    ...(order.details || {}),
                    mediaCoverage,
                  },
                })
                  .then((updated) => onOrderUpdated?.(updated))
                  .catch((err) => {
                    console.error('Nepavyko išsaugoti mediaCoverage:', err);
                  });
              }}
              allowLivePublish={!isAgency}
            />
          </div>
          ) : null}
          {modalSection !== 'clips' ? (
          <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Pavadinimas
                    </label>
                    <input
                      type="text"
                      value={formData.client || ''}
                      onChange={(e) => handleInputChange('client', e.target.value)}
                      readOnly={isAgency}
                      className={`w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white ${readOnlyFieldClass}`}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Statusas
                    </label>
                    {isAgency ? (
                      <div
                        className={`flex items-center gap-2 w-full px-3 py-2 border rounded-lg ${
                          formData.approved
                            ? 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:bg-emerald-900/30 dark:border-emerald-700 dark:text-emerald-200'
                            : 'border-amber-300 bg-amber-50 text-amber-800 dark:bg-amber-900/30 dark:border-amber-700 dark:text-amber-200'
                        }`}
                      >
                        {formData.approved && (
                          <CheckCircleIcon className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                        )}
                        <span className="text-sm font-medium">
                          {formData.approved ? 'Patvirtinta' : 'Nepatvirtinta'}
                        </span>
                        {liveState.status === 'live' && formData.approved ? (
                          <LiveStatusBadge
                            alerts={liveScreenAlerts}
                            className="ml-auto inline-flex h-[25px] items-center gap-1 rounded-full bg-emerald-600 px-2 text-[10px] font-bold uppercase leading-none tracking-wide text-white"
                          />
                        ) : null}
                      </div>
                    ) : (
                      <div
                        className="relative inline-flex w-full rounded-lg border border-gray-200 bg-gray-50 p-1 dark:border-gray-600 dark:bg-gray-900/50"
                        role="group"
                        aria-label="Kampanijos statusas"
                      >
                        {liveState.status === 'live' && formData.approved ? (
                          <LiveStatusBadge
                            alerts={liveScreenAlerts}
                            className="absolute -right-1.5 -top-2 z-10 inline-flex h-[25px] -translate-x-[20px] items-center gap-1 rounded-full bg-emerald-600 px-2 text-[10px] font-bold uppercase leading-none tracking-wide text-white shadow-sm"
                          />
                        ) : null}
                        <button
                          type="button"
                          onClick={() => handleApprovedChange(false)}
                          disabled={approvalBusy}
                          aria-pressed={!formData.approved}
                          className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors disabled:opacity-60 ${
                            !formData.approved
                              ? 'bg-amber-50 text-amber-800 shadow-sm ring-1 ring-amber-200/80 dark:bg-amber-950/40 dark:text-amber-200 dark:ring-amber-800/60'
                              : 'text-gray-500 hover:bg-white/70 hover:text-gray-800 dark:text-gray-400 dark:hover:bg-gray-800/60 dark:hover:text-gray-200'
                          }`}
                        >
                          {approvalBusy ? 'Stabdoma…' : 'Nepatvirtinta'}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleApprovedChange(true)}
                          disabled={approvalBusy}
                          aria-pressed={!!formData.approved}
                          className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors disabled:opacity-60 ${
                            formData.approved
                              ? 'bg-emerald-50 text-emerald-800 shadow-sm ring-1 ring-emerald-200/80 dark:bg-emerald-950/40 dark:text-emerald-200 dark:ring-emerald-800/60'
                              : 'text-gray-500 hover:bg-white/70 hover:text-gray-800 dark:text-gray-400 dark:hover:bg-gray-800/60 dark:hover:text-gray-200'
                          }`}
                        >
                          Patvirtinta
                        </button>
                      </div>
                    )}
                  </div>
                  </div>
          {liveOpenNotice ? (
            <p className="text-sm text-gray-600 dark:text-gray-300" role="status">
              {liveOpenNotice}
            </p>
          ) : null}

          <div className="space-y-2">
                  <div>
                    <div className="mb-2 flex items-center gap-2">
                      <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Transliacijų laikotarpis
                      </label>
                      {!isAgency && (
                        <button
                          type="button"
                          onClick={() => {
                            setBillingPeriodsPanelOpen((open) => {
                              const nextOpen = !open;
                              if (!nextOpen && billingPeriods.length === 0) {
                                setCustomBillingPeriodsEnabled(false);
                              }
                              return nextOpen;
                            });
                          }}
                          className={`inline-flex items-center rounded-md p-1 transition-colors ${
                            customBillingPeriodsEnabled || billingPeriodsPanelOpen
                              ? 'bg-amber-100 text-amber-700 hover:bg-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:hover:bg-amber-900/50'
                              : 'text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:text-gray-500 dark:hover:bg-gray-700 dark:hover:text-gray-300'
                          }`}
                          title="Nestandartinis sąskaitavimas — keli aktyvūs periodai"
                          aria-label="Nestandartinis sąskaitavimas"
                          aria-pressed={billingPeriodsPanelOpen}
                        >
                          <ArrowsRightLeftIcon className="h-4 w-4" />
                        </button>
                      )}
                      {!isAgency && (
                        <button
                          type="button"
                          onClick={() => setSpecOrderPanelOpen((open) => !open)}
                          className={`inline-flex items-center rounded-md p-1 transition-colors ${
                            isSpecOrder || specOrderPanelOpen
                              ? 'bg-amber-100 text-amber-700 hover:bg-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:hover:bg-amber-900/50'
                              : 'text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:text-gray-500 dark:hover:bg-gray-700 dark:hover:text-gray-300'
                          }`}
                          title="Spec. užsakymas — rankinė kaina"
                          aria-label="Spec. užsakymas"
                          aria-pressed={specOrderPanelOpen}
                        >
                          <BanknotesIcon className="h-4 w-4" />
                        </button>
                      )}
                    </div>
              <div className="flex items-center space-x-2">
                <input
                  type="text"
                  value={formData.from ? formatDateForDisplay(formData.from) : ''}
                  onChange={(e) => handleInputChange('from', e.target.value)}
                  pattern="\d{4}-\d{2}-\d{2}"
                  placeholder="yyyy-mm-dd"
                  readOnly={isAgency}
                  className={`flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white ${readOnlyFieldClass}`}
                />
                <span className="text-gray-500">→</span>
                    <input
                      type="text"
                      value={formData.to ? formatDateForDisplay(formData.to) : ''}
                      onChange={(e) => handleInputChange('to', e.target.value)}
                      pattern="\d{4}-\d{2}-\d{2}"
                      placeholder="yyyy-mm-dd"
                  readOnly={isAgency}
                  className={`flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white ${readOnlyFieldClass}`}
                    />
                  </div>
                  </div>

                        <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
              <div className="text-sm text-gray-900 dark:text-white">
                <span className="font-normal">Savaitės:</span> <span className="font-semibold">{weeksDisplay}</span>
              </div>
            </div>

            {!isAgency && specOrderPanelOpen && (
              <OrderSpecPriceSection
                enabled={isSpecOrder}
                price={formData.final_price ?? 0}
                onEnabledChange={(enabled) => {
                  setIsSpecOrder(enabled);
                  if (!enabled && order) {
                    setFormData((prev) => ({
                      ...prev,
                      final_price: resolveOrderPrice(order) || 0,
                    }));
                  }
                }}
                onPriceChange={(price) => handleInputChange('final_price', price)}
                onClose={() => setSpecOrderPanelOpen(false)}
                onDisable={() => {
                  if (order) {
                    setFormData((prev) => ({
                      ...prev,
                      final_price: resolveOrderPrice(order) || 0,
                    }));
                  }
                }}
              />
            )}
              </div>


                {formData.from && formData.to && formData.final_price && !customBillingPeriodsEnabled && (
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                    <p className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-[5px]">
                      Sumų pasiskirstymas:
                    </p>
                    <div className="space-y-2">
                      {(() => {
                        const distribution = calculateMonthlyDistribution(formData.from, formData.to, formData.final_price);
                        return distribution.map((month) => (
                          <div key={`${month.year}-${month.month}`} className="text-sm text-gray-900 dark:text-white">
                            {month.monthName.charAt(0).toUpperCase() + month.monthName.slice(1)} {month.year} ({month.days} d.) → {month.amount.toFixed(2)}€
                          </div>
                        ));
                      })()}
                      <div className="pt-3 border-t border-gray-200 dark:border-gray-600">
                        <div className="text-sm text-gray-900 dark:text-white flex items-center">
                          <span className="font-normal">Viso:</span>{' '}
                          <span className="font-semibold">{formData.final_price?.toFixed(2)}€</span>
                          {quote && (
                            <button
                              onClick={() => {
                                const url = order?.viaduct ? quote.viaduct_link : quote.link;
                                window.open(url, '_blank');
                              }}
                              className="ml-2 text-gray-400 hover:text-gray-600 transition-colors"
                              title="Atidaryti skaičiuoklę"
                            >
                              🔗
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {scheduleOrder && !isAgency && billingPeriodsPanelOpen && (
                  <OrderBillingPeriodsSection
                    order={scheduleOrder}
                    enabled={customBillingPeriodsEnabled}
                    periods={billingPeriods}
                    onEnabledChange={setCustomBillingPeriodsEnabled}
                    onPeriodsChange={setBillingPeriods}
                    onClose={() => {
                      setBillingPeriodsPanelOpen(false);
                      if (billingPeriods.length === 0) {
                        setCustomBillingPeriodsEnabled(false);
                      }
                    }}
                  />
                )}

                {scheduleOrder && isAgency && billingPeriods.length > 0 && (
                  <OrderBillingPeriodsReadOnly order={scheduleOrder} periods={billingPeriods} />
                )}

                {formData.from && formData.to && formData.final_price && customBillingPeriodsEnabled && (
                  <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                    <div className="text-sm text-gray-900 dark:text-white flex items-center">
                      <span className="font-normal">Viso:</span>{' '}
                      <span className="font-semibold">{formData.final_price?.toFixed(2)}€</span>
                      {quote && (
                        <button
                          type="button"
                          onClick={() => {
                            const url = order?.viaduct ? quote.viaduct_link : quote.link;
                            window.open(url, '_blank');
                          }}
                          className="ml-2 text-gray-400 hover:text-gray-600 transition-colors"
                          title="Atidaryti skaičiuoklę"
                        >
                          🔗
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {isAgency && (
                  <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      OTS pagal miestą
                    </p>
                    {otsLoading ? (
                      <p className="text-sm text-gray-500 dark:text-gray-400">Skaičiuojama...</p>
                    ) : cityOtsRows.length > 0 ? (
                      <div className="space-y-1">
                        {cityOtsRows.map((row) => (
                          <div
                            key={row.label}
                            className="text-sm text-gray-900 dark:text-white"
                          >
                            <span className="inline-flex items-baseline gap-2 flex-wrap">
                              <span>
                                {row.label}
                                <span className="text-gray-500 dark:text-gray-400 font-normal">
                                  {' '}
                                  ({row.screenCount} ekr.)
                                </span>
                              </span>
                              <span className="tabular-nums">
                                {formatOts(row.ots)}
                              </span>
                            </span>
                          </div>
                        ))}
                        <div className="pt-3 mt-2 border-t border-gray-200 dark:border-gray-600">
                          <span className="inline-flex items-baseline gap-2 text-sm text-gray-900 dark:text-white">
                            <span className="font-bold">Bendra OTS:</span>
                            <span className="font-bold tabular-nums">
                              {formatOts(cityOtsRows.reduce((sum, row) => sum + row.ots, 0))}
                            </span>
                          </span>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500 dark:text-gray-400">OTS duomenų nėra</p>
                    )}
                  </div>
                )}

                <div className="rounded-lg border border-dashed border-emerald-300/70 bg-gray-50 p-4 dark:border-emerald-700/60 dark:bg-gray-700/80">
                  <div className="mb-3">
                    <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white">
                      <TableCellsIcon className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                      Reklamos planas ir klipai
                    </h3>
                    <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                      {isAgency
                        ? 'Excel parsisiunčiamas iš užsakymo duomenų'
                        : 'Vienas laiškas owneriams: Excel planas + video nuoroda'}
                    </p>
                  </div>

                  {exportError && (
                    <p className="mb-3 rounded-md bg-red-50 px-3 py-2 text-xs text-red-800 dark:bg-red-950/50 dark:text-red-200">
                      {exportError}
                    </p>
                  )}

                  <div className="flex flex-wrap gap-2">
                    {!isAgency && formData.approved && (
                      <button
                        type="button"
                        onClick={() => setAtaskaitaOpen(true)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-amber-200/90 bg-white px-3 py-1.5 text-sm font-medium text-amber-900 transition-colors hover:bg-amber-50 dark:border-amber-800 dark:bg-gray-800 dark:text-amber-200 dark:hover:bg-amber-950/30"
                        title="Parodymų ataskaita — Piksel ekranai (Panorama = realūs)"
                      >
                        <ChartBarIcon className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                        Ataskaita
                      </button>
                    )}
                    {exportPartnersLoading && !isAgency ? (
                      <p className="self-center text-sm text-gray-500 dark:text-gray-400">
                        Kraunami partneriai…
                      </p>
                    ) : (
                      <>
                        {!isAgency &&
                          exportPartners.map((partner) => {
                            const isExporting = exportingPartnerId === partner.id;
                            const delivery = partnerDeliveryById[partner.id];
                            const confirmed = Boolean(
                              delivery?.plan?.confirmed || delivery?.clips?.confirmed
                            );
                            const sent = Boolean(
                              delivery?.plan?.sent || delivery?.clips?.sent
                            );
                            const deliveryClass = confirmed
                              ? 'border-emerald-200/90 bg-emerald-50 text-emerald-900 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-100'
                              : sent
                                ? 'border-amber-200/90 bg-amber-50 text-amber-950 hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100'
                                : 'border-gray-200/90 bg-white text-gray-800 hover:bg-sky-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-sky-950/30';
                            return (
                              <button
                                key={partner.id}
                                type="button"
                                disabled={
                                  !!exportingPartnerId ||
                                  exportingCombined ||
                                  sendingPartnerPlans
                                }
                                onClick={() => handlePartnerPlanExcelExport(partner)}
                                className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-50 ${deliveryClass}`}
                                title={`${partner.name}: atsisiųsti Excel (${partner.screenCount} ekr.)`}
                              >
                                {isExporting ? (
                                  <span className="h-4 w-4 shrink-0 animate-pulse rounded-full bg-sky-400" />
                                ) : (
                                  <ArrowDownTrayIcon className="h-4 w-4 shrink-0 text-sky-600 dark:text-sky-400" />
                                )}
                                <span>{partner.name}</span>
                                {isExporting && (
                                  <span className="text-xs text-gray-500">…</span>
                                )}
                                <span className="text-xs opacity-60">
                                  ({partner.screenCount})
                                </span>
                              </button>
                            );
                          })}
                        <button
                          type="button"
                          disabled={
                            !!exportingPartnerId ||
                            exportingCombined ||
                            sendingPartnerPlans
                          }
                          onClick={handleCombinedPlanExcelExport}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-violet-200/90 bg-white px-3 py-1.5 text-sm font-medium text-violet-800 transition-colors hover:bg-violet-50 disabled:opacity-50 dark:border-violet-800 dark:bg-gray-800 dark:text-violet-200 dark:hover:bg-violet-950/30"
                          title={
                            isAgency
                              ? 'Atsisiųsti Excel'
                              : 'Visi tiekėjai viename Excel faile'
                          }
                        >
                          {exportingCombined ? (
                            <span className="h-4 w-4 shrink-0 animate-pulse rounded-full bg-violet-400" />
                          ) : (
                            <ArrowDownTrayIcon className="h-4 w-4 shrink-0 text-violet-600 dark:text-violet-400" />
                          )}
                          {isAgency ? '.xls' : 'Bendras'}
                          {exportingCombined && (
                            <span className="text-xs text-gray-500">…</span>
                          )}
                        </button>
                      </>
                    )}
                  </div>

                  {!isAgency && (
                    <div className="mt-3 space-y-2">
                      <input
                        type="url"
                        value={clipsUrl}
                        onChange={(e) => setClipsUrl(e.target.value)}
                        placeholder="https://we.tl/… video nuoroda"
                        className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-200 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                      />
                      <textarea
                        value={deliveryNote}
                        onChange={(e) => setDeliveryNote(e.target.value)}
                        maxLength={2000}
                        rows={3}
                        placeholder={
                          'Pastaba owneriams (neprivaloma), pvz.:\nX klipas 08.09–09.01\nY klipas 09.02–10.01'
                        }
                        className="w-full resize-y rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-200 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                      />
                      <div className="flex justify-end">
                        <button
                          type="button"
                          disabled={
                            !!exportingPartnerId ||
                            exportingCombined ||
                            sendingPartnerPlans ||
                            exportPartners.length === 0 ||
                            !clipsUrl.trim()
                          }
                          onClick={() => void handleSendPartnerPackage()}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-900 bg-white px-3 py-1.5 text-sm font-medium text-gray-900 transition-colors hover:bg-gray-50 disabled:opacity-50 dark:border-gray-200 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700"
                          title="Siųsti planą ir klipus visiems owneriams (be Piksel)"
                        >
                          {sendingPartnerPlans ? (
                            <span className="h-4 w-4 shrink-0 animate-pulse rounded-full bg-gray-400" />
                          ) : (
                            <PaperAirplaneIcon className="h-4 w-4 shrink-0" />
                          )}
                          Siųsti
                          {sendingPartnerPlans && (
                            <span className="text-xs text-gray-500">…</span>
                          )}
                        </button>
                      </div>
                    </div>
                  )}
                </div>


          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Komentaras
              </label>
              <div
                contentEditable
                onInput={(e) => setNewComment(e.currentTarget.textContent || '')}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleAddComment();
                  }
                }}
                onPaste={handlePaste}
                data-placeholder={
                  isAgency
                    ? 'Rašykite komentarą... (Enter - išsaugoti, Cmd+V - paveikslėlis)'
                    : 'Įveskite komentarą... (Enter - išsaugoti, Cmd+V - paveikslėlis)'
                }
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white h-24 resize-none min-h-[6rem] overflow-y-auto"
                style={{ whiteSpace: 'pre-wrap' }}
              />

              {comments.length > 0 && (
                <div className="mt-4 space-y-2">
                  {comments.map((comment) => (
                    <div key={comment.id} className="bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <div className="text-sm text-gray-600 dark:text-gray-400">
                          {new Date(comment.created_at).toLocaleString('lt-LT')}
                        </div>
                        <div className="flex items-center gap-3 text-xs">
                          {editingCommentId === comment.id ? (
                            <>
                              <button
                                type="button"
                                onClick={() => handleSaveEditedComment(comment.id)}
                                className="text-blue-600 hover:text-blue-800"
                              >
                                Išsaugoti
                              </button>
                              <button
                                type="button"
                                onClick={handleCancelEditComment}
                                className="text-gray-600 hover:text-gray-800"
                              >
                                Atšaukti
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleStartEditComment(comment)}
                              className="text-blue-600 hover:text-blue-800"
                            >
                              Redaguoti
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleDeleteComment(comment.id)}
                            className="text-red-600 hover:text-red-800"
                          >
                            Ištrinti
                          </button>
                        </div>
                      </div>
                      {editingCommentId === comment.id ? (
                        <textarea
                          value={editingCommentText}
                          onChange={(e) => setEditingCommentText(e.target.value)}
                          rows={3}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white"
                        />
                      ) : (
                        <div className="text-sm text-gray-900 dark:text-white whitespace-pre-wrap">
                          {comment.text}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-4">
              <div>
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Printscreens ir Excel
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      ref={attachmentInputRef}
                      type="file"
                      className="hidden"
                      accept="image/*,.xls,.xlsx,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                      multiple
                      onChange={handleAttachmentFileChange}
                    />
                    <button
                      type="button"
                      disabled={attachmentUploading}
                      onClick={() => attachmentInputRef.current?.click()}
                      className="text-xs px-2 py-1 rounded border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50"
                    >
                      {attachmentUploading ? 'Įkeliama…' : 'Prisegti failą'}
                    </button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {pendingPrintscreens.map((printscreen) => (
                    <div key={printscreen.id} className="relative">
                      {printscreen.file_type?.startsWith('image/') ? (
                        <Image
                          src={printscreen.file_url}
                          alt="Printscreen"
                          width={64}
                          height={64}
                          className="w-16 h-16 object-cover rounded border cursor-pointer hover:opacity-80"
                          onClick={() => handlePrintscreenView(printscreen)}
                        />
                      ) : (
                        <button
                          type="button"
                          onClick={() => handlePrintscreenView(printscreen)}
                          title={printscreen.filename}
                          className="w-16 h-16 flex flex-col items-center justify-center gap-0.5 rounded border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/30 text-green-800 dark:text-green-200 hover:opacity-90"
                        >
                          <TableCellsIcon className="w-6 h-6 shrink-0" aria-hidden />
                          <span className="text-[9px] leading-tight px-0.5 max-w-[4rem] truncate">
                            {isSpreadsheetAttachment(printscreen)
                              ? printscreen.filename.replace(/\.[^.]+$/, '')
                              : printscreen.filename}
                          </span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            await SupabaseService.deleteFile(printscreen.id);
                            setPendingPrintscreens((prev) =>
                              prev.filter((p) => p.id !== printscreen.id)
                            );
                            setPrintScreens((prev) => prev.filter((p) => p.id !== printscreen.id));
                          } catch {
                            console.error('Error deleting printscreen');
                          }
                        }}
                        className="absolute -top-1 -right-1 w-4 h-4 bg-black text-white rounded-full text-xs hover:bg-gray-800 flex items-center justify-center"
                      >
                        ×
                      </button>
                    </div>
                  ))}

                  {printScreens.map((printscreen) => (
                    <div key={printscreen.id} className="relative">
                      {printscreen.file_type?.startsWith('image/') ? (
                        <Image
                          src={printscreen.file_url}
                          alt="Printscreen"
                          width={64}
                          height={64}
                          className="w-16 h-16 object-cover rounded border cursor-pointer hover:opacity-80"
                          onClick={() => handlePrintscreenView(printscreen)}
                        />
                      ) : (
                        <button
                          type="button"
                          onClick={() => handlePrintscreenView(printscreen)}
                          title={printscreen.filename}
                          className="w-16 h-16 flex flex-col items-center justify-center gap-0.5 rounded border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/30 text-green-800 dark:text-green-200 hover:opacity-90"
                        >
                          <TableCellsIcon className="w-6 h-6 shrink-0" aria-hidden />
                          <span className="text-[9px] leading-tight px-0.5 max-w-[4rem] truncate">
                            {isSpreadsheetAttachment(printscreen)
                              ? printscreen.filename.replace(/\.[^.]+$/, '')
                              : printscreen.filename}
                          </span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            await SupabaseService.deleteFile(printscreen.id);
                            setPrintScreens((prev) => prev.filter((p) => p.id !== printscreen.id));
                          } catch {
                            console.error('Error deleting printscreen');
                          }
                        }}
                        className="absolute -top-1 -right-1 w-4 h-4 bg-black text-white rounded-full text-xs hover:bg-gray-800 flex items-center justify-center"
                      >
                        ×
                      </button>
                    </div>
                  ))}

                  {pendingPrintscreens.length === 0 && printScreens.length === 0 && (
                    <div className="text-sm text-gray-400 italic">
                      Prisegti failą arba Cmd+V į komentaro lauką įklijuoti paveikslėlį
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Data
              </label>
              <input
                type="date"
                value={reminderDate}
                onChange={(e) => setReminderDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Priminimo žinutė
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={reminderMessage}
                  onChange={(e) => setReminderMessage(e.target.value)}
                  placeholder="Įveskite priminimo žinutę..."
                  className="flex-1 min-w-0 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
                <button
                  type="button"
                  onClick={handleAddReminder}
                  className={modalBtnInline}
                >
                  Pridėti
                </button>
              </div>
            </div>
          </div>

          {reminders.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Priminimai</h3>
              <div className="space-y-2">
                {reminders.map((reminder) => (
                  <div
                    key={reminder.id}
                    className="bg-gray-50 dark:bg-gray-700 p-3 rounded-lg flex items-center justify-between"
                  >
                    <div>
                      <div className="text-sm font-medium text-gray-900 dark:text-white">
                        {new Date(reminder.due_date).toLocaleDateString('lt-LT')}
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">{reminder.title}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteReminder(reminder.id)}
                      className="text-red-600 hover:text-red-800 text-sm"
                    >
                      Ištrinti
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
          </>
          ) : null}
        </div>
        </div>

        <div className={`flex shrink-0 items-center gap-3 p-6 border-t border-gray-200 dark:border-gray-700 ${isAgency ? 'justify-end' : 'justify-between'}`}>
          {!isAgency && (
          <div className="relative" ref={deleteConfirmRef}>
            <button
              type="button"
              onClick={() => setDeleteConfirmOpen((open) => !open)}
              disabled={deleting}
              className={modalBtnDanger}
            >
              Ištrinti
            </button>
            {deleteConfirmOpen && (
              <div className="absolute bottom-full left-0 z-30 mb-2 w-64 rounded-xl border border-gray-200 bg-white p-3 shadow-xl dark:border-gray-700 dark:bg-gray-900">
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  Ar tikrai ištrinti šį užsakymą?
                </p>
                <div className="mt-3 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setDeleteConfirmOpen(false)}
                    disabled={deleting}
                    className={modalBtnSecondary}
                  >
                    Atšaukti
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDelete()}
                    disabled={deleting}
                    className="px-4 py-2 text-sm font-medium rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
                  >
                    {deleting ? 'Trinama...' : 'Ištrinti'}
                  </button>
                </div>
              </div>
            )}
          </div>
          )}
          
          <div className="flex gap-2 sm:gap-3 ml-auto">
            <button
              type="button"
              onClick={onClose}
              className={modalBtnSecondary}
            >
              Uždaryti
            </button>
            {!isAgency && (
            <button
              type="button"
              onClick={handleSave}
              disabled={loading}
              className={modalBtnPrimary}
            >
              {loading ? 'Išsaugoma...' : 'Išsaugoti'}
            </button>
            )}
          </div>
        </div>
      </div>
      </div>
    </div>
    <OrderAtaskaitaModal
      isOpen={ataskaitaOpen}
      order={order}
      onClose={() => setAtaskaitaOpen(false)}
    />
    </>
  );
}