export const PLAY_WORK_LINKS: { href: string; label: string; match: (path: string) => boolean }[] = [
  { href: '/test-orders', label: 'Test orderiai', match: (path) => path.startsWith('/test-orders') },
  { href: '/monitoring', label: 'Stebėjimas', match: (path) => path.startsWith('/monitoring') },
  { href: '/devices', label: 'Devices', match: (path) => path.startsWith('/devices') },
  { href: '/media', label: 'Media', match: (path) => path.startsWith('/media') },
];
