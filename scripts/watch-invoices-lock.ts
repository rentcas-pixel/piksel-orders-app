import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

export const LOCK_FILE = '.watch-invoices.lock';
const WATCHER_MATCH = 'scripts/watch-received-invoices';

export function findWatcherPids(): number[] {
  try {
    const output = execSync(`pgrep -f "${WATCHER_MATCH}"`, { encoding: 'utf8' }).trim();
    if (!output) return [];
    return output
      .split('\n')
      .map((value) => Number(value.trim()))
      .filter((pid) => Number.isInteger(pid) && pid > 0 && pid !== process.pid);
  } catch {
    return [];
  }
}

export function stopAllWatchers(watchFolder: string): number[] {
  const stopped: number[] = [];

  for (const pid of findWatcherPids()) {
    try {
      process.kill(pid, 'SIGTERM');
      stopped.push(pid);
    } catch {
      // ignore
    }
  }

  const lockPath = path.join(watchFolder, LOCK_FILE);
  try {
    if (fs.existsSync(lockPath)) {
      fs.unlinkSync(lockPath);
    }
  } catch {
    // ignore
  }

  return stopped;
}

function sleep(ms: number): void {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    // brief pause so old watcher processes can exit
  }
}

export function acquireWatcherLock(watchFolder: string): void {
  const lockPath = path.join(watchFolder, LOCK_FILE);
  const existing = findWatcherPids();

  for (const pid of existing) {
    try {
      process.kill(pid, 'SIGTERM');
      console.log(`   Sustabdytas senas stebėtojas (PID ${pid})`);
    } catch {
      // ignore
    }
  }

  if (existing.length > 0) {
    sleep(500);
  }

  try {
    if (fs.existsSync(lockPath)) {
      fs.unlinkSync(lockPath);
    }
  } catch {
    // ignore
  }

  fs.writeFileSync(lockPath, String(process.pid));

  const releaseLock = () => {
    try {
      if (fs.existsSync(lockPath) && fs.readFileSync(lockPath, 'utf8').trim() === String(process.pid)) {
        fs.unlinkSync(lockPath);
      }
    } catch {
      // ignore
    }
  };

  process.on('exit', releaseLock);
  process.on('SIGINT', () => {
    releaseLock();
    process.exit(0);
  });
  process.on('SIGTERM', () => {
    releaseLock();
    process.exit(0);
  });
}
