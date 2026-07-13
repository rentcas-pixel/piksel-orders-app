import {
  parseMistralDocumentAnnotation,
  RECEIVED_INVOICE_OCR_PROMPT,
  RECEIVED_INVOICE_OCR_SCHEMA,
  type MistralReceivedInvoiceExtraction,
} from '@/lib/mistral-received-invoice-ocr';
import {
  ISSUED_INVOICE_OCR_PROMPT,
  ISSUED_INVOICE_OCR_SCHEMA,
  parseMistralIssuedInvoiceAnnotation,
  type MistralIssuedInvoiceExtraction,
} from '@/lib/mistral-issued-invoice-ocr';
import { sanitizeMistralUploadFilename } from '@/lib/storage-path';

const MISTRAL_API_BASE = 'https://api.mistral.ai/v1';

function formatMistralError(payload: unknown, status: number): string {
  if (!payload || typeof payload !== 'object') {
    return `Mistral OCR klaida (${status})`;
  }
  const record = payload as { message?: string; detail?: unknown };
  if (typeof record.message === 'string' && record.message) return record.message;
  if (typeof record.detail === 'string' && record.detail) return record.detail;
  if (Array.isArray(record.detail)) {
    const parts = record.detail
      .map((item) => {
        if (typeof item === 'string') return item;
        if (item && typeof item === 'object' && 'msg' in item) {
          return String((item as { msg?: string }).msg ?? '');
        }
        return '';
      })
      .filter(Boolean);
    if (parts.length > 0) return parts.join('; ');
  }
  return `Mistral OCR klaida (${status})`;
}

async function uploadMistralFile(
  apiKey: string,
  buffer: Buffer,
  filename: string
): Promise<string> {
  const safeFilename = sanitizeMistralUploadFilename(filename);
  const formData = new FormData();
  formData.append('purpose', 'ocr');
  formData.append('file', new Blob([new Uint8Array(buffer)]), safeFilename);

  const response = await fetch(`${MISTRAL_API_BASE}/files`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: formData,
  });

  const payload = (await response.json()) as { id?: string };
  if (!response.ok || !payload.id) {
    throw new Error(formatMistralError(payload, response.status));
  }
  return payload.id;
}

async function getMistralSignedUrl(apiKey: string, fileId: string): Promise<string> {
  const response = await fetch(`${MISTRAL_API_BASE}/files/${fileId}/url?expiry=24`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });

  const payload = (await response.json()) as { url?: string };
  if (!response.ok || !payload.url) {
    throw new Error(formatMistralError(payload, response.status));
  }
  return payload.url;
}

async function deleteMistralFile(apiKey: string, fileId: string): Promise<void> {
  try {
    await fetch(`${MISTRAL_API_BASE}/files/${fileId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${apiKey}` },
    });
  } catch {
    // Best-effort cleanup
  }
}

async function runMistralOcrWithSchema<T>(
  apiKey: string,
  document: Record<string, string>,
  options: {
    schemaName: string;
    schema: object;
    prompt: string;
    parse: (raw: unknown) => T | null;
    emptyError: string;
  }
): Promise<T> {
  const response = await fetch(`${MISTRAL_API_BASE}/ocr`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'mistral-ocr-latest',
      document,
      document_annotation_format: {
        type: 'json_schema',
        json_schema: {
          name: options.schemaName,
          strict: true,
          schema: options.schema,
        },
      },
      document_annotation_prompt: options.prompt,
    }),
  });

  const payload = (await response.json()) as {
    document_annotation?: unknown;
  };

  if (!response.ok) {
    console.error('Mistral OCR error:', payload);
    throw new Error(formatMistralError(payload, response.status));
  }

  const extracted = options.parse(payload.document_annotation);
  if (!extracted) {
    throw new Error(options.emptyError);
  }

  return extracted;
}

async function runMistralOcr(
  apiKey: string,
  document: Record<string, string>
): Promise<MistralReceivedInvoiceExtraction> {
  return runMistralOcrWithSchema(apiKey, document, {
    schemaName: 'received_invoice',
    schema: RECEIVED_INVOICE_OCR_SCHEMA,
    prompt: RECEIVED_INVOICE_OCR_PROMPT,
    parse: parseMistralDocumentAnnotation,
    emptyError: 'Nepavyko ištraukti sąskaitos duomenų iš dokumento.',
  });
}

async function runIssuedMistralOcr(
  apiKey: string,
  document: Record<string, string>
): Promise<MistralIssuedInvoiceExtraction> {
  return runMistralOcrWithSchema(apiKey, document, {
    schemaName: 'issued_invoice',
    schema: ISSUED_INVOICE_OCR_SCHEMA,
    prompt: ISSUED_INVOICE_OCR_PROMPT,
    parse: parseMistralIssuedInvoiceAnnotation,
    emptyError: 'Nepavyko ištraukti išrašytos sąskaitos duomenų iš dokumento.',
  });
}

async function processMistralOcr<T>(
  apiKey: string,
  buffer: Buffer,
  filename: string,
  mimeType: string,
  runOcr: (apiKey: string, document: Record<string, string>) => Promise<T>
): Promise<T> {
  if (mimeType.startsWith('image/')) {
    const base64 = buffer.toString('base64');
    return runOcr(apiKey, {
      type: 'image_url',
      image_url: `data:${mimeType};base64,${base64}`,
    });
  }

  if (mimeType === 'application/pdf') {
    const fileId = await uploadMistralFile(apiKey, buffer, filename);
    try {
      const signedUrl = await getMistralSignedUrl(apiKey, fileId);
      return await runOcr(apiKey, {
        type: 'document_url',
        document_url: signedUrl,
      });
    } finally {
      await deleteMistralFile(apiKey, fileId);
    }
  }

  throw new Error('Palaikomi tik PDF ir paveikslėliai.');
}

export async function processReceivedInvoiceOcr(
  apiKey: string,
  buffer: Buffer,
  filename: string,
  mimeType: string
): Promise<MistralReceivedInvoiceExtraction> {
  return processMistralOcr(apiKey, buffer, filename, mimeType, runMistralOcr);
}

export async function processIssuedInvoiceOcr(
  apiKey: string,
  buffer: Buffer,
  filename: string,
  mimeType: string
): Promise<MistralIssuedInvoiceExtraction> {
  return processMistralOcr(apiKey, buffer, filename, mimeType, runIssuedMistralOcr);
}
