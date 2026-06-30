'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowPathIcon,
  DocumentArrowUpIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';
import { BankImportReviewModal } from '@/components/BankImportReviewModal';
import { applyBankImportReview, prepareBankImportReview } from '@/lib/bank-import-runner';
import type { BankImportReview } from '@/lib/bank-import-suggestions';
import { BankTransactionService } from '@/lib/bank-transaction-service';
import { matchesBankSearch } from '@/lib/bank-search';
import { isSignificantBankExpense } from '@/lib/bank-statement-import';
import { formatEuro } from '@/lib/invoice-utils';
import { resolveListMonthYear } from '@/lib/orders-filters';
import type { BankSubTab } from '@/lib/app-navigation';
import { BankFiltersBar } from '@/components/BankFiltersBar';
import { BankListTotalsSummary } from '@/components/BankListTotalsSummary';
import {
  modalBtnSecondary,
  portalCardClass,
  portalExportBtnClass,
  portalRowHoverClass,
  portalTdClass,
  portalThClass,
  portalTheadClass,
  portalToolbarClass,
} from '@/lib/portal-ui';
import type { BankTransaction } from '@/types';

interface BankPanelProps {
  subTab: Exclude<BankSubTab, 'balance' | 'dashboard'>;
  month: string;
  year: string;
  onMonthYearChange: (month: string, year: string) => void;
  refreshKey?: number;
  onChanged?: () => void;
}

function matchesBankPeriod(
  transactionDate: string,
  resolvedMonth: string,
  resolvedYear: string
): boolean {
  if (resolvedYear && resolvedMonth) {
    return transactionDate.startsWith(`${resolvedYear}-${resolvedMonth}`);
  }
  if (resolvedYear) {
    return transactionDate.startsWith(`${resolvedYear}-`);
  }
  return true;
}

function formatDate(value: string) {
  return value || '—';
}

const bankTextColClass = 'w-[30%]';
const bankTextCellClass = `${portalTdClass} max-w-0 truncate`;

type BankSortColumn = 'date' | 'amount';
type BankSortDirection = 'asc' | 'desc';

function sortIndicator(active: boolean, direction: BankSortDirection): string {
  if (!active) return '↕';
  return direction === 'desc' ? '↓' : '↑';
}

function SortableBankHeader({
  label,
  column,
  activeColumn,
  direction,
  onSort,
  className,
  title,
  align = 'left',
}: {
  label: string;
  column: BankSortColumn;
  activeColumn: BankSortColumn;
  direction: BankSortDirection;
  onSort: (column: BankSortColumn) => void;
  className?: string;
  title: string;
  align?: 'left' | 'right';
}) {
  const active = activeColumn === column;

  return (
    <th className={className}>
      <button
        type="button"
        onClick={() => onSort(column)}
        className={`inline-flex items-center gap-1 uppercase tracking-wider transition-colors hover:text-gray-800 dark:hover:text-gray-200 ${
          align === 'right' ? 'ml-auto' : ''
        } ${
          active
            ? 'font-semibold text-blue-700 dark:text-blue-300'
            : 'font-medium text-gray-500 dark:text-gray-400'
        }`}
        title={title}
      >
        {label}
        <span className="normal-case">{sortIndicator(active, direction)}</span>
      </button>
    </th>
  );
}

