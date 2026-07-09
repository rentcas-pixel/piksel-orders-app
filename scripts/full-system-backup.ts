/**
 * Pilnas sistemos backup: PocketBase kolekcijos + Supabase lentelės + migracijos.
 *
 * Naudojimas:
 *   npx tsx scripts/full-system-backup.ts
 *
 * Reikalauja .env.local su SUPABASE_SERVICE_ROLE_KEY (pilnam Supabase eksportui).
 */
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { config } from '../src/config/index';
import { downloadStorageBackup, type DownloadReport } from './download-storage-backup';

const POCKETBASE_COLLECTIONS = ['orders', 'screens', 'partners', 'bundles', 'quotes'] as const;

const SUPABASE_TABLES = [
  'comments',
  'reminders',
  'file_attachments',
  'order_approval_events',
  'order_invoice_status',
  'order_spec_prices',
  'order_billing_periods',
  'order_billing_gaps',
  'order_billing_schedule',
  'order_invoice_month_flags',
  'billing_companies',
  'invoices',
  'invoice_lines',
  'received_invoices',
  'bank_transactions',
  'payment_allocations',
  'bank_settings',
  'agencies',
  'agency_users',
  'app_users',
  'email_sync_state',
  'processed_emails',
  'email_writing_style',
  'email_reply_embeddings',
] as const;

type PocketBaseExport = {
  collection: string;
  count: number;
  exportedAt: string;
  items: unknown[];
  error?: string;
};

type SupabaseTableExport = {
  table: string;
  count: number;
  exportedAt: string;
  rows: unknown[];
  error?: string;
  skipped?: boolean;
};

function loadEnvLocal(): Record<string, string> {
  const envPath = path.join(process.cwd(), '.env.local');
  if (!fs.existsSync(envPath)) return {};
  return Object.fromEntries(
    fs
      .readFileSync(envPath, 'utf8')
      .split('\n')
      .filter((line) => line && !line.startsWith('#'))
      .map((line) => {
        const index = line.indexOf('=');
        return [line.slice(0, index), line.slice(index + 1)] as const;
      })
      .filter(([key]) => key)
  );
}

function timestampLabel(): string {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
}

