'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDownIcon, SquaresPlusIcon, XMarkIcon } from '@heroicons/react/24/outline';
import {
  fetchCombinedInvoiceCandidates,
  formatCombineGroupLabel,
  matchesCandidateSearch,
  resolveCombineGroupKey,
  type CombinedInvoiceCandidate,
} from '@/lib/combined-invoice';
import { formatEuro } from '@/lib/invoice-utils';
import { resolveListMonthYear } from '@/lib/orders-filters';
import {
  portalCardClass,
  portalRowHoverClass,
  portalTdClass,
  portalThClass,
  portalTheadClass,
} from '@/lib/portal-ui';

interface CombinedInvoiceBuilderProps {
  month: string;
  year: string;
  searchQuery?: string;
  refreshKey?: number;
  onCreateCombined: (candidates: CombinedInvoiceCandidate[]) => void;
}

export function CombinedInvoiceBuilder({
  month,
  year,
  searchQuery = '',
  refreshKey = 0,
  onCreateCombined,
}: CombinedInvoiceBuilderProps) {
  const [candidates, setCandidates] = useState<CombinedInvoiceCandidate[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [groupFilter, setGroupFilter] = useState<string | null>(null);
  const [agencyFilter, setAgencyFilter] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const monthYearKeyRef = useRef('');

  const { month: resolvedMonth } = resolveListMonthYear(month, year);
  const monthYearKey = `${month}|${year}`;

  const load = useCallback(async () => {
    if (!resolvedMonth) {
      setCandidates([]);
      setSelectedIds([]);
      setGroupFilter(null);
      setAgencyFilter(null);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const rows = await fetchCombinedInvoiceCandidates({
        month,
        year,
        search: searchQuery,
        onlyUninvoiced: true,
      });
      setCandidates(rows);

      const monthYearChanged = monthYearKeyRef.current !== monthYearKey;
      monthYearKeyRef.current = monthYearKey;
      if (monthYearChanged) {
        setSelectedIds([]);
        setGroupFilter(null);
      setAgencyFilter(null);
      } else {
        setSelectedIds((prev) => prev.filter((id) => rows.some((r) => r.order.id === id)));
      }
    } catch (e) {
      console.error('fetchCombinedInvoiceCandidates:', e);
      setError('Nepavyko užkrauti užsakymų sąskaitai.');
      setCandidates([]);
    } finally {
      setLoading(false);
    }
  }, [month, year, searchQuery, resolvedMonth, monthYearKey]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  const selectedCandidates = useMemo(
    () => candidates.filter((c) => selectedIds.includes(c.order.id)),
    [candidates, selectedIds]
  );

  const selectedTotal = useMemo(
    () => selectedCandidates.reduce((s, c) => s + c.monthlyAmount, 0),
    [selectedCandidates]
  );

  const canCombine = selectedCandidates.length >= 2;

  const visibleCandidates = useMemo(() => {
    let list = candidates;

    if (agencyFilter) {
      list = list.filter((c) => (c.order.agency?.trim() || '') === agencyFilter);
    }

    if (groupFilter) {
      list = list.filter((c) => resolveCombineGroupKey(c.order) === groupFilter);
    }

    if (searchQuery.trim()) {
      list = list.filter((c) => matchesCandidateSearch(c, searchQuery));
    }

    return list;
  }, [candidates, agencyFilter, groupFilter, searchQuery]);

  const isSelected = (id: string) => selectedIds.includes(id);

  const toggle = (id: string) => {
    setSelectedIds((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      return next;
    });
  };

  const toggleAllVisible = () => {
    const visibleIds = visibleCandidates.map((c) => c.order.id);
    const allVisibleSelected =
      visibleIds.length > 0 && visibleIds.every((id) => selectedIds.includes(id));

    if (allVisibleSelected) {
      setSelectedIds((prev) => prev.filter((id) => !visibleIds.includes(id)));
    } else {
      setSelectedIds((prev) => [...new Set([...prev, ...visibleIds])]);
    }
  };

  const handleCreate = () => {
    if (!canCombine) {
      alert('Pasirinkite bent 2 neužsakytas kampanijas.');
      return;
    }
    onCreateCombined(selectedCandidates);
  };

  const applyAgencyFilterFromSelection = () => {
    const agency = selectedCandidates[0]?.order.agency?.trim();
    if (!agency) return;
    setAgencyFilter(agency);
    setGroupFilter(null);
  };

  const applyGroupFilterFromSelection = () => {
    if (selectedCandidates.length === 0) return;
    setGroupFilter(resolveCombineGroupKey(selectedCandidates[0].order));
    setAgencyFilter(null);
  };

  const groupFilterLabel = groupFilter
    ? formatCombineGroupLabel(groupFilter, selectedCandidates[0]?.order ?? candidates[0]?.order)
    : '';

  if (!resolvedMonth) {
    return (
      <div className="mb-4 rounded-lg border border-dashed border-gray-300 p-4 text-sm text-gray-500 dark:border-gray-600">
        Pasirinkite mėnesį, kad matytumėte užsakymus sujungtai sąskaitai.
      </div>
    );
  }

  const visibleIds = visibleCandidates.map((c) => c.order.id);
  const allVisibleSelected =
    visibleIds.length > 0 && visibleIds.every((id) => selectedIds.includes(id));

  return (
    <div className={`mb-4 ${portalCardClass}`}>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className={`flex w-full items-center justify-between gap-3 px-4 py-3 text-left ${
          expanded ? 'border-b border-gray-200 dark:border-gray-700' : ''
        }`}
      >
        <div className="flex min-w-0 items-start gap-2">
          <ChevronDownIcon
            className={`mt-0.5 h-5 w-5 shrink-0 text-gray-500 transition-transform ${expanded ? 'rotate-180' : ''}`}
          />
          <div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Sujungta sąskaita</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {expanded
                ? 'Pažymėkite bet kurias kampanijas (pvz. visos Open). Pirkėją galite pakeisti modale.'
                : loading
                  ? 'Kraunama…'
                  : `${candidates.length} neužsakytų kampanijų — išskleiskite norėdami sujungti`}
            </p>
          </div>
        </div>
        {expanded && (
          <div
            className="flex flex-wrap items-center justify-end gap-2"
            onClick={(e) => e.stopPropagation()}
          >
          {selectedCandidates.length >= 1 && !agencyFilter && selectedCandidates[0].order.agency?.trim() && (
            <button
              type="button"
              onClick={applyAgencyFilterFromSelection}
              className="rounded-lg border border-gray-300 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300"
            >
              Rodyti tik „{selectedCandidates[0].order.agency.trim()}“
            </button>
          )}
          {selectedCandidates.length === 1 && !groupFilter && !agencyFilter && (
            <button
              type="button"
              onClick={applyGroupFilterFromSelection}
              className="rounded-lg border border-gray-300 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300"
            >
              Rodyti tik „
              {formatCombineGroupLabel(
                resolveCombineGroupKey(selectedCandidates[0].order),
                selectedCandidates[0].order
              )}
              “
            </button>
          )}
          <button
            type="button"
            onClick={handleCreate}
            disabled={!canCombine || loading}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <SquaresPlusIcon className="h-5 w-5" />
            Sujungti ({selectedCandidates.length})
          </button>
          </div>
        )}
      </button>

      {expanded && (
        <>
      {(agencyFilter || groupFilter) && (
        <div className="flex items-center gap-2 border-b border-gray-100 bg-indigo-50 px-4 py-2 text-xs text-indigo-800 dark:border-gray-700 dark:bg-indigo-950/40 dark:text-indigo-200">
          <span>
            Rodoma:{' '}
            <strong>
              {agencyFilter ? `agentūra ${agencyFilter}` : groupFilterLabel}
            </strong>{' '}
            ({visibleCandidates.length} kampanijų)
          </span>
          <button
            type="button"
            onClick={() => {
              setAgencyFilter(null);
              setGroupFilter(null);
            }}
            className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 hover:bg-indigo-100 dark:hover:bg-indigo-900/50"
          >
            <XMarkIcon className="h-3.5 w-3.5" />
            Rodyti visus
          </button>
        </div>
      )}

      {error && <p className="px-4 py-2 text-sm text-red-600">{error}</p>}

      {loading ? (
        <p className="px-4 py-6 text-sm text-gray-500">Kraunama…</p>
      ) : candidates.length === 0 ? (
        <p className="px-4 py-6 text-sm text-gray-500">
          {searchQuery.trim()
            ? 'Pagal paiešką neužsakytų kampanijų nerasta. Pabandykite kitą žodį.'
            : 'Šiam mėnesiui nėra neužsakytų patvirtintų kampanijų.'}
        </p>
      ) : visibleCandidates.length === 0 ? (
        <p className="px-4 py-6 text-sm text-gray-500">
          Pagal filtrus kampanijų nerasta.{' '}
          {(agencyFilter || groupFilter) && (
            <button
              type="button"
              onClick={() => {
                setAgencyFilter(null);
                setGroupFilter(null);
              }}
              className="text-indigo-600 underline"
            >
              Rodyti visus
            </button>
          )}
        </p>
      ) : (
        <div className="max-h-[min(420px,50vh)] overflow-auto">
          <table className="w-full text-sm">
            <thead className={`${portalTheadClass} sticky top-0 z-10 bg-white dark:bg-gray-800`}>
              <tr>
                <th className={`${portalThClass} w-10`}>
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    onChange={toggleAllVisible}
                    aria-label="Pasirinkti visus matomus"
                  />
                </th>
                <th className={portalThClass}>Klientas</th>
                <th className={portalThClass}>Kampanija</th>
                <th className={portalThClass}>Laikotarpis</th>
                <th className={`${portalThClass} text-right`}>Mėn. suma</th>
              </tr>
            </thead>
            <tbody>
              {visibleCandidates.map((c) => {
                const o = c.order;
                const checked = isSelected(o.id);
                return (
                  <tr
                    key={o.id}
                    className={`${portalRowHoverClass} cursor-pointer ${checked ? 'bg-indigo-50/60 dark:bg-indigo-950/20' : ''}`}
                    onClick={() => toggle(o.id)}
                  >
                    <td className={portalTdClass}>
                      <input
                        type="checkbox"
                        checked={checked}
                        readOnly
                        tabIndex={-1}
                        aria-label={`Pasirinkti ${o.client}`}
                        className="pointer-events-none"
                      />
                    </td>
                    <td className={portalTdClass}>{o.client}</td>
                    <td className={portalTdClass}>
                      {o.invoice_id}
                      {o.agency ? (
                        <span className="ml-1 text-xs text-gray-500">({o.agency})</span>
                      ) : null}
                    </td>
                    <td className={portalTdClass}>
                      {c.periodFrom} – {c.periodTo}
                    </td>
                    <td className={`${portalTdClass} text-right font-medium`}>
                      {formatEuro(c.monthlyAmount)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="border-t border-gray-200 px-4 py-2 text-sm text-gray-600 dark:border-gray-700 dark:text-gray-400">
        {selectedCandidates.length === 0 ? (
          <span>
            Rodoma {visibleCandidates.length} iš {candidates.length} kampanijų
          </span>
        ) : (
          <>
            Pasirinkta: {selectedCandidates.length} · Suma be PVM: {formatEuro(selectedTotal)}
            {selectedCandidates.length === 1 && (
              <span className="ml-2 text-gray-500">— pasirinkite dar bent 1 kampaniją</span>
            )}
          </>
        )}
      </div>
        </>
      )}
    </div>
  );
}
