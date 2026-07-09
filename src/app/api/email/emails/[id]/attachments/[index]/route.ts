import { NextResponse } from 'next/server';
import { EmailService } from '@/lib/email/email-service';
import { fetchEmailAttachmentFromServer } from '@/lib/email/imap-attachments';

export const runtime = 'nodejs';
export const maxDuration = 60;

interface RouteContext {
  params: Promise<{ id: string; index: string }>;
}

function encodeContentDispositionFilename(filename: string): string {
  const asciiFallback = filename.replace(/[^\x20-\x7E]/g, '_') || 'prisegtukas';
  const encoded = encodeURIComponent(filename);
  return `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encoded}`;
}

export async function GET(_request: Request, context: RouteContext) {
  const { id, index } = await context.params;
  const attachmentIndex = Number(index);

  try {
    const email = await EmailService.getById(id);
    if (!email) {
      return NextResponse.json({ error: 'Laiškas nerastas.' }, { status: 404 });
    }
    if (attachmentIndex < 0 || attachmentIndex >= email.attachments.length) {
      return NextResponse.json({ error: 'Priedas nerastas.' }, { status: 404 });
    }

    const attachment = await fetchEmailAttachmentFromServer(
      email.imap_uid,
      email.folder,
      attachmentIndex
    );

    return new NextResponse(new Uint8Array(attachment.content), {
      headers: {
        'Content-Type': attachment.contentType,
        'Content-Disposition': encodeContentDispositionFilename(attachment.filename),
        'Content-Length': String(attachment.content.length),
        'Cache-Control': 'private, max-age=3600',
      },
    });
  } catch (error) {
    console.error('Email attachment download error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Nepavyko atsisiųsti priedo.',
      },
      { status: 500 }
    );
  }
}