export function BankPanel({
  subTab,
  month,
  year,
  onMonthYearChange,
  refreshKey = 0,
  onChanged,
}: BankPanelProps) {
  const direction = subTab === 'income' ? 'income' : 'expense';
  const [transactions, setTransactions] = useState<BankTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [allocating, setAllocating] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importFileName, setImportFileName] = useState('');
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importReview, setImportReview] = useState<BankImportReview | null>(null);
  const [importReviewOpen, setImportReviewOpen] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [deduplicating, setDeduplicating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [sortColumn, setSortColumn] = useState<BankSortColumn>('date');
  const [sortDirection, setSortDirection] = useState<BankSortDirection>('desc');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setSortColumn('date');
    setSortDirection('desc');
  }, [direction]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await BankTransactionService.repairCounterpartyNames();
      const rows = await BankTransactionService.getAll(direction);
      setTransactions(rows);
    } catch (loadError) {
      console.error('bank load:', loadError);
      setError('Nepavyko užkrauti banko pavedimų.');
    } finally {
      setLoading(false);
    }
  }, [direction]);

  useEffect(() => {
    void loadData();
  }, [loadData, refreshKey]);

  const { month: resolvedMonth, year: resolvedYear } = useMemo(
    () => resolveListMonthYear(month, year),
    [month, year]
  );

  const visibleTransactions = useMemo(() => {
    if (direction !== 'expense') return transactions;
    return transactions.filter((tx) => isSignificantBankExpense(tx.amount));
  }, [transactions, direction]);

  const periodTransactions = useMemo(
    () =>
      visibleTransactions.filter((tx) =>
        matchesBankPeriod(tx.transaction_date, resolvedMonth, resolvedYear)
      ),
    [visibleTransactions, resolvedMonth, resolvedYear]
  );

  const filtered = useMemo(() => {
    if (!search.trim()) return periodTransactions;
    return periodTransactions.filter((tx) => matchesBankSearch(tx, search));
  }, [periodTransactions, search]);

  const sorted = useMemo(
    () =>
      [...filtered].sort((a, b) => {
        const dir = sortDirection === 'asc' ? 1 : -1;

        if (sortColumn === 'date') {
          const dateDiff = a.transaction_date.localeCompare(b.transaction_date);
          if (dateDiff !== 0) return dateDiff * dir;
          const amountDiff = a.amount - b.amount;
          if (amountDiff !== 0) return amountDiff * dir;
        } else {
          const amountDiff = a.amount - b.amount;
          if (amountDiff !== 0) return amountDiff * dir;
          const dateDiff = a.transaction_date.localeCompare(b.transaction_date);
          if (dateDiff !== 0) return dateDiff * dir;
        }

        return a.created_at.localeCompare(b.created_at) * dir;
      }),
    [filtered, sortColumn, sortDirection]
  );

  const handleSort = (column: BankSortColumn) => {
    if (sortColumn === column) {
      setSortDirection((current) => (current === 'asc' ? 'desc' : 'asc'));
      return;
    }

    setSortColumn(column);
    setSortDirection('desc');
  };

  const listTotals = useMemo(() => {
    const total = filtered.reduce((sum, tx) => sum + tx.amount, 0);
    return { count: filtered.length, total };
  }, [filtered]);

  const paymentCountLabel =
    listTotals.count === 1 ? '1 pavedimas' : `${listTotals.count} pavedimų`;
  const amountSummaryLabel = direction === 'income' ? 'Gauta' : 'Pervesta';

  const searchActive = search.trim().length > 0;
  const counterpartyLabel = direction === 'income' ? 'Klientas' : 'Tiekėjas';

  const handleDelete = async (tx: BankTransaction) => {
    if (!confirm(`Ištrinti pavedimą ${formatEuro(tx.amount)} · ${tx.counterparty}?`)) return;
    try {
      await BankTransactionService.delete(tx.id);
      await loadData();
      onChanged?.();
    } catch (deleteError) {
      console.error('bank delete:', deleteError);
      alert('Nepavyko ištrinti pavedimo.');
    }
  };

  const handleAllocate = async () => {
    setAllocating(true);
    setError(null);
    try {
      const result = await BankTransactionService.allocateAll();
      await loadData();
      onChanged?.();
      alert(
        result.allocationsCreated > 0
          ? `Sukurta ${result.allocationsCreated} sudengimų, atnaujinta ${result.invoicesUpdated} sąskaitų.`
          : 'Naujų sudengimų nerasta — visi pavedimai jau sudengti arba nėra atvirų sąskaitų.'
      );
    } catch (allocateError) {
      console.error('bank allocate:', allocateError);
      setError('Nepavyko sudengti pavedimų su sąskaitomis.');
    } finally {
      setAllocating(false);
    }
  };

  const handleDeduplicate = async () => {
    setDeduplicating(true);
    setError(null);
    try {
      const result = await BankTransactionService.deduplicateAll();
      await loadData();
      onChanged?.();
      alert(
        result.removed > 0
          ? `Pašalinta ${result.removed} dublikatų. Sudengimai perskaičiuoti iš naujo.`
          : 'Dublikatų nerasta.'
      );
    } catch (dedupeError) {
      console.error('bank dedupe:', dedupeError);
      setError('Nepavyko pašalinti dublikatų.');
    } finally {
      setDeduplicating(false);
    }
  };

  const handleClearAll = async () => {
    if (
      !confirm(
        'Ištrinti VISUS banko pavedimus ir sudengimus? Sąskaitų apmokėjimo žymos bus nuimtos — galėsite importuoti CSV iš naujo.'
      )
    ) {
      return;
    }

    setClearing(true);
    setError(null);
    try {
      const result = await BankTransactionService.clearAll();
      await loadData();
      onChanged?.();
      alert(`Ištrinta ${result.transactions} pavedimų ir ${result.allocations} sudengimų.`);
    } catch (clearError) {
      console.error('bank clear:', clearError);
      setError('Nepavyko išvalyti banko pavedimų.');
    } finally {
      setClearing(false);
    }
  };

  const handleCsvImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setError(null);
    try {
      const prepared = await prepareBankImportReview(file);
      if (prepared.groups.length === 0) {
        setError('Naujų pavedimų nerasta — galbūt jau importuoti.');
        return;
      }
      setImportFile(file);
      setImportFileName(file.name);
      setImportReview(prepared);
      setImportReviewOpen(true);
    } catch (importError) {
      console.error('bank import preview:', importError);
      setError('Nepavyko nuskaityti banko failo.');
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleConfirmImportReview = async (confirmed: BankImportReview) => {
    if (!importFile) return;

    setImporting(true);
    setError(null);
    try {
      await applyBankImportReview(importFile, confirmed);
      setImportReviewOpen(false);
      setImportReview(null);
      setImportFile(null);
      await loadData();
      onChanged?.();
    } catch (importError) {
      console.error('bank import apply:', importError);
      setError('Nepavyko importuoti banko failo.');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-4">
      <BankFiltersBar month={month} year={year} onMonthYearChange={onMonthYearChange} />

      {error ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200">
          {error}
        </div>
      ) : null}

      <div className={portalCardClass}>
        <div className={`${portalToolbarClass} flex flex-wrap items-center justify-between gap-3`}>
          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 text-sm text-gray-500 dark:text-gray-400">
            {loading ? (
              <span>Kraunama…</span>
            ) : (
              <BankListTotalsSummary
                countLabel={paymentCountLabel}
                amountLabel={amountSummaryLabel}
                total={listTotals.total}
              />
            )}
          </div>
          <div className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-2 sm:flex-none">
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={
                direction === 'income'
                  ? 'Ieškoti kliento, aprašymo… (pvz. skleri)'
                  : 'Ieškoti tiekėjo, aprašymo… (pvz. skleri)'
              }
              className="min-w-[12rem] flex-1 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 sm:flex-none"
            />
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xml,text/csv,text/xml,application/xml"
              className="hidden"
              onChange={(e) => void handleCsvImport(e)}
            />
            <button
              type="button"
              className={portalExportBtnClass}
              disabled={importing}
              onClick={() => fileInputRef.current?.click()}
              title="Swedbank CSV arba ISO 20022 XML — importuoja ir įplaukas, ir išlaidas"
            >
              <DocumentArrowUpIcon className="mr-1.5 inline h-4 w-4" />
              {importing ? 'Importuojama…' : 'Importas (CSV / XML)'}
            </button>
            <button
              type="button"
              className={modalBtnSecondary}
              disabled={allocating}
              onClick={() => void handleAllocate()}
            >
              <ArrowPathIcon className="mr-1.5 inline h-4 w-4" />
              {allocating ? 'Sudengiama…' : 'Sudengti su sąskaitomis'}
            </button>
            <button
              type="button"
              className={modalBtnSecondary}
              disabled={deduplicating || loading}
              onClick={() => void handleDeduplicate()}
              title="Pašalina tas pačias operacijas, importuotas kelis kartus"
            >
              {deduplicating ? 'Taisoma…' : 'Pašalinti dublikatus'}
            </button>
            <button
              type="button"
              className="rounded-md border border-red-300 bg-white px-3 py-2 text-sm text-red-700 hover:bg-red-50 dark:border-red-800 dark:bg-gray-800 dark:text-red-300 dark:hover:bg-red-950/40"
              disabled={clearing || loading}
              onClick={() => void handleClearAll()}
            >
              <TrashIcon className="mr-1.5 inline h-4 w-4" />
              {clearing ? 'Trinama…' : 'Išvalyti visus'}
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full table-fixed text-sm">
            <thead className={portalTheadClass}>
              <tr>
                <SortableBankHeader
                  label="Data"
                  column="date"
                  activeColumn={sortColumn}
                  direction={sortDirection}
                  onSort={handleSort}
                  className={`${portalThClass} w-[6.5rem] whitespace-nowrap`}
                  title={
                    sortColumn === 'date'
                      ? sortDirection === 'desc'
                        ? 'Rūšiuojama: naujausi viršuje. Spauskite — seniausi'
                        : 'Rūšiuojama: seniausi viršuje. Spauskite — naujausi'
                      : 'Rūšiuoti pagal datą'
                  }
                />
                <th className={`${portalThClass} ${bankTextColClass}`}>{counterpartyLabel}</th>
                <th className={`${portalThClass} ${bankTextColClass}`}>Aprašymas</th>
                <SortableBankHeader
                  label="Suma"
                  column="amount"
                  activeColumn={sortColumn}
                  direction={sortDirection}
                  onSort={handleSort}
                  className={`${portalThClass} w-[7.5rem] text-right whitespace-nowrap`}
                  align="right"
                  title={
                    sortColumn === 'amount'
                      ? sortDirection === 'desc'
                        ? 'Rūšiuojama: didžiausia viršuje. Spauskite — mažiausia'
                        : 'Rūšiuojama: mažiausia viršuje. Spauskite — didžiausia'
                      : 'Rūšiuoti pagal sumą'
                  }
                />
                <th className={`${portalThClass} w-10`} />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className={`${portalTdClass} text-center text-gray-500`}>
                    Kraunama…
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className={`${portalTdClass} text-center text-gray-500`}>
                    {searchActive
                      ? `Paieška „${search.trim()}“ nerado pavedimų (${periodTransactions.length} šį laikotarpį).`
                      : periodTransactions.length === 0
                        ? visibleTransactions.length === 0
                          ? 'Pavedimų nėra. Spauskite „Importas (CSV / XML)“.'
                          : 'Šį laikotarpį pavedimų nerasta.'
                        : 'Pavedimų nėra.'}
                  </td>
                </tr>
              ) : (
                sorted.map((tx) => (
                    <tr key={tx.id} className={portalRowHoverClass}>
                      <td className={`${portalTdClass} w-[6.5rem] whitespace-nowrap tabular-nums`}>
                        {formatDate(tx.transaction_date)}
                      </td>
                      <td className={`${bankTextCellClass} font-medium`}>{tx.counterparty}</td>
                      <td className={`${bankTextCellClass} text-gray-600 dark:text-gray-400`}>
                        {tx.description || '—'}
                      </td>
                      <td className={`${portalTdClass} w-[7.5rem] text-right whitespace-nowrap tabular-nums`}>
                        {formatEuro(tx.amount)}
                      </td>
                      <td className={portalTdClass}>
                        <button
                          type="button"
                          onClick={() => void handleDelete(tx)}
                          className="rounded p-1 text-gray-500 hover:bg-gray-100 hover:text-red-600 dark:hover:bg-gray-700"
                          title="Ištrinti"
                        >
                          <TrashIcon className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <BankImportReviewModal
        isOpen={importReviewOpen}
        fileName={importFileName}
        review={importReview}
        applying={importing}
        onClose={() => setImportReviewOpen(false)}
        onConfirm={(confirmed) => void handleConfirmImportReview(confirmed)}
      />
    </div>
  );
}
