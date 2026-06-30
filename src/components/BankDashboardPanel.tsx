'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { PencilIcon } from '@heroicons/react/24/outline';
import { computeBankDashboardMetrics } from '@/lib/bank-dashboard';
import { BankSettingsService } from '@/lib/bank-settings-service';
import { BankTransactionService } from '@/lib/bank-transaction-service';
import { formatEuro } from '@/lib/invoice-utils';
import { InvoiceService } from '@/lib/invoice-service';
import { ReceivedInvoiceService } from '@/lib/received-invoice-service';
import { modalBtnPrimary, modalBtnSecondary, portalCardClass } from '@/lib/portal-ui';

interface BankDashboardPanelProps {
  refreshKey?: number;
}

interface DashboardCardProps {
  dotClass: string;
  label: string;
  amount: number;
  subtitle: string;
  amountClass?: string;
}

function DashboardCard({ dotClass, label, amount, subtitle, amountClass }: DashboardCardProps) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-5 py-4 dark:border-gray-600 dark:bg-gray-800">
      <div className="flex items-center gap-2">
        <span className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${dotClass}`} />
        <span className="text-sm font-medium text-gray-600 dark:text-gray-300">{label}</span>
      </div>
      <div
        className={`mt-2 text-2xl font-semibold tabular-nums tracking-tight ${amountClass ?? 'text-gray-900 dark:text-white'}`}
      >
        {formatEuro(amount)}
      </div>
      <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">{subtitle}</div>
    </div>
  );
}

function parseMoneyInput(value: string): number | null {
  const cleaned = value.replace(/\s/g, '').replace(',', '.');
  const parsed = parseFloat(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function AccountBalanceCard({
  amount,
  balanceAsOf,
  onSave,
}: {
  amount: number | null;
  balanceAsOf: string | null;
  onSave: (balance: number) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [input, setInput] = useState('');
  const [saving, setSaving] = useState(false);

  const startEdit = () => {
    setInput(amount != null ? String(amount) : '');
    setEditing(true);
  };

  const handleSave = async () => {
    const parsed = parseMoneyInput(input);
    if (parsed == null) {
      alert('Įveskite teisingą sumą.');
      return;
    }

    setSaving(true);
    try {
      await onSave(parsed);
      setEditing(false);
    } catch (error) {
      console.error('Account balance save:', error);
      alert('Nepavyko išsaugoti likučio.');
    } finally {
      setSaving(false);
    }
  };

  const subtitle =
    amount != null && balanceAsOf
      ? `Likutis ${balanceAsOf} dienai (iš banko)`
      : amount != null
        ? 'Likutis iš banko'
        : 'Spauskite ✎ ir įveskite likutį iš Swedbank';

  return (
    <div className="rounded-lg border border-gray-200 bg-white px-5 py-4 dark:border-gray-600 dark:bg-gray-800">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full bg-emerald-500" />
          <span className="text-sm font-medium text-gray-600 dark:text-gray-300">Sąskaitoje</span>
        </div>
        {!editing ? (
          <button
            type="button"
            onClick={startEdit}
            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-700 dark:hover:text-gray-200"
            title="Keisti likutį"
          >
            <PencilIcon className="h-4 w-4" />
          </button>
        ) : null}
      </div>

      {editing ? (
        <div className="mt-3 space-y-2">
          <input
            type="text"
            inputMode="decimal"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="199634.71"
            className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm tabular-nums dark:border-gray-600 dark:bg-gray-900"
            autoFocus
          />
          <div className="flex gap-2">
            <button
              type="button"
              className={modalBtnPrimary}
              disabled={saving}
              onClick={() => void handleSave()}
            >
              {saving ? 'Saugoma…' : 'Išsaugoti'}
            </button>
            <button
              type="button"
              className={modalBtnSecondary}
              disabled={saving}
              onClick={() => setEditing(false)}
            >
              Atšaukti
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="mt-2 text-2xl font-semibold tabular-nums tracking-tight text-gray-900 dark:text-white">
            {amount != null ? formatEuro(amount) : '—'}
          </div>
          <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">{subtitle}</div>
        </>
      )}
    </div>
  );
}

export function BankDashboardPanel({ refreshKey = 0 }: BankDashboardPanelProps) {
  const [loading, setLoading] = useState(true);
  const [accountBalance, setAccountBalance] = useState<number | null>(null);
  const [balanceAsOf, setBalanceAsOf] = useState<string | null>(null);
  const [metrics, setMetrics] = useState(computeBankDashboardMetrics([], [], [], null));

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [transactions, issued, received, settings] = await Promise.all([
        BankTransactionService.getAll(),
        InvoiceService.getAll(),
        ReceivedInvoiceService.getAll(),
        BankSettingsService.get(),
      ]);
      setAccountBalance(settings.account_balance);
      setBalanceAsOf(settings.balance_as_of);
      setMetrics(
        computeBankDashboardMetrics(
          transactions,
          issued,
          received,
          settings.account_balance
        )
      );
    } catch (error) {
      console.error('BankDashboardPanel load:', error);
      setAccountBalance(null);
      setBalanceAsOf(null);
      setMetrics(computeBankDashboardMetrics([], [], [], null));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData, refreshKey]);

  const handleSaveBalance = async (balance: number) => {
    await BankSettingsService.setAccountBalance(balance);
    await loadData();
  };

  const netClass = useMemo(() => {
    if (metrics.netPosition > 0) return 'text-blue-700 dark:text-blue-300';
    if (metrics.netPosition < 0) return 'text-red-700 dark:text-red-300';
    return 'text-gray-900 dark:text-white';
  }, [metrics.netPosition]);

  return (
    <div className={portalCardClass}>
      <div className="border-b border-gray-200 px-4 py-3 dark:border-gray-700">
        <h2 className="text-sm font-medium text-gray-900 dark:text-white">Finansinė apžvalga</h2>
        <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
          Sąskaitoje — tikras likutis iš banko. Skolos — neapmokėtų sąskaitų likučiai su PVM.
        </p>
      </div>

      {loading ? (
        <div className="px-4 py-10 text-center text-sm text-gray-500">Kraunama…</div>
      ) : (
        <div className="grid gap-4 p-4 sm:grid-cols-2 xl:grid-cols-4">
          <AccountBalanceCard
            amount={accountBalance}
            balanceAsOf={balanceAsOf}
            onSave={handleSaveBalance}
          />
          <DashboardCard
            dotClass="bg-emerald-500"
            label="Pirkėjai skolingi"
            amount={metrics.receivables}
            subtitle={
              metrics.openIssuedCount === 1
                ? '1 neapmokėta išrašyta sąskaita'
                : `${metrics.openIssuedCount} neapmokėtų išrašytų sąskaitų`
            }
          />
          <DashboardCard
            dotClass="bg-red-500"
            label="Tiekėjams skolingas"
            amount={metrics.payables}
            subtitle={
              metrics.openReceivedCount === 1
                ? '1 neapmokėta gauta sąskaita (EUR)'
                : `${metrics.openReceivedCount} neapmokėtų gautų sąskaitų (EUR)`
            }
            amountClass="text-red-700 dark:text-red-300"
          />
          <DashboardCard
            dotClass="bg-blue-500"
            label="Būsimas likutis"
            amount={metrics.netPosition}
            subtitle="Sąskaitoje + pirkėjų skolos − tiekėjų skolos"
            amountClass={netClass}
          />
        </div>
      )}
    </div>
  );
}
