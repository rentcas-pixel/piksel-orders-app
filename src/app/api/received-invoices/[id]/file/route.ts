import { NextResponse } from 'next/server';
import { detectReceivedInvoiceMime } from '@/lib/received-invoice-file';
import { ReceivedInvoiceService } from '@/lib/received-invoice-service';
import { loadReceivedInvoiceFileBytes } from '@/lib/received-invoice-storage';

export const runtime = 'nodejs';

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const invoice = await ReceivedInvoiceService.getById(id);

    if (!invoice?.file_url) {
      return NextResponse.json({ error: 'Sąskaita neturi failo.' }, { status: 404 });
    }

    const bytes = await loadReceivedInvoiceFileBytes(invoice.file_url);
    const mime = detectReceivedInvoiceMime(bytes, invoice.file_name);

    return new NextResponse(bytes, {
      headers: {
        'Content-Type': mime,
        'Cache-Control': 'private, max-age=60',
      },
    });
  } catch (error) {
    console.error('Received invoice file download error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Nepavyko atsisiųsti failo.' },
      { status: 500 }
    );
  }
}
