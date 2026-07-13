/**
 * Stebi vietinį aplanką ir automatiškai importuoja gautas sąskaitas (OCR + Supabase).
 *
 * Naudojimas:
 *   npm run watch:invoices
 *   npm run stop:invoices   (sustabdyti visus)
 */
import fs from 'node:fs';
import path from 'node:path';
import {
  fileKey,
  importInvoiceFile,
  listInvoiceFiles,
  loadEnvLocal,
  FAILED_DIR,
  PROCESSED_DIR,
} from './invoice-folder-import';
import { getWatchFolder } from './invoice-month-folders';
import { acquireWatcherLock } from './watch-invoices-lock';

const POLL_INTERVAL_MS = 2000;

async function main(): Promise<void> {
  loadEnvLocal();

  if (!process.env.MISTRAL_API_KEY?.trim()) {
    console.error('Trūksta MISTRAL_API_KEY .env.local faile.');
    process.exit(1);
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    console.error('Trūksta SUPABASE_SERVICE_ROLE_KEY .env.local faile.');
    process.exit(1);
  }

  const watchFolder = getWatchFolder();
  const processedDir = path.join(watchFolder, PROCESSED_DIR);
  const failedDir = path.join(watchFolder, FAILED_DIR);

  fs.mkdirSync(watchFolder, { recursive: true });
  fs.mkdirSync(processedDir, { recursive: true });
  fs.mkdirSync(failedDir, { recursive: true });
  acquireWatcherLock(watchFolder);

  const processing = new Set<string>();
  const queue: string[] = [];
  let draining = false;

  async function drainQueue(): Promise<void> {
    if (draining) return;
    draining = true;
    try {
      while (queue.length > 0) {
        const filePath = queue.shift();
        if (!filePath) continue;

        const key = fileKey(filePath);
        if (!key || processing.has(key)) continue;

        processing.add(key);
        try {
          await importInvoiceFile({
            filePath,
            processedDir,
            failedDir,
            watchFolder,
          });
        } finally {
          processing.delete(key);
        }
      }
    } finally {
      draining = false;
      if (queue.length > 0) {
        void drainQueue();
      }
    }
  }

  function enqueueIfNew(filePath: string): void {
    const key = fileKey(filePath);
    if (!key || processing.has(key) || queue.some((item) => fileKey(item) === key)) {
      return;
    }
    queue.push(filePath);
    void drainQueue();
  }

  function scanFolder(): void {
    if (queue.length > 0 || processing.size > 0) return;
    for (const filePath of listInvoiceFiles(watchFolder)) {
      enqueueIfNew(filePath);
    }
  }

  console.log('🔍 Gautų sąskaitų stebėtojas paleistas');
  console.log(`   Aplankas: ${watchFolder}`);
  console.log(`   Įkelkite PDF arba paveikslėlį — importas vyks automatiškai`);
  console.log(`   Sėkmė → Piksel-{mėnuo}/, klaida → ${FAILED_DIR}/`);
  console.log('   Sustabdyti: Ctrl+C arba npm run stop:invoices\n');

  scanFolder();
  setInterval(scanFolder, POLL_INTERVAL_MS);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
