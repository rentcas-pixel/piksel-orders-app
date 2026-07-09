import { NextResponse } from 'next/server';
import { getEmailMailboxConfig } from '@/lib/email/config';
import { EmailService } from '@/lib/email/email-service';

export const runtime = 'nodejs';

export async function GET() {
  const config = getEmailMailboxConfig();
  const syncState = await EmailService.getSyncState().catch(() => ({
    last_synced_at: null,
    last_sync_count: 0,
    last_sync_error: null,
    updated_at: new Date().toISOString(),
  }));

  return NextResponse.json({
    config: {
      imapHost: config.imapHost,
      imapPort: config.imapPort,
      smtpHost: config.smtpHost,
      smtpPort: config.smtpPort,
      username: config.username,
      fromName: config.fromName,
      passwordConfigured: config.passwordConfigured,
    },
    syncState,
  });
}

export async function POST() {
  try {
    const { testImapConnection } = await import('@/lib/email/imap-client');
    const { testSmtpConnection } = await import('@/lib/email/smtp-client');
    await testImapConnection();
    await testSmtpConnection();
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Ryšio testas nepavyko.' },
      { status: 500 }
    );
  }
}