async function fetchPocketBaseCollection(collection: string): Promise<PocketBaseExport> {
  const perPage = 200;
  const items: unknown[] = [];
  let page = 1;
  let totalPages = 1;

  try {
    while (page <= totalPages) {
      const url = `${config.pocketbase.url}/api/collections/${collection}/records?page=${page}&perPage=${perPage}`;
      const response = await fetch(url, { signal: AbortSignal.timeout(60_000) });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const payload = (await response.json()) as {
        items?: unknown[];
        totalPages?: number;
      };
      totalPages = payload.totalPages ?? 1;
      items.push(...(payload.items ?? []));
      page += 1;
    }

    return {
      collection,
      count: items.length,
      exportedAt: new Date().toISOString(),
      items,
    };
  } catch (error) {
    return {
      collection,
      count: items.length,
      exportedAt: new Date().toISOString(),
      items,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function fetchSupabaseTable(
  client: SupabaseClient,
  table: string
): Promise<SupabaseTableExport> {
  const pageSize = 1000;
  const rows: unknown[] = [];
  let from = 0;

  try {
    while (true) {
      const { data, error } = await client.from(table).select('*').range(from, from + pageSize - 1);
      if (error) {
        const message = error.message ?? String(error);
        if (/relation .* does not exist|Could not find the table/i.test(message)) {
          return {
            table,
            count: 0,
            exportedAt: new Date().toISOString(),
            rows: [],
            skipped: true,
            error: message,
          };
        }
        throw error;
      }

      const batch = data ?? [];
      rows.push(...batch);
      if (batch.length < pageSize) break;
      from += pageSize;
    }

    return {
      table,
      count: rows.length,
      exportedAt: new Date().toISOString(),
      rows,
    };
  } catch (error) {
    return {
      table,
      count: rows.length,
      exportedAt: new Date().toISOString(),
      rows,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function listStorageObjects(client: SupabaseClient, bucket: string) {
  const objects: unknown[] = [];
  const folders: string[] = [''];

  while (folders.length > 0) {
    const prefix = folders.pop() ?? '';
    let offset = 0;
    const limit = 100;

    while (true) {
      const { data, error } = await client.storage.from(bucket).list(prefix, {
        limit,
        offset,
        sortBy: { column: 'name', order: 'asc' },
      });
      if (error) {
        return { bucket, count: objects.length, objects, error: error.message };
      }

      const entries = data ?? [];
      if (entries.length === 0) break;

      for (const entry of entries) {
        const fullPath = prefix ? `${prefix}/${entry.name}` : entry.name;
        if (entry.id == null) {
          folders.push(fullPath);
          continue;
        }
        objects.push({
          path: fullPath,
          id: entry.id,
          updated_at: entry.updated_at,
          metadata: entry.metadata,
        });
      }

      if (entries.length < limit) break;
      offset += limit;
    }
  }

  return { bucket, count: objects.length, objects };
}

function copyDirectory(source: string, destination: string) {
  if (!fs.existsSync(source)) return;
  fs.mkdirSync(destination, { recursive: true });
  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    const from = path.join(source, entry.name);
    const to = path.join(destination, entry.name);
    if (entry.isDirectory()) {
      copyDirectory(from, to);
    } else {
      fs.copyFileSync(from, to);
    }
  }
}

function readGitInfo() {
  try {
    const commit = execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
    const branch = execSync('git branch --show-current', { encoding: 'utf8' }).trim();
    const message = execSync('git show -s --format=%s', { encoding: 'utf8' }).trim();
    return { commit, branch, message };
  } catch {
    return null;
  }
}

async function main() {
  const env = loadEnvLocal();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? env.SUPABASE_SERVICE_ROLE_KEY;
  const backupId = `pre-refactor-${timestampLabel()}`;
  const backupDir = path.join(process.cwd(), 'backups', backupId);
  const pocketbaseDir = path.join(backupDir, 'pocketbase');
  const supabaseDir = path.join(backupDir, 'supabase');
  const schemaDir = path.join(backupDir, 'schema');

  fs.mkdirSync(pocketbaseDir, { recursive: true });
  fs.mkdirSync(supabaseDir, { recursive: true });
  fs.mkdirSync(schemaDir, { recursive: true });

  console.log(`Backup katalogas: ${backupDir}`);

  const git = readGitInfo();
  const manifest: Record<string, unknown> = {
    backupId,
    createdAt: new Date().toISOString(),
    git,
    gitTag: 'backup/pre-refactor-20260709',
    pocketbaseUrl: config.pocketbase.url,
    supabaseUrl: config.supabase.url,
    pocketbase: [] as PocketBaseExport[],
    supabase: [] as SupabaseTableExport[],
    storage: null as unknown,
    notes: [
      'agency_users ir app_users turi slaptažodžių hash — laikyk saugiai.',
      'Storage failai atsisiunčiami į storage/files/.',
      'Pilnam PB restore reikia admin backup arba atskiro importo įrašų.',
    ],
  };

  console.log('Eksportuojama PocketBase...');
  for (const collection of POCKETBASE_COLLECTIONS) {
    const exported = await fetchPocketBaseCollection(collection);
    manifest.pocketbase.push(exported);
    fs.writeFileSync(
      path.join(pocketbaseDir, `${collection}.json`),
      JSON.stringify(exported, null, 2),
      'utf8'
    );
    console.log(`  ${collection}: ${exported.count}${exported.error ? ` (klaida: ${exported.error})` : ''}`);
  }

  if (!serviceRoleKey) {
    console.warn('Trūksta SUPABASE_SERVICE_ROLE_KEY — Supabase lentelės neeksportuotos.');
    manifest.supabaseSkipped = 'Missing SUPABASE_SERVICE_ROLE_KEY';
  } else {
    const supabase = createClient(config.supabase.url, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    console.log('Eksportuojama Supabase...');
    for (const table of SUPABASE_TABLES) {
      const exported = await fetchSupabaseTable(supabase, table);
      manifest.supabase.push(exported);
      fs.writeFileSync(
        path.join(supabaseDir, `${table}.json`),
        JSON.stringify(exported, null, 2),
        'utf8'
      );
      const suffix = exported.skipped
        ? ' (lentelė nerasta)'
        : exported.error
          ? ` (klaida: ${exported.error})`
          : '';
      console.log(`  ${table}: ${exported.count}${suffix}`);
    }

    console.log('Skenuojamas Supabase Storage (files)...');
    const storage = await listStorageObjects(supabase, 'files');
    manifest.storage = storage;
    fs.writeFileSync(
      path.join(supabaseDir, '_storage_files_index.json'),
      JSON.stringify(storage, null, 2),
      'utf8'
    );
    console.log(`  files bucket: ${storage.count} objektų`);

    console.log('Atsisiunčiami Storage failai...');
    const storageDownload = await downloadStorageBackup({
      backupDir,
      client: supabase,
      bucket: 'files',
    });
    manifest.storageDownload = storageDownload;
    console.log(
      `  atsisiųsta: ${storageDownload.downloaded}, praleista: ${storageDownload.skipped}, klaidų: ${storageDownload.failed}, ${(storageDownload.bytes / 1024 / 1024).toFixed(1)} MB`
    );
  }

  console.log('Kopijuojamos migracijos...');
  copyDirectory(path.join(process.cwd(), 'supabase', 'migrations'), path.join(schemaDir, 'migrations'));
  if (fs.existsSync(path.join(process.cwd(), 'supabase-setup.sql'))) {
    fs.copyFileSync(
      path.join(process.cwd(), 'supabase-setup.sql'),
      path.join(schemaDir, 'supabase-setup.sql')
    );
  }

  fs.writeFileSync(path.join(backupDir, 'manifest.json'), JSON.stringify({
    ...manifest,
    pocketbase: (manifest.pocketbase as PocketBaseExport[]).map(({ collection, count, exportedAt, error }) => ({
      collection,
      count,
      exportedAt,
      error,
    })),
    supabase: (manifest.supabase as SupabaseTableExport[]).map(
      ({ table, count, exportedAt, error, skipped }) => ({
        table,
        count,
        exportedAt,
        error,
        skipped,
      })
    ),
    storage: manifest.storage
      ? {
          bucket: (manifest.storage as { bucket: string; count: number }).bucket,
          count: (manifest.storage as { bucket: string; count: number }).count,
          download: manifest.storageDownload as DownloadReport | undefined,
        }
      : null,
  }, null, 2), 'utf8');
  fs.writeFileSync(
    path.join(backupDir, 'README.txt'),
    [
      `Piksel Orders pilnas backup: ${backupId}`,
      '',
      'Turinys:',
      '- pocketbase/*.json',
      '- supabase/*.json',
      '- storage/files/ (bucket turinys)',
      '- schema/migrations',
      '- manifest.json',
      '',
      'Git atkūrimas:',
      '  git checkout backup/pre-refactor-20260709',
      '',
      'Šis backup saugo JSON eksportus ir Storage failų kopijas.',
    ].join('\n'),
    'utf8'
  );

  console.log('Baigta.');
  console.log(manifest);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
