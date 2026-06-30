import { NextResponse } from 'next/server';
import { processIssuedInvoiceOcr } from '@/lib/mistral-ocr-server';
import { parsePikselIssuedInvoicePdf } from '@/lib/piksel-issued-invoice-parser';

export const runtime = 'nodejs';
export const maxDuration = 120;

const MAX_FILE_BYTES = 15 * 1024 * 1024;

function resolveMimeType(file: File): string {
  if (file.type) return file.type;
  const name = file.name.toLowerCase();
  if (name.endsWith('.pdf')) return 'application/pdf';
  if (name.endsWith('.png')) return 'image/png';
  if (name.endsWith('.jpg') || name.endsWith('.jpeg')) return 'image/jpeg';
  if (name.endsWith('.webp')) return 'image/webp';
  return 'application/octet-stream';
}

export async function POST(request: Request) {
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

  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json({ error: 'Failas per didelis (maks. 15 MB).' }, { status: 400 });
  }

  const mimeType = resolveMimeType(file);
  if (mimeType !== 'application/pdf' && !mimeType.startsWith('image/')) {
    return NextResponse.json(
      { error: 'Palaikomi tik PDF ir paveikslėliai.' },
      { status: 400 }
    );
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    if (mimeType === 'application/pdf') {
      const parsed = await parsePikselIssuedInvoicePdf(buffer, file.name);
      if (parsed) {
        return NextResponse.json({ data: parsed, source: 'parser' });
      }
    }

    const apiKey = process.env.MISTRAL_API_KEY?.trim();
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Nepavyko nuskaityti PDF pagal Piksel šabloną, o MISTRAL_API_KEY nerastas.' },
        { status: 500 }
      );
    }

    const data = await processIssuedInvoiceOcr(apiKey, buffer, file.name, mimeType);
    return NextResponse.json({ data, source: 'ocr' });
  } catch (error) {
    console.error('Issued invoice OCR route error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Vidinė OCR klaida.' },
      { status: 500 }
    );
  }
}
