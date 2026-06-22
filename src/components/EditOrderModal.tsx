'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  XMarkIcon,
  ClipboardDocumentIcon,
  TableCellsIcon,
  ArrowDownTrayIcon,
  CheckCircleIcon,
  DocumentTextIcon,
  PaperAirplaneIcon,
  PhotoIcon,
  PlusCircleIcon,
} from '@heroicons/react/24/outline';
import {
  downloadReklamosPlanas,
  downloadReklamosPlanasCombined,
  downloadReklamosPlanasZip,
} from '@/lib/export-reklamos-planas';
import {
  toCampaignOrderInput,
  toCampaignScreen,
} from '@/lib/reklamos-planas-data';
import Image from 'next/image';
import { Order, Comment, Reminder, FileAttachment } from '@/types';
import { PocketBaseService } from '@/lib/pocketbase';
import { SupabaseService } from '@/lib/supabase-service';
import { formatDateInputValue, parseDateOnlyLocal } from '@/lib/date-utils';
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

interface EditOrderModalProps {
  order: Order | null;
  isOpen: boolean;
  onClose: () => void;
  onOrderUpdated?: (order: Order) => void;
  onGenerateInvoice?: (order: Order) => void;
  variant?: 'internal' | 'agency';
}

type OrderExportPartner = {
  id: string;
  name: string;
  slug: string;
  screenCount: number;
};

