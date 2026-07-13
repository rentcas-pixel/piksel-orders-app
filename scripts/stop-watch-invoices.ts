import { getWatchFolder } from './invoice-month-folders';
import { loadEnvLocal } from './invoice-folder-import';
import { stopAllWatchers } from './watch-invoices-lock';

loadEnvLocal();

const watchFolder = getWatchFolder();
const stopped = stopAllWatchers(watchFolder);

if (stopped.length === 0) {
  console.log('Stebėtojų nebuvo.');
} else {
  console.log(`Sustabdyti stebėtojai: ${stopped.join(', ')}`);
}

console.log(`Aplankas: ${watchFolder}`);
