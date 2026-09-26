'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  PencilSquareIcon,
  TrashIcon,
  ArrowPathIcon,
  CalendarDaysIcon,
  Bars2Icon,
  PlusIcon,
} from '@heroicons/react/24/outline';
import { AppShell } from '@/components/AppShell';
import { PortalSearchField } from '@/components/PortalSearchField';
import { useAppSession } from '@/hooks/useAppSession';
import {
  addDeviceGroup,
  defaultDeviceBoard,
  devicesInGroup,
  loadDeviceBoard,
  moveDevice,
  removeDeviceGroup,
  renameDeviceGroup,
  saveDeviceBoard,
  UNGROUPED_GROUP_ID,
  type DeviceBoard,
  type DeviceGroup,
} from '@/lib/device-board';
import {
  deleteDevice,
  fetchAdminState,
  formatDeviceShellVersion,
  isDeviceOnline,
  ordersForScreenToday,
  requestDeviceRelaunch,
  updateDevice,
  type PlayerCampaign,
  type PlayerDevice,
} from '@/lib/player-devices';
import { getPlayerApiBase } from '@/lib/player-bridge';
import {
  modalBtnPrimary,
  modalBtnSecondary,
  portalCardClass,
  portalStickyThClass,
  portalStickyTheadClass,
  portalTableScrollClass,
  portalTdClass,
} from '@/lib/portal-ui';

function deviceMatchesQuery(device: PlayerDevice, query: string): boolean {
  if (!query) return true;
  const hay = [
    device.screenName,
    device.deviceCode,
    device.computerName,
    device.shellVersion,
    `${device.width}x${device.height}`,
  ]
    .join(' ')
    .toLocaleLowerCase('lt-LT');
  return hay.includes(query);
}

