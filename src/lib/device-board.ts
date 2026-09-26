import { randomId } from '@/lib/random-id';

export const UNGROUPED_GROUP_ID = 'ungrouped';
export const DEVICE_BOARD_STORAGE_KEY = 'pikselPlayDeviceBoard';

export type DeviceGroup = {
  id: string;
  name: string;
};

export type DeviceBoard = {
  groups: DeviceGroup[];
  membership: Record<string, string>;
  order: Record<string, string[]>;
};

export const DEFAULT_DEVICE_GROUPS: DeviceGroup[] = [
  { id: 'statiniai', name: 'Statiniai' },
  { id: 'vertikalus', name: 'Vertikalūs' },
  { id: 'viadukai', name: 'Viadukai' },
  { id: 'video', name: 'Video' },
];

export function defaultDeviceBoard(): DeviceBoard {
  const groups = DEFAULT_DEVICE_GROUPS.map((group) => ({ ...group }));
  return {
    groups,
    membership: {},
    order: Object.fromEntries(
      [...groups.map((group) => group.id), UNGROUPED_GROUP_ID].map((id) => [id, [] as string[]])
    ),
  };
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function normalizeDeviceBoard(raw: unknown): DeviceBoard {
  const fallback = defaultDeviceBoard();
  const data = asRecord(raw);
  const groups = Array.isArray(data.groups)
    ? data.groups
        .map((item) => {
          const row = asRecord(item);
          const id = String(row.id || '').trim();
          const name = String(row.name || '').trim();
          if (!id || id === UNGROUPED_GROUP_ID || !name) return null;
          return { id, name };
        })
        .filter((group): group is DeviceGroup => Boolean(group))
    : fallback.groups;

  const uniqueGroups: DeviceGroup[] = [];
  const seen = new Set<string>();
  for (const group of groups.length ? groups : fallback.groups) {
    if (seen.has(group.id)) continue;
    seen.add(group.id);
    uniqueGroups.push(group);
  }
  for (const group of fallback.groups) {
    if (seen.has(group.id)) continue;
    seen.add(group.id);
    uniqueGroups.push(group);
  }

  const membership: Record<string, string> = {};
  const membershipRaw = asRecord(data.membership);
  for (const [deviceCode, groupId] of Object.entries(membershipRaw)) {
    const code = String(deviceCode || '').trim();
    const gid = String(groupId || '').trim();
    if (!code) continue;
    membership[code] = seen.has(gid) ? gid : UNGROUPED_GROUP_ID;
  }

  const order: Record<string, string[]> = {};
  const orderRaw = asRecord(data.order);
  for (const id of [...uniqueGroups.map((group) => group.id), UNGROUPED_GROUP_ID]) {
    const listed = Array.isArray(orderRaw[id])
      ? (orderRaw[id] as unknown[]).map((code) => String(code || '').trim()).filter(Boolean)
      : [];
    const unique: string[] = [];
    const used = new Set<string>();
    for (const code of listed) {
      if (used.has(code)) continue;
      if ((membership[code] || UNGROUPED_GROUP_ID) !== id) continue;
      used.add(code);
      unique.push(code);
    }
    order[id] = unique;
  }

  for (const [code, groupId] of Object.entries(membership)) {
    const gid = seen.has(groupId) ? groupId : UNGROUPED_GROUP_ID;
    membership[code] = gid;
    if (!order[gid].includes(code)) order[gid].push(code);
  }

  return { groups: uniqueGroups, membership, order };
}

export function loadDeviceBoard(): DeviceBoard {
  if (typeof window === 'undefined') return defaultDeviceBoard();
  try {
    const raw = window.localStorage.getItem(DEVICE_BOARD_STORAGE_KEY);
    if (!raw) return defaultDeviceBoard();
    return normalizeDeviceBoard(JSON.parse(raw));
  } catch {
    return defaultDeviceBoard();
  }
}

export function saveDeviceBoard(board: DeviceBoard): DeviceBoard {
  const next = normalizeDeviceBoard(board);
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(DEVICE_BOARD_STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* ignore quota */
    }
  }
  return next;
}

export function groupIdForDevice(board: DeviceBoard, deviceCode: string): string {
  const id = board.membership[deviceCode];
  if (id && board.groups.some((group) => group.id === id)) return id;
  return UNGROUPED_GROUP_ID;
}

export function devicesInGroup<T extends { deviceCode: string }>(
  board: DeviceBoard,
  groupId: string,
  devices: T[]
): T[] {
  const byCode = new Map(devices.map((device) => [device.deviceCode, device]));
  const listed = (board.order[groupId] || [])
    .map((code) => byCode.get(code))
    .filter((device): device is T => Boolean(device));
  const listedSet = new Set(listed.map((device) => device.deviceCode));
  const extras = devices.filter(
    (device) =>
      groupIdForDevice(board, device.deviceCode) === groupId && !listedSet.has(device.deviceCode)
  );
  return [...listed, ...extras];
}

export function moveDevice(
  board: DeviceBoard,
  deviceCode: string,
  toGroupId: string,
  beforeDeviceCode?: string | null
): DeviceBoard {
  const targetGroup =
    toGroupId === UNGROUPED_GROUP_ID || board.groups.some((group) => group.id === toGroupId)
      ? toGroupId
      : UNGROUPED_GROUP_ID;
  const membership = { ...board.membership, [deviceCode]: targetGroup };
  const order: Record<string, string[]> = {};
  for (const [groupId, codes] of Object.entries(board.order)) {
    order[groupId] = codes.filter((code) => code !== deviceCode);
  }
  if (!order[targetGroup]) order[targetGroup] = [];
  const next = order[targetGroup].filter((code) => code !== deviceCode);
  const insertAt =
    beforeDeviceCode && beforeDeviceCode !== deviceCode
      ? next.indexOf(beforeDeviceCode)
      : -1;
  if (insertAt >= 0) next.splice(insertAt, 0, deviceCode);
  else next.push(deviceCode);
  order[targetGroup] = next;
  return normalizeDeviceBoard({ ...board, membership, order });
}

export function addDeviceGroup(board: DeviceBoard, name: string): DeviceBoard {
  const trimmed = name.trim();
  if (!trimmed) return board;
  const id = `g-${randomId()}`;
  return normalizeDeviceBoard({
    ...board,
    groups: [...board.groups, { id, name: trimmed }],
    order: { ...board.order, [id]: [] },
  });
}

export function renameDeviceGroup(board: DeviceBoard, groupId: string, name: string): DeviceBoard {
  const trimmed = name.trim();
  if (!trimmed || groupId === UNGROUPED_GROUP_ID) return board;
  return normalizeDeviceBoard({
    ...board,
    groups: board.groups.map((group) => (group.id === groupId ? { ...group, name: trimmed } : group)),
  });
}

export function removeDeviceGroup(board: DeviceBoard, groupId: string): DeviceBoard {
  if (groupId === UNGROUPED_GROUP_ID) return board;
  const membership = { ...board.membership };
  for (const [code, gid] of Object.entries(membership)) {
    if (gid === groupId) membership[code] = UNGROUPED_GROUP_ID;
  }
  const order = { ...board.order };
  const moved = order[groupId] || [];
  delete order[groupId];
  order[UNGROUPED_GROUP_ID] = [...(order[UNGROUPED_GROUP_ID] || []), ...moved.filter((code) => !order[UNGROUPED_GROUP_ID]?.includes(code))];
  return normalizeDeviceBoard({
    ...board,
    groups: board.groups.filter((group) => group.id !== groupId),
    membership,
    order,
  });
}
