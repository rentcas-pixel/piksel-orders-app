'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DocumentArrowUpIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { parseBankStatementFile, readBankStatementFile } from '@/lib/bank-import';
import { runBankStatementImport } from '@/lib/bank-import-runner';
import {
  matchReasonLabel,
  previewBankStatementImport,
  type BankPayment,
  type BankStatementMatch,
} from '@/lib/bank-statement-import';
import { formatEuro } from '@/lib/invoice-utils';
import { ReceivedInvoiceService } from '@/lib/received-invoice-service';
import { modalBtnPrimary, modalBtnSecondary } from '@/lib/portal-ui';
import type { ReceivedInvoice } from '@/types';

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
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [matches, setMatches] = useState<BankStatementMatch[]>([]);
  const [unmatchedPayments, setUnmatchedPayments] = useState<BankPayment[]>([]);
  const [unmatchedCount, setUnmatchedCount] = useState(0);
  const [parsedPayments, setParsedPayments] = useState(0);
  const [skippedRows, setSkippedRows] = useState(0);
  const [fileText, setFileText] = useState('');
  const [fileFormat, setFileFormat] = useState<'csv' | 'xml'>('csv');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reset = useCallback(() => {
    setFileName('');
    setMatches([]);
    setUnmatchedPayments([]);
    setUnmatchedCount(0);
    setParsedPayments(0);
    setSkippedRows(0);
    setFileText('');
    setFileFormat('csv');
    setSelectedFile(null);
    setError(null);
    setLoading(false);
    setApplying(false);
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

    try {
      setSelectedFile(file);
      const { text, format } = await readBankStatementFile(file);
      setFileText(text);
      setFileFormat(format);

      if (format === 'xml') {
        const parsed = parseBankStatementFile(text, 'xml');
        setMatches([]);
        setUnmatchedPayments(parsed.expenses);
        setUnmatchedCount(parsed.expenses.length);
        setParsedPayments(parsed.expenses.length);
        setSkippedRows(parsed.skippedRows);
        if (parsed.expenses.length === 0) {
          setError('Iš XML nepavyko nuskaityti išlaidų operacijų.');
        }
        return;
      }

      const invoices: ReceivedInvoice[] = await ReceivedInvoiceService.getAll();
      const preview = previewBankStatementImport(text, invoices);
      setMatches(preview.matches);
      setUnmatchedPayments(preview.unmatchedPayments);
      setUnmatchedCount(preview.unmatchedPayments.length);
      setParsedPayments(preview.parsedPayments);
      setSkippedRows(preview.skippedRows);

      if (preview.parsedPayments === 0) {
        setError(
          'Iš CSV nepavyko nuskaityti išlaidų operacijų. Patikrinkite ar tai Swedbank CSV (platus formatas).'
        );
      }
    } catch (importError) {
      console.error('Bank statement preview:', importError);
      setError('Nepavyko nuskaityti banko išrašo. Patikrinkite CSV formatą.');
      setMatches([]);
    setUnmatchedPayments([]);
      setUnmatchedCount(0);
      setParsedPayments(0);
      setSkippedRows(0);
    } finally {
      setLoading(false);
    }
  };

  const summary = useMemo(() => {
    const alreadyPaid = matches.filter((match) => match.invoice.payment_date).length;
    const toApply = matches.length - alreadyPaid;
    return { alreadyPaid, toApply };
  }, [matches]);

  const handleApply = async () => {
    if (!selectedFile || parsedPayments === 0) return;

    setApplying(true);
    setError(null);

    try {
      await runBankStatementImport(selectedFile, { expensesOnly: true });

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl bg-white shadow-xl dark:bg-gray-800">
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4 dark:border-gray-700">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Banko išrašas</h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Įkelkite Swedbank CSV arba ISO XML (camt.052/053) — išlaidų pavedimai bus įrašyti į Banką ir sudengti su gautomis sąskaitomis (FIFO).
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

        <div className="space-y-4 border-b border-gray-200 px-6 py-4 dark:border-gray-700">
          <div className="flex flex-wrap items-center gap-3">
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
              <span className="text-sm text-gray-600 dark:text-gray-300">{fileName}</span>
            )}
          </div>

          {loading && <p className="text-sm text-gray-500">Analizuojama…</p>}
          {error && <p className="text-sm text-red-600">{error}</p>}

          {!loading && parsedPayments > 0 && (
            <div className="flex flex-wrap gap-4 text-sm text-gray-600 dark:text-gray-300">
              <span>Išlaidų operacijos: {parsedPayments}</span>
              <span>Atitikimai: {matches.length}</span>
              <span>Nepavyko suderinti: {unmatchedCount}</span>
              {summary.toApply > 0 && <span>Bus pažymėta: {summary.toApply}</span>}
              {skippedRows > 0 && <span>Praleista eilučių: {skippedRows}</span>}
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto">
          {matches.length === 0 && unmatchedPayments.length === 0 ? (
            <p className="p-6 text-center text-sm text-gray-500">
              {fileName
                ? 'Atitikimų nerasta. Patikrinkite ar failas turi išlaidų (D / DBIT) operacijas.'
                : 'Pasirinkite banko išrašo CSV arba XML failą.'}
            </p>
          ) : (
            <div className="space-y-6">
              {matches.length > 0 && (
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-900/50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">
                        Atitikimai
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">
                        Mokėjimo data
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">
                        Tiekėjas
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">
                        Sąskaita
                      </th>
                      <th className="px-4 py-2 text-right text-xs font-medium uppercase text-gray-500">
                        Suma
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">
                        Tipas
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {matches.map((match) => (
                      <tr key={`${match.invoice.id}-${match.payment.date}-${match.payment.amount}`}>
                        <td className="px-4 py-2 text-sm text-green-700 dark:text-green-300">✓</td>
                        <td className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300">
                          {match.payment.date}
                        </td>
                        <td className="px-4 py-2 text-sm text-gray-900 dark:text-white">
                          {match.invoice.seller_name}
                        </td>
                        <td className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300">
                          {match.invoice.invoice_number || '—'}
                        </td>
                        <td className="px-4 py-2 text-right text-sm tabular-nums text-gray-700 dark:text-gray-300">
                          {formatEuro(match.payment.amount)}
                        </td>
                        <td className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300">
                          {matchReasonLabel(match.reason)}
                          {match.invoice.payment_date && (
                            <span className="ml-2 text-xs text-amber-600">jau apmokėta</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {unmatchedPayments.length > 0 && (
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-900/50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">
                        Nesuderinta ({unmatchedPayments.length})
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">
                        Data
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">
                        Aprašymas
                      </th>
                      <th className="px-4 py-2 text-right text-xs font-medium uppercase text-gray-500">
                        Suma
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {unmatchedPayments.slice(0, 20).map((payment, index) => (
                      <tr key={`${payment.date}-${payment.amount}-${index}`}>
                        <td className="px-4 py-2 text-sm text-gray-400">—</td>
                        <td className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300">
                          {payment.date}
                        </td>
                        <td className="max-w-md truncate px-4 py-2 text-sm text-gray-700 dark:text-gray-300">
                          {payment.description}
                          {payment.counterparty && payment.counterparty !== payment.description && (
                            <span className="block text-xs text-gray-500">{payment.counterparty}</span>
                          )}
                        </td>
                        <td className="px-4 py-2 text-right text-sm tabular-nums text-gray-700 dark:text-gray-300">
                          {formatEuro(payment.amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-gray-200 px-6 py-4 dark:border-gray-700">
          <button type="button" onClick={onClose} className={modalBtnSecondary} disabled={applying}>
            Uždaryti
          </button>
          <button
            type="button"
            onClick={() => void handleApply()}
            className={modalBtnPrimary}
            disabled={loading || applying || parsedPayments === 0}
          >
            {applying ? 'Importuojama…' : `Importuoti į Banką (${parsedPayments})`}
          </button>
        </div>
      </div>
    </div>
  );
}
