import { NextResponse } from 'next/server';
import {
  confirmPartnerDeliveryByToken,
  getPartnerDeliveryByToken,
} from '@/lib/partner-deliveries';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Pixelmator mock: Piksel + ✓ + Užsakymas: … | … */
function renderThanksHtml(orderTitle: string): string {
  const title = escapeHtml(orderTitle || 'Užsakymas');
  return `<!DOCTYPE html>
<html lang="lt">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="robots" content="noindex,nofollow" />
  <title>Ačiū</title>
</head>
<body style="margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#0f172a;">
  <main style="text-align:center;padding:40px 24px;max-width:640px;">
    <img src="/Piksel-logo-black-2023.png" alt="Piksel" width="168" style="display:block;margin:0 auto 22px;max-width:min(200px,70vw);height:auto;" />
    <div style="display:inline-flex;align-items:center;justify-content:center;gap:10px;max-width:100%;">
      <span aria-hidden="true" style="flex-shrink:0;width:22px;height:22px;border-radius:999px;background:#22c55e;display:inline-flex;align-items:center;justify-content:center;">
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M2.2 6.2L4.7 8.7L9.8 3.4" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </span>
      <span style="font-size:clamp(15px,2.6vw,18px);font-weight:500;color:#334155;letter-spacing:-0.01em;text-align:left;line-height:1.35;">${title}</span>
    </div>
  </main>
</body>
</html>`;
}

function renderErrorHtml(heading: string, sub: string): string {
  return `<!DOCTYPE html>
<html lang="lt">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="robots" content="noindex,nofollow" />
  <title>${escapeHtml(heading)}</title>
</head>
<body style="margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#0f172a;">
  <main style="text-align:center;padding:40px 24px;max-width:420px;">
    <img src="/Piksel-logo-black-2023.png" alt="Piksel" width="140" style="display:block;margin:0 auto 16px;max-width:min(180px,70vw);height:auto;opacity:0.9;" />
    <h1 style="margin:0 0 8px;font-size:20px;font-weight:700;">${escapeHtml(heading)}</h1>
    <p style="margin:0;font-size:14px;line-height:1.5;color:#64748b;">${escapeHtml(sub)}</p>
  </main>
</body>
</html>`;
}

function htmlResponse(html: string, status = 200) {
  return new NextResponse(html, {
    status,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Robots-Tag': 'noindex, nofollow',
    },
  });
}

function buildOrderTitle(
  campaignLabel: string | null | undefined,
  fallback = 'Užsakymas'
): string {
  const raw = String(campaignLabel || '').trim();
  if (!raw) return fallback;
  if (/^užsakymas:/i.test(raw)) return raw;
  return `Užsakymas: ${raw}`;
}

type RouteContext = { params: Promise<{ token: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const { token: rawToken } = await context.params;
  const token = String(rawToken || '').trim();

  if (!/^[a-zA-Z0-9_-]{8,64}$/.test(token) && token !== 'demo') {
    return htmlResponse(
      renderErrorHtml(
        'Nuoroda negalioja',
        'Šis patvirtinimo adresas neteisingas arba pasibaigęs.'
      ),
      404
    );
  }

  if (token === 'demo') {
    return htmlResponse(
      renderThanksHtml('Užsakymas: Šaulių sąjunga | 5345')
    );
  }

  const existing = await getPartnerDeliveryByToken(token);
  if (!existing) {
    return htmlResponse(
      renderErrorHtml(
        'Nuoroda negalioja',
        'Šis patvirtinimo adresas neteisingas arba pasibaigęs.'
      ),
      404
    );
  }

  await confirmPartnerDeliveryByToken(token);
  return htmlResponse(renderThanksHtml(buildOrderTitle(existing.campaign_label)));
}
