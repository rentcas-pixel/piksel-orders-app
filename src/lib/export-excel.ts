import * as XLSX from 'xlsx';

/** Parsisiųsti Excel failą */
export function downloadExcel(data: unknown[][], filename: string) {
  const ws = XLSX.utils.aoa_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Duomenys');
  XLSX.writeFile(wb, `${filename}.xlsx`);
}
