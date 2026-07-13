/**
 * Perkelia jau apdorotus failus iš apdorotos/ į Piksel-Liepa, Piksel-Birzelis ir pan.
 * Datą ima iš Supabase pagal file_name.
 *
 * Naudojimas:
 *   npm run organize:invoices
 */
import path from 'node:path';
import { createReceivedInvoiceAdminClient } from '../src/lib/received-invoice-service';
import {
  ensureDir,
  listInvoiceFiles,
  loadEnvLocal,
  moveFile,
  PROCESSED_DIR,
  uniqueDestination,
} from './invoice-folder-import';
import {
  formatMonthLabel,
  getArchiveBaseDir,
  getWatchFolder,
  resolveMonthlyFolder,
} from './invoice-month-folders';

async function main(): Promise<void> {
  loadEnvLocal();

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    console.error('Trūksta SUPABASE_SERVICE_ROLE_KEY .env.local faile.');
    process.exit(1);
  }

  const watchFolder = getWatchFolder();
  const archiveBaseDir = getArchiveBaseDir();
  const processedDir = path.join(watchFolder, PROCESSED_DIR);
  ensureDir(processedDir);

  const files = listInvoiceFiles(processedDir);
  if (files.length === 0) {
    console.log('Nėra failų apdorotos/ aplanke.');
    return;
  }

  const db = createReceivedInvoiceAdminClient();
  const { data: invoices, error } = await db
    .from('received_invoices')
    .select('id, invoice_date, file_name')
    .not('file_name', 'is', null);

  if (error) {
    console.error('Nepavyko užkrauti sąskaitų:', error.message);
    process.exit(1);
  }

  const byFileName = new Map<string, string>();
  for (const invoice of invoices ?? []) {
    if (invoice.file_name && invoice.invoice_date) {
      byFileName.set(invoice.file_name, invoice.invoice_date);
    }
  }

  let moved = 0;
  let skipped = 0;

  for (const filePath of files) {
    const filename = path.basename(filePath);
    const invoiceDate = byFileName.get(filename);

    if (!invoiceDate) {
      console.log(`⏭️  ${filename} — nerasta sąskaita DB`);
      skipped += 1;
      continue;
    }

    const monthlyDir = resolveMonthlyFolder(invoiceDate, archiveBaseDir);
    const destination = uniqueDestination(monthlyDir, filename);
    moveFile(filePath, destination);
    console.log(
      `📁 ${filename} → ${path.relative(archiveBaseDir, destination)} (${formatMonthLabel(invoiceDate)})`
    );
    moved += 1;
  }

  console.log(`\nBaigta: ${moved} perkelta, ${skipped} praleista.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
