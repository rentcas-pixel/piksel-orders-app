'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CheckCircleIcon,
  ClipboardDocumentIcon,
  ExclamationTriangleIcon,
  FilmIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { PocketBaseService } from '@/lib/pocketbase';
import {
  buildMediaBriefHtml,
  buildMediaBriefText,
  collectRequiredResolutions,
  evaluateMediaResolutions,
  readFileResolution,
  type ClipResolutionResult,
  type RequiredResolution,
} from '@/lib/media-resolution-check';
import { modalBtnPrimary, modalBtnSecondary } from '@/lib/portal-ui';

interface OrderMediaCheckModalProps {
  isOpen: boolean;
  orderId: string;
  screenIds: string[];
  mediaReceived: boolean;
  onClose: () => void;
  onMarkMediaReceived?: () => void | Promise<void>;
}

export function OrderMediaCheckModal({
  isOpen,
  orderId,
  screenIds,
  mediaReceived,
  onClose,
  onMarkMediaReceived,
}: OrderMediaCheckModalProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [loadingScreens, setLoadingScreens] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [required, setRequired] = useState<RequiredResolution[]>([]);
  const [clips, setClips] = useState<ClipResolutionResult[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [copiedKind, setCopiedKind] = useState<'all' | 'missing' | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setClips([]);
      setRequired([]);
      setLoadError(null);
      setScanning(false);
      setDragOver(false);
      setCopiedKind(null);
      return;
    }

    let cancelled = false;
    const load = async () => {
      setLoadingScreens(true);
      setLoadError(null);
      try {
        const screens = await PocketBaseService.getScreensForMediaCheck(screenIds);
        if (cancelled) return;
        const nextRequired = collectRequiredResolutions(screens);
        setRequired(nextRequired);
        if (nextRequired.length === 0) {
          setLoadError(
            screenIds.length === 0
              ? 'Užsakyme nėra pasirinktų ekranų.'
              : 'Nepavyko nuskaityti ekranų rezoliucijų.'
          );
        }
      } catch {
        if (!cancelled) setLoadError('Nepavyko užkrauti ekranų rezoliucijų.');
      } finally {
        if (!cancelled) setLoadingScreens(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [isOpen, orderId, screenIds]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !scanning) onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, onClose, scanning]);

  const result = useMemo(
    () => evaluateMediaResolutions(required, clips),
    [required, clips]
  );

  const briefText = useMemo(() => buildMediaBriefText(required), [required]);
  const briefHtml = useMemo(() => buildMediaBriefHtml(required), [required]);
  const missingText = useMemo(
    () => buildMediaBriefText(result.missing),
    [result.missing]
  );
  const missingHtml = useMemo(
    () => buildMediaBriefHtml(result.missing),
    [result.missing]
  );

  const copyBrief = useCallback(
    async (plain: string, html: string, kind: 'all' | 'missing') => {
      try {
        if (typeof ClipboardItem !== 'undefined' && navigator.clipboard.write) {
          await navigator.clipboard.write([
            new ClipboardItem({
              'text/plain': new Blob([plain], { type: 'text/plain' }),
              'text/html': new Blob([html], { type: 'text/html' }),
            }),
          ]);
        } else {
          await navigator.clipboard.writeText(plain);
        }
        setCopiedKind(kind);
        window.setTimeout(() => setCopiedKind(null), 2000);
      } catch {
        try {
          await navigator.clipboard.writeText(plain);
          setCopiedKind(kind);
          window.setTimeout(() => setCopiedKind(null), 2000);
        } catch {
          setCopiedKind(null);
        }
      }
    },
    []
  );

  const processFiles = useCallback(async (fileList: FileList | File[]) => {
    const files = [...fileList];
    if (files.length === 0) return;
    setScanning(true);
    try {
      const scanned = await Promise.all(files.map((file) => readFileResolution(file)));
      setClips((prev) => {
        const names = new Set(prev.map((c) => c.fileName));
        const next = scanned.filter((c) => !names.has(c.fileName));
        return [...prev, ...next];
      });
    } finally {
      setScanning(false);
    }
  }, []);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl bg-white shadow-xl dark:bg-gray-800">
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4 dark:border-gray-700">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Media patikra
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700"
            aria-label="Uždaryti"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 overflow-y-auto px-5 py-4">
          <section>
            <div className="mb-2 flex items-center justify-between gap-2">
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-200">
                Reikalingi šie klipai
              </h3>
              {required.length > 0 && !loadingScreens && (
                <button
                  type="button"
                  onClick={() => void copyBrief(briefText, briefHtml, 'all')}
                  className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-gray-600 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 dark:text-gray-300 dark:ring-gray-600 dark:hover:bg-gray-700"
                >
                  <ClipboardDocumentIcon className="h-3.5 w-3.5" />
                  {copiedKind === 'all' ? 'Nukopijuota' : 'Kopijuoti'}
                </button>
              )}
            </div>
            {loadingScreens ? (
              <p className="text-sm text-gray-500">Kraunama…</p>
            ) : loadError ? (
              <p className="text-sm text-amber-700 dark:text-amber-300">{loadError}</p>
            ) : (
              <>
                <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500 dark:bg-gray-900 dark:text-gray-400">
                      <tr>
                        <th className="px-3 py-2 font-medium">Rezoliucija (px)</th>
                        <th className="px-3 py-2 font-medium">Ekranai</th>
                        <th className="px-3 py-2 font-medium">Statusas</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                      {required.map((item) => {
                        const ok = result.coveredKeys.includes(item.key);
                        return (
                          <tr key={item.key} className="bg-white dark:bg-gray-800">
                            <td className="whitespace-nowrap px-3 py-2 font-medium text-gray-900 dark:text-white">
                              {item.label}
                            </td>
                            <td className="px-3 py-2 text-gray-600 dark:text-gray-300">
                              {item.screenNames.join(', ') || '—'}
                            </td>
                            <td
                              className={`whitespace-nowrap px-3 py-2 ${
                                ok
                                  ? 'text-green-600 dark:text-green-400'
                                  : 'text-amber-600 dark:text-amber-400'
                              }`}
                            >
                              {ok ? 'OK' : 'Trūksta'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </section>

          <section>
            <input
              ref={inputRef}
              type="file"
              multiple
              accept="video/*,image/*,.mp4,.mov,.m4v,.webm,.avi,.mkv,.jpg,.jpeg,.png,.webp"
              className="hidden"
              onChange={(e) => {
                if (e.target.files) void processFiles(e.target.files);
                e.target.value = '';
              }}
            />
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                if (e.dataTransfer.files?.length) void processFiles(e.dataTransfer.files);
              }}
              className={`rounded-xl border-2 border-dashed px-4 py-8 text-center transition-colors ${
                dragOver
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30'
                  : 'border-gray-300 dark:border-gray-600'
              }`}
            >
              <FilmIcon className="mx-auto mb-2 h-8 w-8 text-gray-400" />
              <p className="text-sm text-gray-600 dark:text-gray-300">
                Nutempkite klipus čia arba
              </p>
              <button
                type="button"
                disabled={scanning || loadingScreens}
                onClick={() => inputRef.current?.click()}
                className={`${modalBtnSecondary} mt-3`}
              >
                {scanning ? 'Skaitoma…' : 'Pasirinkti failus'}
              </button>
            </div>
          </section>

          {clips.length > 0 && (
            <section>
              <h3 className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-200">
                Įkelti failai ({clips.length})
              </h3>
              <ul className="space-y-1.5">
                {clips.map((clip) => (
                  <li
                    key={clip.fileName}
                    className="flex items-center justify-between gap-3 rounded-lg bg-gray-50 px-3 py-2 text-sm dark:bg-gray-900/50"
                  >
                    <span className="truncate text-gray-800 dark:text-gray-100">
                      {clip.fileName}
                    </span>
                    <span className="shrink-0 text-gray-500 dark:text-gray-400">
                      {clip.error || clip.label || '—'}
                    </span>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                className="mt-2 text-xs text-gray-500 underline hover:text-gray-700 dark:hover:text-gray-300"
                onClick={() => setClips([])}
              >
                Išvalyti failus
              </button>
            </section>
          )}

          {clips.length > 0 && required.length > 0 && (
            <section
              className={`rounded-xl px-4 py-3 text-sm ${
                result.isComplete
                  ? 'bg-green-50 text-green-800 dark:bg-green-950/40 dark:text-green-200'
                  : 'bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-100'
              }`}
            >
              {result.isComplete ? (
                <div className="flex items-start gap-2">
                  <CheckCircleIcon className="mt-0.5 h-5 w-5 shrink-0" />
                  <div>
                    <div className="font-semibold">OK — visos rezoliucijos yra</div>
                    <div className="text-xs opacity-90">
                      Surasta: {result.coveredKeys.length} / {required.length}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="w-full">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2">
                      <ExclamationTriangleIcon className="mt-0.5 h-5 w-5 shrink-0" />
                      <div className="font-semibold">Trūksta klipų</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => void copyBrief(missingText, missingHtml, 'missing')}
                      className="inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-amber-900 ring-1 ring-inset ring-amber-300 hover:bg-amber-100 dark:text-amber-100 dark:ring-amber-700 dark:hover:bg-amber-900/50"
                    >
                      <ClipboardDocumentIcon className="h-3.5 w-3.5" />
                      {copiedKind === 'missing' ? 'Nukopijuota' : 'Kopijuoti'}
                    </button>
                  </div>
                  <div className="mt-2 overflow-x-auto rounded-lg border border-amber-200 bg-white/70 dark:border-amber-800 dark:bg-gray-900/40">
                    <table className="min-w-full text-sm">
                      <thead className="bg-amber-100/70 text-left text-xs uppercase tracking-wide text-amber-900 dark:bg-amber-950/50 dark:text-amber-100">
                        <tr>
                          <th className="px-3 py-2 font-medium">Rezoliucija (px)</th>
                          <th className="px-3 py-2 font-medium">Ekranai</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-amber-100 dark:divide-amber-900/40">
                        {result.missing.map((item) => (
                          <tr key={item.key}>
                            <td className="whitespace-nowrap px-3 py-2 font-medium">
                              {item.label}
                            </td>
                            <td className="px-3 py-2">
                              {item.screenNames.join(', ') || '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
              {result.unmatchedClips.length > 0 && (
                <p className="mt-2 text-xs opacity-80">
                  Ne orderio rezoliucijos:{' '}
                  {result.unmatchedClips
                    .map((c) => `${c.fileName} (${c.label})`)
                    .join(', ')}
                </p>
              )}
            </section>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-gray-200 px-5 py-4 dark:border-gray-700">
          <button type="button" className={modalBtnSecondary} onClick={onClose}>
            Uždaryti
          </button>
          {onMarkMediaReceived && result.isComplete && !mediaReceived && (
            <button
              type="button"
              className={modalBtnPrimary}
              onClick={() => void onMarkMediaReceived()}
            >
              Pažymėti media gauta
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
