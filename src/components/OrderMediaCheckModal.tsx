'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CheckCircleIcon,
  ExclamationTriangleIcon,
  FilmIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { PocketBaseService } from '@/lib/pocketbase';
import {
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

  useEffect(() => {
    if (!isOpen) {
      setClips([]);
      setRequired([]);
      setLoadError(null);
      setScanning(false);
      setDragOver(false);
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
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Įkelkite klipus — patikrinsime, ar yra visos orderio rezoliucijos.
            </p>
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
            <h3 className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-200">
              Reikalingos rezoliucijos
            </h3>
            {loadingScreens ? (
              <p className="text-sm text-gray-500">Kraunama…</p>
            ) : loadError ? (
              <p className="text-sm text-amber-700 dark:text-amber-300">{loadError}</p>
            ) : (
              <ul className="space-y-1.5">
                {required.map((item) => {
                  const ok = result.coveredKeys.includes(item.key);
                  return (
                    <li
                      key={item.key}
                      className="flex items-start justify-between gap-3 rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-700"
                    >
                      <div>
                        <div className="font-medium text-gray-900 dark:text-white">
                          {item.label}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {item.screenNames.join(', ')}
                        </div>
                      </div>
                      <span
                        className={
                          ok
                            ? 'shrink-0 text-green-600 dark:text-green-400'
                            : 'shrink-0 text-amber-600 dark:text-amber-400'
                        }
                      >
                        {ok ? 'OK' : 'Trūksta'}
                      </span>
                    </li>
                  );
                })}
              </ul>
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
                <div className="flex items-start gap-2">
                  <ExclamationTriangleIcon className="mt-0.5 h-5 w-5 shrink-0" />
                  <div>
                    <div className="font-semibold">Trūksta rezoliucijų</div>
                    <ul className="mt-1 list-disc pl-4">
                      {result.missing.map((item) => (
                        <li key={item.key}>
                          {item.label}
                          {item.screenNames.length > 0
                            ? ` (${item.screenNames.join(', ')})`
                            : ''}
                        </li>
                      ))}
                    </ul>
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
