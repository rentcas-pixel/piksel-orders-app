/**
 * Importuoja visus PDF iš nurodyto aplanko (pvz. klaidos/).
 *
 * Naudojimas:
 *   npm run import:invoices-folder
 *   npm run import:invoices-folder -- /kelias/iki/klaidos
 */
import path from 'node:path';
import {
  importInvoiceFolder,
  loadEnvLocal,
  FAILED_DIR,
} from './invoice-folder-import';

const DEFAULT_WATCH_FOLDER =
  '/Users/renatasparojus/Documents/Piksel/Retai/01_Finansai/Piksel-finansai/Cursor';

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

  const watchFolder = (
    process.env.RECEIVED_INVOICE_WATCH_FOLDER?.trim() || DEFAULT_WATCH_FOLDER
  ).replace(/\/$/, '');

  const sourceFolder = process.argv[2]
    ? path.resolve(process.argv[2])
    : path.join(watchFolder, FAILED_DIR);

  console.log(`📥 Importuojama iš: ${sourceFolder}`);

  const summary = await importInvoiceFolder({ sourceFolder, watchFolder });

  console.log(
    `\nBaigta: ${summary.processed} importuota, ${summary.failed} klaidų, ${summary.skipped} praleista.`
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
