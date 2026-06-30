'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { DocumentArrowUpIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { BankImportReviewModal } from '@/components/BankImportReviewModal';
import { applyBankImportReview, prepareBankImportReview } from '@/lib/bank-import-runner';
import type { BankImportReview } from '@/lib/bank-import-suggestions';
import { modalBtnSecondary } from '@/lib/portal-ui';

interface BankStatementImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCompleted?: () => void;
}

export function BankStatementImportModal({
  isOpen,
  onClose,
  onCompleted,
}: BankStatementImportModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [review, setReview] = useState<BankImportReview | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = useCallback(() => {
    setFileName('');
    setSelectedFile(null);
    setLoading(false);
    setApplying(false);
    setReview(null);
    setReviewOpen(false);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  useEffect(() => {
    if (!isOpen) reset();
  }, [isOpen, reset]);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setError(null);
    setFileName(file.name);
    setSelectedFile(file);

    try {
      const prepared = await prepareBankImportReview(file, { expensesOnly: true });
      if (prepared.groups.length === 0) {
        setError('Iš failo nepavyko nuskaityti naujų išlaidų pavedimų.');
        return;
      }
      setReview(prepared);
      setReviewOpen(true);
    } catch (importError) {
      console.error('Bank statement preview:', importError);
      setError('Nepavyko nuskaityti banko išrašo. Patikrinkite CSV arba XML formatą.');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmReview = async (confirmed: BankImportReview) => {
    if (!selectedFile) return;

    setApplying(true);
    setError(null);

    try {
      await applyBankImportReview(selectedFile, confirmed, { expensesOnly: true });
      setReviewOpen(false);
      onCompleted?.();
      onClose();
    } catch (applyError) {
      console.error('Bank statement apply:', applyError);
      setError('Klaida importuojant pavedimus ir sudengiant sąskaitas.');
    } finally {
      setApplying(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
        <div className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-xl bg-white shadow-xl dark:bg-gray-800">
          <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4 dark:border-gray-700">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Banko išrašas</h2>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Įkelkite išrašą — parodysime siūlomus sudengimus su gautomis sąskaitomis.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700"
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>

          <div className="space-y-4 px-6 py-6">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.txt,.xml"
              onChange={(event) => void handleFileChange(event)}
              className="hidden"
              id="bank-statement-upload"
            />
            <label
              htmlFor="bank-statement-upload"
              className={`${modalBtnSecondary} inline-flex cursor-pointer items-center gap-2`}
            >
              <DocumentArrowUpIcon className="h-4 w-4" />
              Pasirinkti failą
            </label>
            {fileName && (
              <p className="text-sm text-gray-600 dark:text-gray-300">{fileName}</p>
            )}
            {loading && <p className="text-sm text-gray-500">Analizuojama…</p>}
            {error && <p className="text-sm text-red-600">{error}</p>}
          </div>

          <div className="flex justify-end border-t border-gray-200 px-6 py-4 dark:border-gray-700">
            <button type="button" onClick={onClose} className={modalBtnSecondary} disabled={applying}>
              Uždaryti
            </button>
          </div>
        </div>
      </div>

      <BankImportReviewModal
        isOpen={reviewOpen}
        fileName={fileName}
        review={review}
        applying={applying}
        onClose={() => setReviewOpen(false)}
        onConfirm={(confirmed) => void handleConfirmReview(confirmed)}
      />
    </>
  );
}
