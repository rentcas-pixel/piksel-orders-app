'use client';

import { useEffect, useRef, useState } from 'react';
import {
  fetchReceivedInvoiceFileBlob,
  isImageFileName,
  isPdfFileName,
} from '@/lib/received-invoice-file';
import type { ReceivedInvoice } from '@/types';

function useInvoicePreviewBlob(invoice: ReceivedInvoice | null) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [mimeType, setMimeType] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!invoice?.file_url) {
      setPreviewUrl(null);
      setMimeType(null);
      setLoading(false);
      setError(false);
      return;
    }

    let cancelled = false;
    let objectUrl: string | null = null;

    const load = async () => {
      setLoading(true);
      setError(false);
      setPreviewUrl(null);
      setMimeType(null);

      try {
        const blob = await fetchReceivedInvoiceFileBlob(invoice);
        objectUrl = URL.createObjectURL(blob);
        const mime = blob.type;
        if (!cancelled) {
          setPreviewUrl(objectUrl);
          setMimeType(mime);
        }
      } catch {
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [invoice?.id, invoice?.file_url, invoice?.file_name]);

  return { previewUrl, mimeType, loading, error };
}

interface ReceivedInvoiceFilePreviewProps {
  invoice: ReceivedInvoice;
}

export function ReceivedInvoiceFilePreview({ invoice }: ReceivedInvoiceFilePreviewProps) {
  const { previewUrl, mimeType, loading, error } = useInvoicePreviewBlob(invoice);
  const isImage = mimeType?.startsWith('image/') ?? isImageFileName(invoice.file_name);
  const isPdf = mimeType === 'application/pdf' || isPdfFileName(invoice.file_name);

  return (
    <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-2xl dark:border-gray-600 dark:bg-gray-900">
      <div className="border-b border-gray-200 px-3 py-2 text-xs text-gray-500 dark:border-gray-700 dark:text-gray-400">
        <div className="truncate font-medium text-gray-800 dark:text-gray-200">
          {invoice.file_name ?? 'Sąskaitos failas'}
        </div>
        <div className="truncate">
          {invoice.seller_name}
          {invoice.invoice_number ? ` · ${invoice.invoice_number}` : ''}
        </div>
      </div>
      <div className="flex min-h-[320px] max-h-[70vh] items-center justify-center bg-gray-100 p-2 dark:bg-gray-950">
        {loading ? (
          <span className="text-sm text-gray-500">Kraunama…</span>
        ) : error || !previewUrl ? (
          <a
            href={invoice.file_url ?? '#'}
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-8 text-center text-sm text-blue-600 hover:underline dark:text-blue-400"
          >
            Nepavyko parodyti peržiūros.
            <br />
            Atidaryti failą naujame lange
          </a>
        ) : isImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={previewUrl}
            alt={invoice.file_name ?? 'Sąskaita'}
            className="max-h-[68vh] max-w-[min(520px,42vw)] object-contain"
          />
        ) : isPdf ? (
          <iframe
            src={`${previewUrl}#toolbar=0&navpanes=0`}
            title={invoice.file_name ?? 'Sąskaitos PDF'}
            className="h-[68vh] w-[min(520px,42vw)] bg-white"
          />
        ) : (
          <a
            href={invoice.file_url ?? '#'}
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-8 text-sm text-blue-600 hover:underline dark:text-blue-400"
          >
            Atidaryti failą naujame lange
          </a>
        )}
      </div>
    </div>
  );
}

const SHOW_DELAY_MS = 300;
const HIDE_DELAY_MS = 150;

export function useReceivedInvoiceFilePreview() {
  const [previewInvoice, setPreviewInvoice] = useState<ReceivedInvoice | null>(null);
  const showTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pinned = useRef(false);

  useEffect(() => {
    return () => {
      if (showTimer.current) clearTimeout(showTimer.current);
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, []);

  const clearShowTimer = () => {
    if (showTimer.current) {
      clearTimeout(showTimer.current);
      showTimer.current = null;
    }
  };

  const clearHideTimer = () => {
    if (hideTimer.current) {
      clearTimeout(hideTimer.current);
      hideTimer.current = null;
    }
  };

  const showPreview = (invoice: ReceivedInvoice) => {
    if (!invoice.file_url) return;
    clearHideTimer();
    if (previewInvoice?.id === invoice.id) return;
    clearShowTimer();
    showTimer.current = setTimeout(() => {
      setPreviewInvoice(invoice);
    }, SHOW_DELAY_MS);
  };

  const hidePreview = () => {
    clearShowTimer();
    if (pinned.current) return;
    clearHideTimer();
    hideTimer.current = setTimeout(() => {
      setPreviewInvoice(null);
    }, HIDE_DELAY_MS);
  };

  const keepPreview = () => {
    clearHideTimer();
    pinned.current = true;
  };

  const releasePreview = () => {
    pinned.current = false;
    hidePreview();
  };

  return {
    previewInvoice,
    showPreview,
    hidePreview,
    keepPreview,
    releasePreview,
  };
}

interface ReceivedInvoicePreviewOverlayProps {
  invoice: ReceivedInvoice | null;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}

export function ReceivedInvoicePreviewOverlay({
  invoice,
  onMouseEnter,
  onMouseLeave,
}: ReceivedInvoicePreviewOverlayProps) {
  if (!invoice?.file_url) return null;

  return (
    <div
      className="pointer-events-auto fixed right-6 top-24 z-[70] hidden lg:block"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <ReceivedInvoiceFilePreview invoice={invoice} />
    </div>
  );
}
