import fs from 'node:fs';
import path from 'node:path';

/** Atitinka esamus aplankus: Piksel-Birzelis, Piksel-Liepa, ... */
const MONTH_FOLDER_NAMES: Record<number, string> = {
  1: 'Piksel-Sausis',
  2: 'Piksel-Vasaris',
  3: 'Piksel-Kovas',
  4: 'Piksel-Balandis',
  5: 'Piksel-Gegužė',
  6: 'Piksel-Birzelis',
  7: 'Piksel-Liepa',
  8: 'Piksel-Rugpjūtis',
  9: 'Piksel-Rugsėjis',
  10: 'Piksel-Spalis',
  11: 'Piksel-Lapkritis',
  12: 'Piksel-Gruodis',
};

const DEFAULT_WATCH_FOLDER =
  '/Users/renatasparojus/Documents/Piksel/Retai/01_Finansai/Piksel-finansai/Cursor';

export function getWatchFolder(): string {
  return (process.env.RECEIVED_INVOICE_WATCH_FOLDER?.trim() || DEFAULT_WATCH_FOLDER).replace(
    /\/$/,
    ''
  );
}

export function getArchiveBaseDir(): string {
  const configured = process.env.RECEIVED_INVOICE_ARCHIVE_BASE?.trim();
  if (configured) return configured.replace(/\/$/, '');
  return path.dirname(getWatchFolder());
}

export function monthFolderName(invoiceDate: string): string {
  const month = Number(invoiceDate.slice(5, 7));
  return MONTH_FOLDER_NAMES[month] ?? 'Piksel-Kita';
}

export function resolveMonthlyFolder(invoiceDate: string, archiveBaseDir?: string): string {
  const base = archiveBaseDir ?? getArchiveBaseDir();
  const folderName = monthFolderName(invoiceDate);
  const folderPath = path.join(base, folderName);

  if (!fs.existsSync(folderPath)) {
    fs.mkdirSync(folderPath, { recursive: true });
  }

  return folderPath;
}

export function formatMonthLabel(invoiceDate: string): string {
  return monthFolderName(invoiceDate).replace(/^Piksel-/, '');
}
