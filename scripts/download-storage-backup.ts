/**
 * Atsisiunčia Supabase Storage failus į esamą backup katalogą.
 *
 * Naudojimas:
 *   npx tsx scripts/download-storage-backup.ts
 *   npx tsx scripts/download-storage-backup.ts backups/pre-refactor-20260709-152113
 */
import fs from 'node:fs';
import path from 'node:path';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { config } from '../src/config/index';

type StorageIndex = {
  bucket: string;
  count: number;
  objects: Array<{ path: string; id?: string; updated_at?: string }>;
  error?: string;
};

type DownloadReport = {
  bucket: string;
  total: number;
  downloaded: number;
  skipped: number;
  failed: number;
  bytes: number;
  exportedAt: string;
  errors: Array<{ path: string; error: string }>;
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

function resolveBackupDir(arg?: string): string {
  if (arg) {
    return path.isAbsolute(arg) ? arg : path.join(process.cwd(), arg);
  }
  const backupsRoot = path.join(process.cwd(), 'backups');
  if (!fs.existsSync(backupsRoot)) {
    throw new Error('Nerastas backups/ katalogas. Pirmiausia paleisk npm run backup:full');
  }
  const dirs = fs
    .readdirSync(backupsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()
    .reverse();
  if (dirs.length === 0) {
    throw new Error('Nerastas joks backup katalogas.');
  }
  return path.join(backupsRoot, dirs[0]);
}

function safeLocalPath(storagePath: string): string {
  const normalized = path.normalize(storagePath).replace(/^(\.\.(\/|\\|$))+/, '');
  if (normalized.startsWith('..')) {
    throw new Error(`Unsafe storage path: ${storagePath}`);
  }
  return normalized;
}

async function listStorageObjects(client: SupabaseClient, bucket: string): Promise<StorageIndex> {
  const objects: StorageIndex['objects'] = [];
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
        });
      }

      if (entries.length < limit) break;
      offset += limit;
    }
  }

  return { bucket, count: objects.length, objects };
}

async function runPool<T>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<void>
): Promise<void> {
  let nextIndex = 0;
  const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (nextIndex < items.length) {
      const current = nextIndex;
      nextIndex += 1;
      await worker(items[current], current);
    }
  });
  await Promise.all(runners);
}

export async function downloadStorageBackup(params: {
  backupDir: string;
  client: SupabaseClient;
  bucket?: string;
  concurrency?: number;
}): Promise<DownloadReport> {
  const bucket = params.bucket ?? 'files';
  const concurrency = params.concurrency ?? 8;
  const supabaseDir = path.join(params.backupDir, 'supabase');
  const storageDir = path.join(params.backupDir, 'storage', bucket);
  const indexPath = path.join(supabaseDir, '_storage_files_index.json');

  let index: StorageIndex;
  if (fs.existsSync(indexPath)) {
    index = JSON.parse(fs.readFileSync(indexPath, 'utf8')) as StorageIndex;
  } else {
    index = await listStorageObjects(params.client, bucket);
    fs.mkdirSync(supabaseDir, { recursive: true });
    fs.writeFileSync(indexPath, JSON.stringify(index, null, 2), 'utf8');
  }

  const report: DownloadReport = {
    bucket,
    total: index.objects.length,
    downloaded: 0,
    skipped: 0,
    failed: 0,
    bytes: 0,
    exportedAt: new Date().toISOString(),
    errors: [],
  };

  await runPool(index.objects, concurrency, async (object, itemIndex) => {
    const relativePath = safeLocalPath(object.path);
    const localPath = path.join(storageDir, relativePath);

    if (fs.existsSync(localPath)) {
      report.skipped += 1;
      return;
    }

    try {
      const { data, error } = await params.client.storage.from(bucket).download(object.path);
      if (error || !data) {
        throw new Error(error?.message ?? 'Empty download response');
      }

      fs.mkdirSync(path.dirname(localPath), { recursive: true });
      const buffer = Buffer.from(await data.arrayBuffer());
      fs.writeFileSync(localPath, buffer);
      report.downloaded += 1;
      report.bytes += buffer.length;

      if ((itemIndex + 1) % 50 === 0 || itemIndex + 1 === index.objects.length) {
        console.log(
          `  ${itemIndex + 1}/${index.objects.length} — atsisiųsta ${report.downloaded}, praleista ${report.skipped}, klaidų ${report.failed}`
        );
      }
    } catch (error) {
      report.failed += 1;
      report.errors.push({
        path: object.path,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  fs.mkdirSync(supabaseDir, { recursive: true });
  fs.writeFileSync(
    path.join(supabaseDir, '_storage_files_download.json'),
    JSON.stringify(report, null, 2),
    'utf8'
  );

  return report;
}

async function main() {
  const env = loadEnvLocal();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    console.error('Trūksta SUPABASE_SERVICE_ROLE_KEY.');
    process.exit(1);
  }

  const backupDir = resolveBackupDir(process.argv[2]);
  const supabase = createClient(config.supabase.url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  console.log(`Storage backup į: ${backupDir}`);
  const report = await downloadStorageBackup({ backupDir, client: supabase });
  console.log(
    `Baigta: ${report.downloaded} nauji, ${report.skipped} jau buvo, ${report.failed} klaidų, ${(report.bytes / 1024 / 1024).toFixed(1)} MB`
  );
  if (report.errors.length > 0) {
    console.log('Pirmos klaidos:');
    for (const entry of report.errors.slice(0, 10)) {
      console.log(`  ${entry.path}: ${entry.error}`);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
