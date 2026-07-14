import fs from 'node:fs';
import path from 'node:path';
import {
  fileFromBuffer,
  importReceivedInvoiceFile,
  isSupportedReceivedInvoiceFilename,
} from '../src/lib/received-invoice-import-server';
import {
  formatMonthLabel,
  getArchiveBaseDir,
  resolveMonthlyFolder,
} from './invoice-month-folders';
import {
  getSkipReason,
  isImportableInvoiceFilename,
} from './invoice-heuristics';

export const PROCESSED_DIR = 'apdorotos';
export const FAILED_DIR = 'klaidos';
export const SKIPPED_DIR = 'praleisti';

function isEnoentError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as NodeJS.ErrnoException).code === 'ENOENT'
  );
}

export function loadEnvLocal(): void {
  const envPath = path.join(process.cwd(), '.env.local');
  if (!fs.existsSync(envPath)) return;

  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    if (!line || line.startsWith('#')) continue;
    const index = line.indexOf('=');
    if (index <= 0) continue;
    const key = line.slice(0, index).trim();
    const value = line.slice(index + 1).trim();
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

export function ensureDir(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

export function uniqueDestination(dir: string, filename: string): string {
  const base = path.join(dir, filename);
  if (!fs.existsSync(base)) return base;

  const ext = path.extname(filename);
  const stem = path.basename(filename, ext);
  let counter = 1;
  while (true) {
    const candidate = path.join(dir, `${stem}_${counter}${ext}`);
    if (!fs.existsSync(candidate)) return candidate;
    counter += 1;
  }
}

export function moveFile(sourcePath: string, destPath: string): void {
  if (!fs.existsSync(sourcePath)) return;
  ensureDir(path.dirname(destPath));
  fs.renameSync(sourcePath, destPath);
}

export function fileKey(filePath: string): string | null {
  try {
    const stat = fs.statSync(filePath);
    return `${stat.dev}:${stat.ino}`;
  } catch {
    return null;
  }
}

export function listInvoiceFiles(folder: string): string[] {
  if (!fs.existsSync(folder)) return [];

  return fs
    .readdirSync(folder, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .filter((entry) => !entry.name.startsWith('.'))
    .filter((entry) => isSupportedReceivedInvoiceFilename(entry.name))
    .filter((entry) => isImportableInvoiceFilename(entry.name))
    .map((entry) => path.join(folder, entry.name));
}

export function listSkippedCandidateFiles(folder: string): string[] {
  if (!fs.existsSync(folder)) return [];

  return fs
    .readdirSync(folder, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .filter((entry) => !entry.name.startsWith('.'))
    .filter((entry) => isSupportedReceivedInvoiceFilename(entry.name))
    .filter((entry) => !isImportableInvoiceFilename(entry.name))
    .map((entry) => path.join(folder, entry.name));
}

export function relocateSkippedFile(
  filePath: string,
  watchFolder: string,
  skippedDir: string
): boolean {
  const filename = path.basename(filePath);
  const reason = getSkipReason(filename);
  if (!reason || !fs.existsSync(filePath)) return false;

  const destination = uniqueDestination(skippedDir, filename);
  moveFile(filePath, destination);
  console.log(`⏭️  ${filename} → ${path.relative(watchFolder, destination)} (${reason})`);
  return true;
}

export function resolveInvoiceFilePath(folder: string, filename: string): string | null {
  if (!fs.existsSync(folder)) return null;

  const target = filename.normalize('NFC');
  for (const entry of fs.readdirSync(folder)) {
    if (entry.normalize('NFC') === target) {
      return path.join(folder, entry);
    }
  }

  const direct = path.join(folder, filename);
  return fs.existsSync(direct) ? direct : null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForStableFile(filePath: string): Promise<boolean> {
  let lastSize = -1;
  let stableCount = 0;

  while (stableCount < 2) {
    if (!fs.existsSync(filePath)) {
      return false;
    }
    const stat = fs.statSync(filePath);
    if (stat.size > 0 && stat.size === lastSize) {
      stableCount += 1;
    } else {
      stableCount = 0;
      lastSize = stat.size;
    }
    await sleep(1000);
  }

  return true;
}

export async function importInvoiceFile(options: {
  filePath: string;
  failedDir: string;
  watchFolder: string;
}): Promise<'processed' | 'failed' | 'skipped'> {
  const { failedDir, watchFolder } = options;
  const filePath =
    resolveInvoiceFilePath(path.dirname(options.filePath), path.basename(options.filePath)) ??
    options.filePath;
  const filename = path.basename(filePath);

  if (!fs.existsSync(filePath)) {
    return 'skipped';
  }

  console.log(`\n📄 Apdorojama: ${filename}`);

  try {
    const stable = await waitForStableFile(filePath);
    if (!stable) {
      console.log(`   (praleista — failas jau perkeltas)`);
      return 'skipped';
    }

    if (!fs.existsSync(filePath)) {
      console.log(`   (praleista — failas jau apdorotas)`);
      return 'skipped';
    }

    const buffer = fs.readFileSync(filePath);
    const file = fileFromBuffer(buffer, filename);
    const result = await importReceivedInvoiceFile(file);

    const actionLabel = result.action === 'created' ? 'Sukurta' : 'Atnaujinta';
    console.log(
      `✅ ${actionLabel}: ${result.sellerName}` +
        (result.invoiceNumber ? ` #${result.invoiceNumber}` : '') +
        ` — ${result.totalAmount.toFixed(2)}`
    );

    const archiveBaseDir = getArchiveBaseDir();
    const monthlyDir = resolveMonthlyFolder(result.invoice.invoice_date, archiveBaseDir);
    const destination = uniqueDestination(monthlyDir, filename);
    moveFile(filePath, destination);
    console.log(
      `   → ${path.relative(archiveBaseDir, destination)} (${formatMonthLabel(result.invoice.invoice_date)})`
    );
    return 'processed';
  } catch (error) {
    if (isEnoentError(error)) {
      console.log(`   (praleista — failas jau apdorotas kitu procesu)`);
      return 'skipped';
    }

    const message =
      error instanceof Error
        ? error.message
        : typeof error === 'object' && error !== null && 'message' in error
          ? String((error as { message: unknown }).message)
          : 'Nežinoma klaida';
    console.error(`❌ Klaida (${filename}): ${message}`);

    if (fs.existsSync(filePath)) {
      try {
        const destination = uniqueDestination(failedDir, filename);
        moveFile(filePath, destination);
        console.log(`   → ${path.relative(watchFolder, destination)}`);
      } catch (moveError) {
        console.error('   Nepavyko perkelti failo į klaidos aplanką:', moveError);
      }
    }

    return 'failed';
  }
}

export async function importInvoiceFolder(options: {
  sourceFolder: string;
  watchFolder: string;
}): Promise<{ processed: number; failed: number; skipped: number }> {
  const { sourceFolder, watchFolder } = options;
  const processedDir = path.join(watchFolder, PROCESSED_DIR);
  const failedDir = path.join(watchFolder, FAILED_DIR);

  ensureDir(processedDir);
  ensureDir(failedDir);

  const files = listInvoiceFiles(sourceFolder);
  let processed = 0;
  let failed = 0;
  let skipped = 0;

  for (const filePath of files) {
    const result = await importInvoiceFile({
      filePath,
      processedDir,
      failedDir,
      watchFolder,
    });
    if (result === 'processed') processed += 1;
    if (result === 'failed') failed += 1;
    if (result === 'skipped') skipped += 1;
  }

  return { processed, failed, skipped };
}