export function EditOrderModal({
  order,
  isOpen,
  onClose,
  onOrderUpdated,
  onGenerateInvoice,
  variant = 'internal',
}: EditOrderModalProps) {
  const isAgency = variant === 'agency';
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
  const [exportPartners, setExportPartners] = useState<OrderExportPartner[]>([]);
  const [exportPartnersLoading, setExportPartnersLoading] = useState(false);
  const [exportingPartnerId, setExportingPartnerId] = useState<string | null>(null);
  const [exportingCombined, setExportingCombined] = useState(false);
  const [exportingAllZip, setExportingAllZip] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [cityOtsRows, setCityOtsRows] = useState<CityOtsRow[]>([]);
  const [otsLoading, setOtsLoading] = useState(false);
  const attachmentInputRef = useRef<HTMLInputElement>(null);

  const loadQuote = useCallback(async () => {
    if (!order) return;
    
    try {
      // Prefer real order ID and keep invoice fallback for legacy quote records.
      const quoteData =
        await PocketBaseService.getQuoteByOrderId(order.id) ??
        await PocketBaseService.getQuoteByOrderId(order.invoice_id);
      setQuote(quoteData);
    } catch {
      console.log('No quote found for order:', order.id, order.invoice_id);
    }
  }, [order]);

  useEffect(() => {
    if (order) {
      setFormData({
        client: order.client,
        agency: order.agency,
        invoice_id: order.invoice_id,
        from: order.from,
        to: order.to,
        final_price: order.final_price || 0,
        approved: order.approved,
        media_received: order.media_received,
        viaduct: order.viaduct,
      });
      
      loadQuote();
    }
  }, [order, loadQuote]);

  useEffect(() => {
    if (!isOpen || !order || isAgency) {
      setExportPartners([]);
      return;
    }

    let cancelled = false;

    const loadExportPartners = async () => {
      setExportPartnersLoading(true);
      try {
        let screenIds = [...new Set(order.screens?.filter(Boolean) || [])];
        if (screenIds.length === 0) {
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
  }, [isOpen, order, isAgency]);

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

  const loadInvoiceStatus = useCallback(async () => {
    if (!order) return;

    try {
      const statusMap = await SupabaseService.getInvoiceStatuses([order.id]);
      const status = statusMap[order.id];
      setInvoiceStatus({
        invoice_issued: status?.invoice_issued ?? !!order.invoice_sent,
        invoice_sent: status?.invoice_sent ?? false,
      });
    } catch (error) {
      console.error('Error loading invoice status:', error);
      setInvoiceStatus({ invoice_issued: !!order.invoice_sent, invoice_sent: false });
    }
  }, [order]);

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
  }, [order, isOpen, isAgency, loadComments, loadReminders, loadPrintScreens, loadInvoiceStatus]);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  const handleInputChange = (field: keyof Order, value: string | number | boolean) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSave = async () => {
    if (!order) return;
    
    setLoading(true);
    try {
      const nextApproved =
        typeof formData.approved === 'boolean' ? formData.approved : order.approved;
      const wasApproved = !!order.approved;
      const orderPayload = { ...formData };
      delete orderPayload.invoice_sent;
      const updatedOrder = await PocketBaseService.updateOrder(order.id, orderPayload);

      try {
        await SupabaseService.upsertInvoiceStatus(order.id, {
          invoice_issued: invoiceStatus.invoice_issued,
          invoice_sent: invoiceStatus.invoice_sent,
        });
      } catch (invoiceError) {
        // Do not block order save if Supabase invoice status is temporarily unavailable.
        console.error('Failed to save invoice status:', invoiceError);
      }

      // Track approval moment in Supabase when status changes from not approved to approved.
      if (!wasApproved && nextApproved) {
        try {
          await SupabaseService.addApprovalEvent({
            order_id: updatedOrder.id,
            snapshot_client: updatedOrder.client,
            snapshot_amount: updatedOrder.final_price,
          });
        } catch (approvalError) {
          // Do not block order updates if Supabase approval events are not configured yet.
          console.error('Failed to save approval event:', approvalError);
        }
      }

      onOrderUpdated?.(updatedOrder);
      onClose();
    } catch {
      console.error('Error updating order');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!order) return;
    
    if (confirm('Ar tikrai norite ištrinti šį užsakymą?')) {
      try {
        await PocketBaseService.deleteOrder(order.id);
        onOrderUpdated?.(order);
        onClose();
      } catch {
        console.error('Error deleting order');
      }
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
    } catch {
      console.error('Error adding comment');
      const tempComment = {
        id: `temp-${Date.now()}`,
        text: newComment.trim(),
        created_at: new Date().toISOString(),
        order_id: order.id
      } as Comment;
      
      setComments(prev => [tempComment, ...prev]);
      setNewComment('');
      
      const contentEditableElement = document.querySelector('[contenteditable="true"]') as HTMLElement;
      if (contentEditableElement) {
        contentEditableElement.textContent = '';
      }
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

  const handleAllPartnersZipExport = async () => {
    if (!order || exportPartners.length === 0) return;
    setExportError(null);
    setExportingAllZip(true);
    try {
      const { campaignOrder, screens, bundles } = await loadCampaignExportData(
        order.id
      );
      await downloadReklamosPlanasZip({
        order: campaignOrder,
        screens,
        bundles,
        partners: exportPartners.map((p) => ({
          id: p.id,
          name: p.name,
        })),
      });
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'Nepavyko sugeneruoti ZIP archyvo';
      setExportError(message);
    } finally {
      setExportingAllZip(false);
    }
  };

  if (!isOpen || !order) return null;

  return (
    <div 
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      role="dialog"
      aria-modal="true"
    >
      <div
        className={`bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-h-[90vh] overflow-y-auto ${
          isAgency ? 'max-w-[45rem]' : 'max-w-4xl'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{order.client}</h2>
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
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Media</span>
              <StatusIconButton
                active={!!formData.media_received}
                label={formData.media_received ? 'Media gauta' : 'Media negauta'}
                icon={PhotoIcon}
                activeTone="green"
                disabled={isAgency}
                onClick={() => handleInputChange('media_received', !formData.media_received)}
              />
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Sąskaita</span>
              <div className="flex items-center gap-0.5">
                <StatusIconButton
                  active={invoiceStatus.invoice_issued}
                  label={
                    invoiceStatus.invoice_issued
                      ? 'Sąskaita išrašyta'
                      : 'Sąskaita neišrašyta'
                  }
                  icon={DocumentTextIcon}
                  disabled={isAgency}
                  onClick={() =>
                    setInvoiceStatus((prev) => ({ ...prev, invoice_issued: !prev.invoice_issued }))
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
                  invoiceStatus.invoice_sent
                    ? 'Sąskaita išsiųsta'
                    : 'Sąskaita neišsiųsta'
                }
                icon={PaperAirplaneIcon}
                onClick={() =>
                  setInvoiceStatus((prev) => ({ ...prev, invoice_sent: !prev.invoice_sent }))
                }
              />
            </div>
            )}
            
          <button
              type="button"
            onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 transition-colors ml-4"
          >
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>
        </div>

        <div className="p-6 space-y-3">
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
                            ? 'border-green-300 bg-green-50 text-green-800 dark:bg-green-900/30 dark:border-green-700 dark:text-green-200'
                            : 'border-amber-300 bg-amber-50 text-amber-800 dark:bg-amber-900/30 dark:border-amber-700 dark:text-amber-200'
                        }`}
                      >
                        {formData.approved && (
                          <CheckCircleIcon className="w-5 h-5 text-green-600 dark:text-green-400 shrink-0" />
                        )}
                        <span className="text-sm font-medium">
                          {formData.approved ? 'Patvirtinta' : 'Nepatvirtinta'}
                        </span>
                      </div>
                    ) : (
                      <select
                        value={formData.approved ? 'taip' : 'ne'}
                        onChange={(e) => handleInputChange('approved', e.target.value === 'taip')}
                        className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 dark:text-white ${readOnlyFieldClass} ${
                          formData.approved
                            ? 'border-emerald-200 bg-emerald-50/70 dark:border-emerald-900/50 dark:bg-emerald-950/25'
                            : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700'
                        }`}
                      >
                        <option value="ne">Nepatvirtinta</option>
                        <option value="taip">Patvirtinta</option>
                      </select>
                    )}
                  </div>
                  </div>

          <div className="space-y-2">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Transliacijų laikotarpis
                    </label>
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
              </div>


                {formData.from && formData.to && formData.final_price && (
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
                          <span className="font-normal">Viso:</span> <span className="font-semibold">{formData.final_price?.toFixed(2)}€</span>
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
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div>
                      <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white">
                        <TableCellsIcon className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                        Reklamos planas
                      </h3>
                      <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                        Excel parsisiunčiamas iš užsakymo duomenų
                      </p>
                    </div>
                  </div>

                  {exportError && (
                    <p className="mb-3 rounded-md bg-red-50 px-3 py-2 text-xs text-red-800 dark:bg-red-950/50 dark:text-red-200">
                      {exportError}
                    </p>
                  )}

                  {exportPartnersLoading && !isAgency ? (
                    <p className="text-sm text-gray-500 dark:text-gray-400">Kraunami partneriai…</p>
                  ) : !isAgency && exportPartners.length === 0 ? (
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Šiame užsakyme nėra ekranų — partnerių eksportui nerasta.
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {!isAgency &&
                      exportPartners.map((partner) => {
                        const isExporting = exportingPartnerId === partner.id;
                        return (
                          <button
                            key={partner.id}
                            type="button"
                            disabled={
                              !!exportingPartnerId ||
                              exportingCombined ||
                              exportingAllZip
                            }
                            onClick={() => handlePartnerPlanExcelExport(partner)}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200/90 bg-white px-3 py-1.5 text-sm font-medium text-gray-800 transition-colors hover:bg-sky-50 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-sky-950/30"
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
                            <span className="text-xs text-gray-400 dark:text-gray-500">
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
                          exportingAllZip
                        }
                        onClick={handleCombinedPlanExcelExport}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-violet-200/90 bg-white px-3 py-1.5 text-sm font-medium text-violet-800 transition-colors hover:bg-violet-50 disabled:opacity-50 dark:border-violet-800 dark:bg-gray-800 dark:text-violet-200 dark:hover:bg-violet-950/30"
                        title={isAgency ? 'Atsisiųsti Excel' : 'Visi tiekėjai viename Excel faile'}
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
                      {!isAgency && (
                      <button
                        type="button"
                        disabled={
                          !!exportingPartnerId ||
                          exportingCombined ||
                          exportingAllZip ||
                          exportPartners.length === 0
                        }
                        onClick={handleAllPartnersZipExport}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200/90 bg-white px-3 py-1.5 text-sm font-medium text-emerald-800 transition-colors hover:bg-emerald-50 disabled:opacity-50 dark:border-emerald-800 dark:bg-gray-800 dark:text-emerald-200 dark:hover:bg-emerald-950/30"
                        title={`Atsisiųsti visų tiekėjų Excel failus viename ZIP (${exportPartners.length})`}
                      >
                        {exportingAllZip ? (
                          <span className="h-4 w-4 shrink-0 animate-pulse rounded-full bg-emerald-400" />
                        ) : (
                          <ArrowDownTrayIcon className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                        )}
                        ZIP
                        {exportingAllZip && (
                          <span className="text-xs text-gray-500">…</span>
                        )}
                      </button>
                      )}
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
        </div>

        <div className={`flex items-center gap-3 p-6 border-t border-gray-200 dark:border-gray-700 ${isAgency ? 'justify-end' : 'justify-between'}`}>
          {!isAgency && (
          <button
            type="button"
            onClick={handleDelete}
            className={modalBtnDanger}
          >
            Ištrinti
          </button>
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
  );
}