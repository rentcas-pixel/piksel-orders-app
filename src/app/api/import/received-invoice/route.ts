import { NextResponse } from 'next/server';
import { importReceivedInvoiceFile } from '@/lib/received-invoice-import-server';

export const runtime = 'nodejs';
export const maxDuration = 120;

function isAuthorized(request: Request): boolean {
  const expected = process.env.IMPORT_API_KEY?.trim();
  if (!expected) return false;

  const header = request.headers.get('authorization')?.trim();
  if (header === `Bearer ${expected}`) return true;

  const queryKey = new URL(request.url).searchParams.get('key')?.trim();
  return queryKey === expected;
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Neautorizuota.' }, { status: 401 });
  }

  let file: File;
  try {
    const formData = await request.formData();
    const uploaded = formData.get('file');
    if (!(uploaded instanceof File)) {
      return NextResponse.json({ error: 'Nepateiktas failas.' }, { status: 400 });
    }
    file = uploaded;
  } catch {
    return NextResponse.json({ error: 'Nepavyko nuskaityti užklausos.' }, { status: 400 });
  }

  try {
    const result = await importReceivedInvoiceFile(file);
    return NextResponse.json({
      data: {
        action: result.action,
        id: result.invoice.id,
        seller_name: result.sellerName,
        invoice_number: result.invoiceNumber,
        total_amount: result.totalAmount,
      },
    });
  } catch (error) {
    console.error('import/received-invoice:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Importo klaida.' },
      { status: 500 }
    );
  }
}