export default function DevicesPage() {
  const router = useRouter();
  const { session, loading: sessionLoading } = useAppSession();
  const [devices, setDevices] = useState<PlayerDevice[]>([]);
  const [campaigns, setCampaigns] = useState<PlayerCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<PlayerDevice | null>(null);
  const [editName, setEditName] = useState('');
  const [editWidth, setEditWidth] = useState(1152);
  const [editHeight, setEditHeight] = useState(576);
  const [editGroupId, setEditGroupId] = useState(UNGROUPED_GROUP_ID);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [restartingCode, setRestartingCode] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [board, setBoard] = useState<DeviceBoard>(defaultDeviceBoard);
  const [newGroupName, setNewGroupName] = useState('');
  const [renameGroupId, setRenameGroupId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [dropGroupId, setDropGroupId] = useState<string | null>(null);
  const draggingRef = useRef(false);

  const copyPassword = async (device: PlayerDevice) => {
    if (!device.kioskPassword) return;
    try {
      await navigator.clipboard.writeText(device.kioskPassword);
      setCopiedCode(device.deviceCode);
      window.setTimeout(() => setCopiedCode(null), 2000);
    } catch {
      /* ignore */
    }
  };

  const refresh = useCallback(async () => {
    setError(null);
    const result = await fetchAdminState();
    if (!result.ok) {
      setError(result.error || 'Nepavyko užkrauti');
      setDevices([]);
      setCampaigns([]);
    } else {
      setDevices(result.devices);
      setCampaigns(result.campaigns);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    setBoard(saveDeviceBoard(loadDeviceBoard()));
  }, []);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), 10_000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  const commitBoard = (next: DeviceBoard) => {
    setBoard(saveDeviceBoard(next));
  };

  const ordersCountByDevice = useMemo(() => {
    const map: Record<string, number> = {};
    for (const device of devices) {
      map[device.deviceCode] = ordersForScreenToday(campaigns, device.screenName).length;
    }
    return map;
  }, [devices, campaigns]);

  const normalizedQuery = query.trim().toLocaleLowerCase('lt-LT');
  const visibleGroups: DeviceGroup[] = useMemo(
    () => [...board.groups, { id: UNGROUPED_GROUP_ID, name: 'Be grupės' }],
    [board.groups]
  );

  if (sessionLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 text-gray-600">
        Kraunama…
      </div>
    );
  }

  if (!session) {
    if (typeof window !== 'undefined') window.location.assign('/login');
    return null;
  }

  const openEdit = (device: PlayerDevice) => {
    setEditing(device);
    setEditName(device.screenName || '');
    setEditWidth(Number(device.width) || 1152);
    setEditHeight(Number(device.height) || 576);
    setEditGroupId(
      board.membership[device.deviceCode] &&
        board.groups.some((group) => group.id === board.membership[device.deviceCode])
        ? board.membership[device.deviceCode]
        : UNGROUPED_GROUP_ID
    );
  };

  const saveEdit = async () => {
    if (!editing) return;
    setSaving(true);
    const result = await updateDevice({
      deviceCode: editing.deviceCode,
      screenName: editName.trim(),
      width: editWidth,
      height: editHeight,
    });
    setSaving(false);
    if (!result.ok) {
      alert(result.error || 'Nepavyko išsaugoti');
      return;
    }
    commitBoard(moveDevice(board, editing.deviceCode, editGroupId));
    setEditing(null);
    await refresh();
  };

  const remove = async (device: PlayerDevice) => {
    if (
      !confirm(
        `Ištrinti grotuvą „${device.screenName}“ (${device.deviceCode})?\nPlayeris kitą kartą užsiregistruos iš naujo.`
      )
    ) {
      return;
    }
    const result = await deleteDevice(device.deviceCode);
    if (!result.ok) {
      alert(result.error || 'Nepavyko ištrinti');
      return;
    }
    await refresh();
  };

  const restart = async (device: PlayerDevice) => {
    if (
      !confirm(
        `Paleisti iš naujo „${device.screenName}“?\nPlayeris restartins per ~30 s (heartbeat).`
      )
    ) {
      return;
    }
    setRestartingCode(device.deviceCode);
    const result = await requestDeviceRelaunch(device.deviceCode);
    setRestartingCode(null);
    if (!result.ok) {
      alert(result.error || 'Nepavyko nusiųsti restart');
      return;
    }
    setToast(result.note || `Restart nusiųstas · ${device.screenName} (iki ~30 s)`);
    window.setTimeout(() => setToast(null), 4000);
  };

  const formatSeen = (value?: string) => {
    if (!value) return '—';
    try {
      return new Date(value).toLocaleString('lt-LT');
    } catch {
      return value;
    }
  };

  const handleDrop = (
    event: { dataTransfer: DataTransfer; preventDefault: () => void },
    groupId: string,
    beforeDeviceCode?: string | null
  ) => {
    event.preventDefault();
    const code =
      event.dataTransfer.getData('text/plain') ||
      window.sessionStorage.getItem('piksel-drag-device') ||
      '';
    draggingRef.current = false;
    setDropGroupId(null);
    window.sessionStorage.removeItem('piksel-drag-device');
    if (!code) return;
    commitBoard(moveDevice(board, code, groupId, beforeDeviceCode));
  };

  const startRename = (group: DeviceGroup) => {
    if (group.id === UNGROUPED_GROUP_ID) return;
    setRenameGroupId(group.id);
    setRenameValue(group.name);
  };

  const saveRename = () => {
    if (!renameGroupId) return;
    commitBoard(renameDeviceGroup(board, renameGroupId, renameValue));
    setRenameGroupId(null);
  };

  const addGroup = () => {
    const next = addDeviceGroup(board, newGroupName);
    if (next === board) return;
    commitBoard(next);
    setNewGroupName('');
  };

  return (
    <>
      <div className="play-vertical-grid min-h-screen bg-gray-50 dark:bg-gray-900">
        <AppShell onAddOrder={() => {}} userEmail={session.email}>
          <main className="container mx-auto px-4 py-6">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h1 className="text-lg font-semibold text-gray-900 dark:text-white">Devices</h1>
                <p className="mt-1 text-sm text-gray-500">
                  Windows playeriai iš <code className="text-xs">{getPlayerApiBase()}</code>. Online
                  = sync &lt; 60 s.
                </p>
              </div>
              <button
                type="button"
                className={modalBtnPrimary}
                onClick={() => {
                  setLoading(true);
                  void refresh();
                }}
              >
                <span className="inline-flex items-center gap-1.5">
                  <ArrowPathIcon className="h-4 w-4" />
                  Atnaujinti
                </span>
              </button>
            </div>

            {error && (
              <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
                {error}
              </p>
            )}

            <div className={portalCardClass}>
              <div className="flex flex-wrap items-center gap-3 border-b border-gray-200 px-4 py-3 dark:border-gray-700">
                <h2 className="min-w-0 flex-1 text-sm font-semibold text-gray-900 dark:text-white">
                  All Devices ({devices.length})
                </h2>
                <PortalSearchField
                  value={query}
                  onChange={setQuery}
                  placeholder="Ieškoti pagal pavadinimą, kodą, PC…"
                  className="w-full sm:w-64"
                />
                <div className="flex items-center gap-2">
                  <input
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addGroup();
                      }
                    }}
                    placeholder="Nauja grupė"
                    className="h-10 w-36 rounded-lg border border-gray-300 px-3 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                  />
                  <button
                    type="button"
                    onClick={addGroup}
                    disabled={!newGroupName.trim()}
                    className={modalBtnSecondary}
                    title="Pridėti grupę"
                  >
                    <PlusIcon className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <div className={portalTableScrollClass}>
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className={portalStickyTheadClass}>
                    <tr>
                      <th className={`${portalStickyThClass} w-8`}> </th>
                      <th className={portalStickyThClass}>Name</th>
                      <th className={portalStickyThClass}>Code</th>
                      <th className={portalStickyThClass}>Resolution</th>
                      <th className={portalStickyThClass}>Status</th>
                      <th className={portalStickyThClass}>Versija</th>
                      <th className={portalStickyThClass}>Kiosk psw</th>
                      <th className={portalStickyThClass}>Orderiai</th>
                      <th className={portalStickyThClass}>Last sync</th>
                      <th className={portalStickyThClass}> </th>
                    </tr>
                  </thead>
                  {loading && devices.length === 0 ? (
                    <tbody>
                      <tr>
                        <td colSpan={10} className={`${portalTdClass} text-center`}>
                          Kraunama…
                        </td>
                      </tr>
                    </tbody>
                  ) : devices.length === 0 ? (
                    <tbody>
                      <tr>
                        <td colSpan={10} className={`${portalTdClass} text-center`}>
                          Nėra grotuvų. Paleisk Windows Player ir prijunk prie API.
                        </td>
                      </tr>
                    </tbody>
                  ) : (
                    visibleGroups.map((group) => {
                      const rows = devicesInGroup(board, group.id, devices).filter((device) =>
                        deviceMatchesQuery(device, normalizedQuery)
                      );
                      if (normalizedQuery && rows.length === 0) return null;
                      const over = dropGroupId === group.id;
                      return (
                        <tbody
                          key={group.id}
                          className="divide-y divide-gray-100 bg-white dark:divide-gray-800 dark:bg-gray-800"
                          onDragOver={(event) => {
                            event.preventDefault();
                            setDropGroupId(group.id);
                          }}
                          onDrop={(event) => {
                            event.stopPropagation();
                            handleDrop(event, group.id);
                          }}
                        >
                          <tr className={over ? 'bg-blue-50 dark:bg-blue-950/30' : 'bg-gray-50 dark:bg-gray-900/60'}>
                            <td colSpan={10} className="px-4 py-2">
                              <div className="flex items-center gap-2">
                                {renameGroupId === group.id ? (
                                  <input
                                    autoFocus
                                    value={renameValue}
                                    onChange={(e) => setRenameValue(e.target.value)}
                                    onBlur={saveRename}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') saveRename();
                                      if (e.key === 'Escape') setRenameGroupId(null);
                                    }}
                                    className="h-8 rounded border border-gray-300 px-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                                  />
                                ) : (
                                  <button
                                    type="button"
                                    className="text-sm font-semibold text-gray-800 dark:text-gray-100"
                                    onClick={() => startRename(group)}
                                    title={
                                      group.id === UNGROUPED_GROUP_ID
                                        ? undefined
                                        : 'Pervadinti grupę'
                                    }
                                  >
                                    {group.name}
                                  </button>
                                )}
                                <span className="text-xs text-gray-400">{rows.length}</span>
                                {group.id !== UNGROUPED_GROUP_ID && (
                                  <button
                                    type="button"
                                    title="Ištrinti grupę"
                                    onClick={() => {
                                      if (!confirm(`Ištrinti grupę „${group.name}“? Grotuvai liks be grupės.`)) {
                                        return;
                                      }
                                      commitBoard(removeDeviceGroup(board, group.id));
                                    }}
                                    className="ml-auto rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600"
                                  >
                                    <TrashIcon className="h-4 w-4" />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                          {rows.length === 0 ? (
                            <tr>
                              <td colSpan={10} className={`${portalTdClass} text-center text-gray-400`}>
                                Nutempk grotuvą čia
                              </td>
                            </tr>
                          ) : (
                            rows.map((device) => {
                              const online = isDeviceOnline(device);
                              const orderCount = ordersCountByDevice[device.deviceCode] || 0;
                              const scheduleHref = `/devices/${encodeURIComponent(device.deviceCode)}/scheduling`;
                              return (
                                <tr
                                  key={device.deviceCode}
                                  draggable
                                  onDragStart={(event) => {
                                    draggingRef.current = true;
                                    event.dataTransfer.effectAllowed = 'move';
                                    event.dataTransfer.setData('text/plain', device.deviceCode);
                                    window.sessionStorage.setItem(
                                      'piksel-drag-device',
                                      device.deviceCode
                                    );
                                  }}
                                  onDragEnd={() => {
                                    window.setTimeout(() => {
                                      draggingRef.current = false;
                                    }, 0);
                                    setDropGroupId(null);
                                    window.sessionStorage.removeItem('piksel-drag-device');
                                  }}
                                  onDragOver={(event) => {
                                    event.preventDefault();
                                    event.stopPropagation();
                                    setDropGroupId(group.id);
                                  }}
                                  onDrop={(event) => {
                                    event.stopPropagation();
                                    handleDrop(event, group.id, device.deviceCode);
                                  }}
                                  role="link"
                                  tabIndex={0}
                                  onClick={() => {
                                    if (draggingRef.current) return;
                                    router.push(scheduleHref);
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                      e.preventDefault();
                                      router.push(scheduleHref);
                                    }
                                  }}
                                  className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-900/40"
                                >
                                  <td
                                    className={`${portalTdClass} w-8 cursor-grab text-gray-300 active:cursor-grabbing`}
                                    onClick={(e) => e.stopPropagation()}
                                    title="Tempti į kitą grupę"
                                  >
                                    <Bars2Icon className="h-4 w-4" />
                                  </td>
                                  <td
                                    className={`${portalTdClass} font-medium text-gray-900 dark:text-white`}
                                  >
                                    <div>{device.screenName || '—'}</div>
                                    {device.computerName ? (
                                      <div className="text-[11px] font-normal text-gray-400">
                                        PC: {device.computerName}
                                      </div>
                                    ) : null}
                                  </td>
                                  <td className={`${portalTdClass} font-mono text-xs`}>
                                    {device.deviceCode}
                                  </td>
                                  <td className={portalTdClass}>
                                    {device.width} × {device.height}
                                  </td>
                                  <td className={portalTdClass}>
                                    <span
                                      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                                        online
                                          ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200'
                                          : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-300'
                                      }`}
                                    >
                                      {online ? 'Online' : 'Offline'}
                                    </span>
                                  </td>
                                  <td className={`${portalTdClass} font-mono text-xs`}>
                                    {formatDeviceShellVersion(device.shellVersion)}
                                  </td>
                                  <td
                                    className={portalTdClass}
                                    onClick={(e) => e.stopPropagation()}
                                    onKeyDown={(e) => e.stopPropagation()}
                                  >
                                    {device.kioskPassword ? (
                                      <button
                                        type="button"
                                        title="Kopijuoti slaptažodį"
                                        onClick={() => void copyPassword(device)}
                                        className="max-w-[11rem] truncate rounded bg-amber-50 px-2 py-1 font-mono text-[11px] text-amber-900 hover:bg-amber-100 dark:bg-amber-950/40 dark:text-amber-100"
                                      >
                                        {copiedCode === device.deviceCode
                                          ? 'Nukopijuota'
                                          : device.kioskPassword}
                                      </button>
                                    ) : (
                                      <span className="text-xs text-gray-400">—</span>
                                    )}
                                  </td>
                                  <td className={portalTdClass}>
                                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                      {orderCount}
                                    </span>
                                  </td>
                                  <td className={portalTdClass}>{formatSeen(device.lastSeenAt)}</td>
                                  <td
                                    className={portalTdClass}
                                    onClick={(e) => e.stopPropagation()}
                                    onKeyDown={(e) => e.stopPropagation()}
                                  >
                                    <div className="flex justify-end gap-1">
                                      <button
                                        type="button"
                                        title="Restart player"
                                        disabled={restartingCode === device.deviceCode}
                                        onClick={() => void restart(device)}
                                        className="rounded-lg p-2 text-blue-600 hover:bg-blue-50 hover:text-blue-800 disabled:opacity-50 dark:text-blue-400 dark:hover:bg-blue-950/40 dark:hover:text-blue-200"
                                      >
                                        <ArrowPathIcon
                                          className={`h-4 w-4 ${
                                            restartingCode === device.deviceCode
                                              ? 'animate-spin'
                                              : ''
                                          }`}
                                        />
                                      </button>
                                      <Link
                                        href={scheduleHref}
                                        title="Scheduling"
                                        className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-800 dark:hover:bg-gray-700 dark:hover:text-white"
                                      >
                                        <CalendarDaysIcon className="h-4 w-4" />
                                      </Link>
                                      <button
                                        type="button"
                                        title="Redaguoti"
                                        onClick={() => openEdit(device)}
                                        className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-800 dark:hover:bg-gray-700 dark:hover:text-white"
                                      >
                                        <PencilSquareIcon className="h-4 w-4" />
                                      </button>
                                      <button
                                        type="button"
                                        title="Ištrinti"
                                        onClick={() => void remove(device)}
                                        className="rounded-lg p-2 text-red-500 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950/40"
                                      >
                                        <TrashIcon className="h-4 w-4" />
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      );
                    })
                  )}
                </table>
              </div>
            </div>
          </main>
        </AppShell>
      </div>

      {toast && (
        <div className="fixed bottom-5 right-5 z-50 max-w-sm rounded-lg bg-gray-900 px-3.5 py-2.5 text-xs text-white shadow-lg">
          {toast}
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl dark:bg-gray-800">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Redaguoti device
            </h3>
            <p className="mt-1 text-xs text-gray-500">{editing.deviceCode}</p>
            {editing.kioskPassword ? (
              <div className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm dark:bg-amber-950/30">
                <div className="text-xs text-amber-800 dark:text-amber-200">
                  Kiosk · {editing.kioskUser || 'piksel-kiosk'}
                  {editing.computerName ? ` · ${editing.computerName}` : ''}
                </div>
                <button
                  type="button"
                  onClick={() => void copyPassword(editing)}
                  className="mt-1 font-mono text-amber-950 dark:text-amber-100"
                >
                  {copiedCode === editing.deviceCode ? 'Nukopijuota' : editing.kioskPassword}
                </button>
              </div>
            ) : null}
            <label className="mt-4 block text-sm text-gray-700 dark:text-gray-300">
              Pavadinimas
              <input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white"
              />
            </label>
            <label className="mt-3 block text-sm text-gray-700 dark:text-gray-300">
              Grupė
              <select
                value={editGroupId}
                onChange={(e) => setEditGroupId(e.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white"
              >
                {visibleGroups.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <label className="block text-sm text-gray-700 dark:text-gray-300">
                Plotis
                <input
                  type="number"
                  min={64}
                  value={editWidth}
                  onChange={(e) => setEditWidth(Number(e.target.value))}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                />
              </label>
              <label className="block text-sm text-gray-700 dark:text-gray-300">
                Aukštis
                <input
                  type="number"
                  min={64}
                  value={editHeight}
                  onChange={(e) => setEditHeight(Number(e.target.value))}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                />
              </label>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                className={modalBtnSecondary}
                onClick={() => setEditing(null)}
                disabled={saving}
              >
                Atšaukti
              </button>
              <button
                type="button"
                className={modalBtnPrimary}
                onClick={() => void saveEdit()}
                disabled={saving || !editName.trim()}
              >
                {saving ? 'Saugoma…' : 'Išsaugoti'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
