'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import {
  BATCH_IMPORT_MAX_FILES,
  createBatchItems,
  runBatchImport,
  type BatchImportItem,
  type BatchItemStatus,
} from '@/lib/received-invoice-batch';
import { formatEuro } from '@/lib/invoice-utils';
import { modalBtnPrimary, modalBtnSecondary } from '@/lib/portal-ui';

interface ReceivedInvoicesBatchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCompleted?: () => void;
}

function statusLabel(status: BatchItemStatus): string {
  switch (status) {
    case 'queued':
      return 'Laukia';
    case 'scanning':
      return 'Skaitoma…';
    case 'saving':
      return 'Saugoma…';
    case 'created':
      return 'Sukurta';
    case 'updated':
      return 'Atnaujinta';
    case 'error':
      return 'Klaida';
  }
}

function statusClass(status: BatchItemStatus): string {
  switch (status) {
    case 'created':
      return 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200';
    case 'updated':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200';
    case 'error':
      return 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200';
    case 'scanning':
    case 'saving':
      return 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200';
    default:
      return 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200';
  }
}

export function ReceivedInvoicesBatchModal({
  isOpen,
  onClose,
  onCompleted,
}: ReceivedInvoicesBatchModalProps) {
  const [items, setItems] = useState<BatchImportItem[]>([]);
  const [running, setRunning] = useState(false);
  const cancelledRef = useRef(false);

  useEffect(() => {
    if (!isOpen) {
      cancelledRef.current = true;
      setItems([]);
      setRunning(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !running) onClose();
    };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose, running]);

  const onItemChange = useCallback((id: string, patch: Partial<BatchImportItem>) => {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }, []);

  const handleFilesSelected = (fileList: FileList | null) => {
    if (!fileList || running) return;
    const files = Array.from(fileList).filter((f) => {
      const name = f.name.toLowerCase();
      return name.endsWith('.pdf') || /\.(jpe?g|png|webp)$/i.test(name);
    });

    if (files.length === 0) {
      alert('Pasirinkite PDF arba nuotraukų failus.');
      return;
    }
    if (files.length > BATCH_IMPORT_MAX_FILES) {
      alert(`Galima įkelti daugiausiai ${BATCH_IMPORT_MAX_FILES} failų vienu metu.`);
      return;
    }

    setItems(createBatchItems(files));
  };

  const summary = useMemo(() => {
    const created = items.filter((i) => i.status === 'created').length;
    const updated = items.filter((i) => i.status === 'updated').length;
    const errors = items.filter((i) => i.status === 'error').length;
    const done = created + updated + errors;
    return { created, updated, errors, done, total: items.length };
  }, [items]);

  const handleStart = async () => {
    if (items.length === 0 || running) return;
    cancelledRef.current = false;
    setRunning(true);

    await runBatchImport({
      items,
      onItemChange,
      isCancelled: () => cancelledRef.current,
    });

    setRunning(false);
    onCompleted?.();
  };

  const handleCancel = () => {
    if (running) {
      cancelledRef.current = true;
      return;
    }
    onClose();
  };

  if (!isOpen) return null;

  const progressPercent =
    summary.total > 0 ? Math.round((summary.done / summary.total) * 100) : 0;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
      <div className="flex max-h-[95vh] w-full max-w-4xl flex-col overflow-hidden rounded-lg bg-white shadow-xl dark:bg-gray-800">
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4 dark:border-gray-700">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Masinis importas</h2>
            <p className="mt-1 text-sm text-gray-500">
              Įkelkite iki {BATCH_IMPORT_MAX_FILES} PDF arba nuotraukų — Mistral OCR nuskaitys ir
              išsaugos automatiškai.
            </p>
          </div>
          <button
            type="button"
            onClick={handleCancel}
            disabled={running}
            className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 disabled:opacity-50 dark:hover:bg-gray-700"
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        <div className="space-y-4 border-b border-gray-200 p-6 dark:border-gray-700">
          <input
            type="file"
            accept="application/pdf,image/*"
            multiple
            disabled={running}
            onChange={(e) => handleFilesSelected(e.target.files)}
            className="text-sm text-gray-600 dark:text-gray-400"
          />
          {items.length > 0 && (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-gray-600 dark:text-gray-400">
                <span>
                  {items.length} failų · {summary.done}/{summary.total} baigta
                </span>
                {summary.created > 0 && <span>Sukurta: {summary.created}</span>}
                {summary.updated > 0 && <span>Atnaujinta: {summary.updated}</span>}
                {summary.errors > 0 && <span className="text-red-600">Klaidų: {summary.errors}</span>}
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                <div
                  className="h-full bg-blue-600 transition-all duration-300"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto">
          {items.length === 0 ? (
            <p className="p-6 text-center text-sm text-gray-500">
              Pasirinkite failus viršuje, tada spauskite „Pradėti importą“.
            </p>
          ) : (
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-900/50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">
                    Failas
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">
                    Tiekėjas
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">
                    Suma
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">
                    Būsena
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {items.map((item) => (
                  <tr key={item.id}>
                    <td className="max-w-[200px] truncate px-4 py-2 text-sm text-gray-900 dark:text-white">
                      {item.file.name}
                      {item.error && (
                        <div className="mt-0.5 truncate text-xs text-red-600">{item.error}</div>
                      )}
                    </td>
                    <td className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300">
                      <div>{item.sellerName || '—'}</div>
                      {item.invoiceNumber && (
                        <div className="text-xs text-gray-500">{item.invoiceNumber}</div>
                      )}
                    </td>
                    <td className="px-4 py-2 text-sm tabular-nums text-gray-700 dark:text-gray-300">
                      {item.totalAmount ? formatEuro(item.totalAmount) : '—'}
                    </td>
                    <td className="px-4 py-2">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusClass(item.status)}`}
                      >
                        {statusLabel(item.status)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-gray-200 px-6 py-4 dark:border-gray-700">
          <button
            type="button"
            onClick={handleCancel}
            className={modalBtnSecondary}
          >
            {running ? 'Sustabdyti' : 'Uždaryti'}
          </button>
          <button
            type="button"
            onClick={() => void handleStart()}
            disabled={running || items.length === 0}
            className={modalBtnPrimary}
          >
            {running ? `Importuojama… (${summary.done}/${summary.total})` : 'Pradėti importą'}
          </button>
        </div>
      </div>
    </div>
  );
}
