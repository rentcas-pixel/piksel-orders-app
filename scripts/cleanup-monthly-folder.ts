/**
 * Išvalo mėnesio aplanką — netinkamus failus perkelia į Ne-saskaitos/.
 *
 * Naudojimas:
 *   npm run cleanup:month-folder
 *   npm run cleanup:month-folder -- Piksel-Birzelis
 */
import fs from 'node:fs';
import path from 'node:path';
import {
  ensureDir,
  moveFile,
  uniqueDestination,
} from './invoice-folder-import';
import {
  getArchiveBaseDir,
  monthFolderName,
} from './invoice-month-folders';
import {
  getSkipReason,
  isVideoarchitektaiFilename,
  isUuidOnlyImageFilename,
} from './invoice-heuristics';

const JUNK_BASE = 'Ne-saskaitos';

function junkSubfolder(filename: string, isDir: boolean): string {
  if (isDir) return 'Aplankai';
  if (isVideoarchitektaiFilename(filename)) return 'Videoarchitektai';
  if (isUuidOnlyImageFilename(filename)) return 'Kvitai-be-pavadinimo';
  if (/\bswed\b/i.test(filename) || /\bbank/i.test(filename) || /isras/i.test(filename)) {
    return 'Bankas';
  }
  if (/\btnt[_-]/i.test(filename)) return 'Kurjeris';
  return 'Kita';
}

function main(): void {
  const archiveBase = getArchiveBaseDir();
  const monthArg = process.argv[2]?.trim();
  const monthFolder = monthArg || monthFolderName(`${new Date().getFullYear()}-06-01`);
  const sourceDir = path.join(archiveBase, monthFolder);

  if (!fs.existsSync(sourceDir)) {
    console.error(`Aplankas nerastas: ${sourceDir}`);
    process.exit(1);
  }

  const junkBaseDir = path.join(archiveBase, JUNK_BASE);
  let moved = 0;
  let kept = 0;

  console.log(`🧹 Valomas aplankas: ${sourceDir}\n`);

  for (const entry of fs.readdirSync(sourceDir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;

    const fullPath = path.join(sourceDir, entry.name);
    const isDir = entry.isDirectory();
    const reason = isDir ? 'Aplankas' : getSkipReason(entry.name);

    if (!reason) {
      kept += 1;
      continue;
    }

    const subfolder = junkSubfolder(entry.name, isDir);
    const destDir = path.join(junkBaseDir, subfolder);
    ensureDir(destDir);

    const destination = uniqueDestination(destDir, entry.name);
    moveFile(fullPath, destination);
    console.log(`📦 ${entry.name}`);
    console.log(`   → ${path.relative(archiveBase, destination)} (${reason})`);
    moved += 1;
  }

  console.log(`\nBaigta: ${moved} perkelta, ${kept} palikta.`);
}

main();
