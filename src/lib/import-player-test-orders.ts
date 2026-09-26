import {
  listOrderClips,
  putOrderClipRecord,
  type ClipUploadKind,
  type OrderClipRecord,
} from '@/lib/order-clips';
import { formatResolution, resolutionKey } from '@/lib/media-resolution-check';
import {
  fetchAdminState,
  type PlayerCampaign,
  type PlayerCampaignMedia,
} from '@/lib/player-devices';
import {
  getTestOrder,
  mergeMissingTestOrders,
  type TestOrder,
} from '@/lib/test-orders';

function mediaFilename(media: PlayerCampaignMedia): string {
  const base = String(media.path || '').split('/').pop() || media.id;
  const prefix = `${media.id}-`;
  return base.startsWith(prefix) ? base.slice(prefix.length) : base;
}

function mediaMime(media: PlayerCampaignMedia, filename: string): string {
  if (/\.(jpe?g)$/i.test(filename)) return 'image/jpeg';
  if (/\.png$/i.test(filename)) return 'image/png';
  if (/\.webp$/i.test(filename)) return 'image/webp';
  if (/\.gif$/i.test(filename)) return 'image/gif';
  if (/\.webm$/i.test(filename)) return 'video/webm';
  if (/\.mov$/i.test(filename)) return 'video/quicktime';
  return media.kind === 'static' ? 'image/jpeg' : 'video/mp4';
}

function mediaUploadKind(media: PlayerCampaignMedia): ClipUploadKind {
  return media.kind === 'static' ? 'static' : 'video';
}

function screenTypeFromMedia(media: PlayerCampaignMedia[]): string {
  return media.some((item) => mediaUploadKind(item) === 'static') &&
    !media.some((item) => mediaUploadKind(item) === 'video')
    ? 'Statinis'
    : 'Video';
}

export function campaignToTestOrder(campaign: PlayerCampaign): TestOrder {
  const id = String(campaign.id || '').trim();
  const screenNames = (campaign.screens || []).map((name) => String(name).trim()).filter(Boolean);
  const media = campaign.media || [];
  const clipDuration = Number(campaign.clipDuration) || 10;
  const firstSized = media.find((item) => item.width && item.height);
  const resolution =
    firstSized?.width && firstSized.height
      ? formatResolution({ width: firstSized.width, height: firstSized.height })
      : undefined;
  const screenType = screenTypeFromMedia(media);
  const grid = campaign.grid?.length
    ? campaign.grid
    : Array.from({ length: 7 }, () => Array.from({ length: 17 }, () => true));

  return {
    id,
    client: String(campaign.client || 'Kampanija').trim() || 'Kampanija',
    agency: '',
    invoice_id: id.replace(/^test-/, ''),
    approved: true,
    viaduct: !!campaign.viaduct,
    from: String(campaign.from || '').slice(0, 10),
    to: String(campaign.to || '').slice(0, 10),
    media_received: true,
    invoice_issued: false,
    final_price: 0,
    invoice_sent: false,
    updated: campaign.publishedAt || new Date().toISOString(),
    intensity: 'Medi',
    screens: screenNames,
    grid,
    clip_duration: clipDuration,
    viaduct_frequency: Number(campaign.viaductFrequency) || 1,
    on_sale_screens: [],
    on_sale_discount: 0,
    hidden_screens: [],
    details: {
      isTest: true,
      discount: 80,
      total: 0,
      finalPrice: 0,
      clockOverlay: campaign.clockOverlay ? { enabled: true, zone: 'bottom' } : undefined,
      live: {
        status: 'live',
        publishedAt: campaign.publishedAt,
        clipCount: media.length,
        screenNames,
        playerApi: 'https://player.piksel.lt',
        playerItemCount: media.length,
      },
      plan: {
        grid,
        clip_duration: clipDuration,
        intensity: 'Medi',
        viaductFrequency: Number(campaign.viaductFrequency) || 1,
        screenNames,
        screenRows: screenNames.map((name) => ({
          name,
          type: screenType,
          ...(resolution ? { resolution } : {}),
        })),
        total: 0,
      },
    },
  };
}

function clipFromCampaignMedia(
  orderId: string,
  media: PlayerCampaignMedia
): OrderClipRecord {
  const filename = mediaFilename(media);
  const width = media.width || null;
  const height = media.height || null;
  const size = width && height ? { width, height } : null;
  return {
    id: media.id,
    orderId,
    filename,
    mimeType: mediaMime(media, filename),
    width,
    height,
    resolutionKey: size ? resolutionKey(size) : null,
    resolutionLabel: size ? formatResolution(size) : null,
    uploadKind: mediaUploadKind(media),
    createdAt: new Date().toISOString(),
    serverPath: media.path,
    serverMediaId: media.id,
    ...(media.from ? { displayFrom: media.from } : {}),
    ...(media.to ? { displayTo: media.to } : {}),
    ...(media.forScreens?.length ? { displayScreenNames: media.forScreens } : {}),
  };
}

export async function ensureClipsFromCampaign(campaign: PlayerCampaign): Promise<void> {
  const orderId = String(campaign.id || '').trim();
  const media = campaign.media || [];
  if (!orderId || media.length === 0) return;
  const existing = await listOrderClips(orderId);
  if (existing.length > 0) return;
  for (const item of media) {
    if (!item.id) continue;
    await putOrderClipRecord(clipFromCampaignMedia(orderId, item));
  }
}

/** play.piksel.lt Live kampanijos → šio kompo test orderių sąrašas (localStorage). */
export async function importPublishedCampaignsAsTestOrders(): Promise<number> {
  const result = await fetchAdminState();
  if (!result.ok) return 0;

  const published = result.campaigns.filter((campaign) => {
    const id = String(campaign.id || '');
    if (!id.startsWith('test-')) return false;
    if (campaign.published === false) return false;
    return true;
  });

  const added = mergeMissingTestOrders(published.map(campaignToTestOrder));

  await Promise.all(published.map((campaign) => ensureClipsFromCampaign(campaign)));

  return added;
}

export async function ensureTestOrderFromPlayer(orderId: string): Promise<TestOrder | null> {
  const local = getTestOrder(orderId);
  if (local) return local;
  if (!String(orderId).startsWith('test-')) return null;
  await importPublishedCampaignsAsTestOrders();
  return getTestOrder(orderId);
}
