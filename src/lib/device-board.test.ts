import { describe, expect, it } from 'vitest';
import {
  addDeviceGroup,
  defaultDeviceBoard,
  devicesInGroup,
  groupIdForDevice,
  moveDevice,
  normalizeDeviceBoard,
  removeDeviceGroup,
  renameDeviceGroup,
  UNGROUPED_GROUP_ID,
} from '@/lib/device-board';

const devices = [
  { deviceCode: 'a', screenName: 'Masa' },
  { deviceCode: 'b', screenName: 'Panorama' },
  { deviceCode: 'c', screenName: 'Konstr' },
];

describe('device board', () => {
  it('puts unknown devices in ungrouped', () => {
    const board = defaultDeviceBoard();
    expect(groupIdForDevice(board, 'a')).toBe(UNGROUPED_GROUP_ID);
    expect(devicesInGroup(board, UNGROUPED_GROUP_ID, devices).map((d) => d.deviceCode)).toEqual([
      'a',
      'b',
      'c',
    ]);
  });

  it('moves a device into a named group before another row', () => {
    let board = defaultDeviceBoard();
    board = moveDevice(board, 'a', 'statiniai');
    board = moveDevice(board, 'b', 'statiniai');
    board = moveDevice(board, 'c', 'statiniai', 'b');
    expect(devicesInGroup(board, 'statiniai', devices).map((d) => d.deviceCode)).toEqual([
      'a',
      'c',
      'b',
    ]);
    expect(groupIdForDevice(board, 'c')).toBe('statiniai');
  });

  it('adds, renames and removes groups, sending devices back to ungrouped', () => {
    let board = defaultDeviceBoard();
    board = addDeviceGroup(board, 'LED');
    const led = board.groups.find((group) => group.name === 'LED');
    expect(led).toBeTruthy();
    board = moveDevice(board, 'a', led!.id);
    board = renameDeviceGroup(board, led!.id, 'LED sienos');
    expect(board.groups.find((group) => group.id === led!.id)?.name).toBe('LED sienos');
    board = removeDeviceGroup(board, led!.id);
    expect(groupIdForDevice(board, 'a')).toBe(UNGROUPED_GROUP_ID);
  });

  it('drops invalid membership on normalize', () => {
    const board = normalizeDeviceBoard({
      groups: [{ id: 'statiniai', name: 'Statiniai' }],
      membership: { a: 'missing' },
      order: { missing: ['a'] },
    });
    expect(groupIdForDevice(board, 'a')).toBe(UNGROUPED_GROUP_ID);
  });

  it('adds Video to boards that were saved without it', () => {
    const board = normalizeDeviceBoard({
      groups: [
        { id: 'statiniai', name: 'Statiniai' },
        { id: 'vertikalus', name: 'Vertikalūs' },
        { id: 'viadukai', name: 'Viadukai' },
      ],
      membership: {},
      order: {},
    });
    expect(board.groups.map((group) => group.id)).toEqual([
      'statiniai',
      'vertikalus',
      'viadukai',
      'video',
    ]);
    expect(board.groups.find((group) => group.id === 'video')?.name).toBe('Video');
  });
});
