export const MAX_EMAIL_ATTACHMENT_COUNT = 5;
export const MAX_EMAIL_ATTACHMENT_BYTES = 10 * 1024 * 1024;
export const MAX_EMAIL_ATTACHMENTS_TOTAL_BYTES = 15 * 1024 * 1024;

export interface OutgoingAttachmentInput {
  filename: string;
  contentType: string;
  content: string;
}

export interface ParsedOutgoingAttachment {
  filename: string;
  contentType: string;
  content: Buffer;
}

export function parseOutgoingAttachments(raw: unknown): ParsedOutgoingAttachment[] {
  if (!Array.isArray(raw) || raw.length === 0) return [];

  const result: ParsedOutgoingAttachment[] = [];
  let totalSize = 0;

  for (const item of raw.slice(0, MAX_EMAIL_ATTACHMENT_COUNT)) {
    if (!item || typeof item !== 'object') continue;

    const record = item as Record<string, unknown>;
    const filename = String(record.filename ?? '').trim();
    const contentType = String(record.contentType ?? 'application/octet-stream').trim();
    const content = String(record.content ?? '').trim();

    if (!filename || !content) continue;

    const buffer = Buffer.from(content, 'base64');
    if (!buffer.length) continue;

    if (buffer.length > MAX_EMAIL_ATTACHMENT_BYTES) {
      throw new Error(`Failas „${filename}“ per didelis (maks. 10 MB).`);
    }

    totalSize += buffer.length;
    if (totalSize > MAX_EMAIL_ATTACHMENTS_TOTAL_BYTES) {
      throw new Error('Priedų bendras dydis per didelis (maks. 15 MB).');
    }

    result.push({ filename, contentType, content: buffer });
  }

  return result;
}

export function mergeMailAttachments(
  signatureAttachments: Array<{ filename: string; path: string; cid: string }>,
  userAttachments: ParsedOutgoingAttachment[] = []
) {
  return [
    ...signatureAttachments.map((item) => ({
      filename: item.filename,
      path: item.path,
      cid: item.cid,
    })),
    ...userAttachments.map((item) => ({
      filename: item.filename,
      content: item.content,
      contentType: item.contentType,
    })),
  ];
}
