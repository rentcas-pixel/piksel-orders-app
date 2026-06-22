import fs from 'fs';
import path from 'path';
import XLSX from 'xlsx';

const inputPath = path.join(process.cwd(), 'data/rekvizitai.xlsx');
const outputPath = path.join(
  process.cwd(),
  'supabase/migrations/20260622_import_billing_companies.sql'
);

function esc(value: unknown): string {
  let s = String(value ?? '').trim();
  if (
    (s.startsWith('"') && s.endsWith('"')) ||
    (s.startsWith("'") && s.endsWith("'"))
  ) {
    s = s.slice(1, -1);
  }
  return s;
}

function sqlStr(value: unknown): string {
  const s = esc(value);
  return s ? `'${s.replace(/'/g, "''")}'` : 'NULL';
}

const workbook = XLSX.readFile(inputPath);
const sheet = workbook.Sheets[workbook.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });

const values: string[] = [];
for (const row of rows) {
  const fullName = esc(row.full_name);
  if (!fullName) continue;

  const name = esc(row.name) || fullName;
  values.push(
    `(${sqlStr(name)}, ${sqlStr(fullName)}, ${sqlStr(row.company_code)}, ${sqlStr(row.vat_code)}, ${sqlStr(row.address)})`
  );
}

const sql = `-- Import billing_companies from data/rekvizitai.xlsx (${values.length} rows)
-- name = full_name when name is empty

INSERT INTO billing_companies (name, full_name, company_code, vat_code, address)
VALUES
${values.join(',\n')};
`;

fs.writeFileSync(outputPath, sql);
console.log(`Wrote ${values.length} rows to ${outputPath}`);
