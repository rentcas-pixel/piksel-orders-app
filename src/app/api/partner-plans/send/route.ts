import { NextResponse } from 'next/server';
import { PocketBaseService } from '@/lib/pocketbase';
import { buildReklamosPlanasXlsxBuffer } from '@/lib/export-reklamos-planas';
import {
  toCampaignOrderInput,
  toCampaignScreen,
} from '@/lib/reklamos-planas-data';
import {
  resolvePartnerPlanEmails,
  shouldSkipPartnerPlanSend,
} from '@/lib/partner-contacts';
import { sendPartnerPlanEmail, formatPartnerPlanPeriod } from '@/lib/partner-plan-email';
import {
  createPartnerDeliveryToken,
  savePartnerDelivery,
} from '@/lib/partner-deliveries';
import { isResendConfigured } from '@/lib/resend-client';
import { buildPartnerConfirmUrl } from '@/lib/partner-confirm-url';

export const runtime = 'nodejs';
export const maxDuration = 120;

type SendBody = {
  orderId?: string;
  /** Jei nurodyta — tik šiam partneriui; kitaip visiems (be Piksel) */
  partnerId?: string;
};

export async function POST(request: Request) {
  try {
    if (!isResendConfigured()) {
      return NextResponse.json(
        {
          error:
            'RESEND_API_KEY nerastas .env.local — pridėk raktą ir perkrauk serverį.',
        },
        { status: 503 }
      );
    }

    const body = (await request.json()) as SendBody;
    const orderId = String(body.orderId || '').trim();
    if (!orderId) {
      return NextResponse.json({ error: 'Trūksta orderId' }, { status: 400 });
    }

    const fullOrder = await PocketBaseService.getOrder(orderId);
    const [screenRecords, bundles, partners] = await Promise.all([
      PocketBaseService.getCampaignScreens(!!fullOrder.viaduct),
      PocketBaseService.getBundles(),
      PocketBaseService.getPartners(),
    ]);

    const campaignOrder = toCampaignOrderInput(
      fullOrder as unknown as Record<string, unknown>
    );
    const screens = screenRecords.map((r) =>
      toCampaignScreen(r as Record<string, unknown>)
    );

    const screenIds = [...new Set(fullOrder.screens?.filter(Boolean) || [])];
    const screensMap = await PocketBaseService.getScreensWithPartner(screenIds);
    const partnerById = new Map(partners.map((p) => [p.id, p]));
    const screenCountByPartner = new Map<string, number>();

    for (const screenId of screenIds) {
      const partnerId = screensMap[screenId]?.partner;
      if (!partnerId) continue;
      screenCountByPartner.set(
        partnerId,
        (screenCountByPartner.get(partnerId) || 0) + 1
      );
    }

    let targets = [...screenCountByPartner.entries()]
      .map(([id, screenCount]) => {
        const partner = partnerById.get(id);
        if (!partner) return null;
        return {
          id: partner.id,
          name: partner.name,
          slug: partner.slug || partner.name,
          screenCount,
        };
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item));

    if (body.partnerId) {
      targets = targets.filter((item) => item.id === body.partnerId);
    }

    const campaignLabel =
      String(fullOrder.client || campaignOrder.client || 'Kampanija').trim() ||
      'Kampanija';
    const planNumber = String(
      fullOrder.invoice_id || campaignOrder.invoice_id || ''
    ).trim();
    const period = formatPartnerPlanPeriod(fullOrder.from, fullOrder.to);

    const results: Array<{
      partnerId: string;
      partnerName: string;
      status: 'sent' | 'skipped' | 'error';
      to?: string[];
      confirmUrl?: string;
      resendId?: string;
      error?: string;
    }> = [];

    for (const partner of targets) {
      if (shouldSkipPartnerPlanSend(partner.name) || shouldSkipPartnerPlanSend(partner.slug)) {
        results.push({
          partnerId: partner.id,
          partnerName: partner.name,
          status: 'skipped',
        });
        continue;
      }

      const resolved = resolvePartnerPlanEmails(partner.name);
      if (resolved.skipped || !resolved.emails.length) {
        results.push({
          partnerId: partner.id,
          partnerName: partner.name,
          status: 'skipped',
          error: resolved.reason || 'Nėra el. pašto',
        });
        continue;
      }

      try {
        const { buffer, filename } = await buildReklamosPlanasXlsxBuffer({
          order: campaignOrder,
          partnerId: partner.id,
          partnerName: partner.name,
          screens,
          bundles,
        });

        const token = createPartnerDeliveryToken();
        const xlsxBase64 = Buffer.from(buffer).toString('base64');
        const send = await sendPartnerPlanEmail({
          to: resolved.emails,
          campaign: campaignLabel,
          planNumber,
          partner: partner.name,
          period,
          confirmToken: token,
          filename,
          xlsxBase64,
        });

        if (!send.ok) {
          results.push({
            partnerId: partner.id,
            partnerName: partner.name,
            status: 'error',
            to: resolved.emails,
            error: send.error,
          });
          continue;
        }

        await savePartnerDelivery({
          orderId,
          partnerId: partner.id,
          partnerName: partner.name,
          campaignLabel: planNumber
            ? `Užsakymas: ${campaignLabel} | ${planNumber}`
            : `Užsakymas: ${campaignLabel}`,
          stage: 'plan',
          toEmail: resolved.emails.join(', '),
          resendId: send.id,
          token,
        });

        results.push({
          partnerId: partner.id,
          partnerName: partner.name,
          status: 'sent',
          to: resolved.emails,
          confirmUrl: buildPartnerConfirmUrl(token),
          resendId: send.id,
        });
      } catch (err) {
        results.push({
          partnerId: partner.id,
          partnerName: partner.name,
          status: 'error',
          to: resolved.emails,
          error: err instanceof Error ? err.message : 'Siuntimo klaida',
        });
      }
    }

    const sent = results.filter((r) => r.status === 'sent').length;
    const errors = results.filter((r) => r.status === 'error').length;

    return NextResponse.json({
      ok: errors === 0,
      sent,
      errors,
      results,
    });
  } catch (error) {
    console.error('partner-plans/send', error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Nepavyko išsiųsti planų',
      },
      { status: 500 }
    );
  }
}
