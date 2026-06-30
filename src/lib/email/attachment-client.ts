import {
  MAX_EMAIL_ATTACHMENT_BYTES,
  MAX_EMAIL_ATTACHMENT_COUNT,
  MAX_EMAIL_ATTACHMENTS_TOTAL_BYTES,
  type OutgoingAttachmentInput,
} from '@/lib/email/outgoing-attachments';

export function formatAttachmentSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== 'string') {
        reject(new Error('Nepavyko nuskaityti failo.'));
        return;
      }
      const base64 = result.split(',')[1];
      if (!base64) {
        reject(new Error('Nepavyko nuskaityti failo.'));
        return;
      }
      resolve(base64);
    };
    reader.onerror = () => reject(new Error('Nepavyko nuskaityti failo.'));
    reader.readAsDataURL(file);
  });
}

export async function filesToOutgoingAttachments(files: File[]): Promise<OutgoingAttachmentInput[]> {
  if (files.length > MAX_EMAIL_ATTACHMENT_COUNT) {
    throw new Error(`Galima prisegti ne daugiau kaip ${MAX_EMAIL_ATTACHMENT_COUNT} failus.`);
  }

  const result: OutgoingAttachmentInput[] = [];
  let totalSize = 0;

  for (const file of files) {
    if (file.size > MAX_EMAIL_ATTACHMENT_BYTES) {
      throw new Error(`Failas „${file.name}“ per didelis (maks. 10 MB).`);
    }

    totalSize += file.size;
    if (totalSize > MAX_EMAIL_ATTACHMENTS_TOTAL_BYTES) {
      throw new Error('Priedų bendras dydis per didelis (maks. 15 MB).');
    }

    result.push({
      filename: file.name,
      contentType: file.type || 'application/octet-stream',
      content: await readFileAsBase64(file),
    });
  }

  return result;
}

export function getEmailAttachmentDownloadUrl(emailId: string, attachmentIndex: number): string {
  return `/api/email/emails/${emailId}/attachments/${attachmentIndex}`;
}

export async function downloadEmailAttachment(
  emailId: string,
  attachmentIndex: number,
  filename: string
): Promise<void> {
  const response = await fetch(getEmailAttachmentDownloadUrl(emailId, attachmentIndex));
  if (!response.ok) {
    let message = 'Nepavyko atsisiųsti priedo.';
    try {
      const payload = (await response.json()) as { error?: string };
      if (payload.error) message = payload.error;
    } catch {
      // ignore JSON parse errors
    }
    throw new Error(message);
  }

  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = filename || 'prisegtukas';
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(objectUrl);
}
