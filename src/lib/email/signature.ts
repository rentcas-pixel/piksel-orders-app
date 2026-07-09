import fs from 'fs';
import path from 'path';

const LOGO_CID = 'piksel-logo';
const LOGO_FILENAME = 'Piksel-Logotipas-juodas-RGB.jpg';
const LOGO_WIDTH_PX = 120;

const DEFAULT_SIGNATURE_LINES = {
  tagline: '-Ryškiai geriau-',
  name: 'Renatas Parojus',
  phone: '370 690 666 33',
  website: 'www.piksel.lt',
  websiteUrl: 'https://www.piksel.lt',
};

export interface SignatureContent {
  tagline: string;
  name: string;
  phone: string;
  website: string;
  websiteUrl: string;
}

function getSignatureContent(): SignatureContent {
  const raw = process.env.EMAIL_SIGNATURE?.trim();
  if (!raw) return DEFAULT_SIGNATURE_LINES;

  try {
    const parsed = JSON.parse(raw) as Partial<SignatureContent>;
    return { ...DEFAULT_SIGNATURE_LINES, ...parsed };
  } catch {
    return DEFAULT_SIGNATURE_LINES;
  }
}

export function getSignatureLogoPath(): string {
  const custom = process.env.EMAIL_SIGNATURE_LOGO_PATH?.trim();
  if (custom && fs.existsSync(custom)) return custom;
  return path.join(process.cwd(), 'public', LOGO_FILENAME);
}

export function getSignatureAttachments(): Array<{
  filename: string;
  path: string;
  cid: string;
}> {
  const logoPath = getSignatureLogoPath();
  if (!fs.existsSync(logoPath)) return [];

  return [
    {
      filename: path.basename(logoPath),
      path: logoPath,
      cid: LOGO_CID,
    },
  ];
}

export function getEmailSignatureText(): string {
  const s = getSignatureContent();
  return `${s.tagline}

${s.name}

T. ${s.phone}

W. ${s.website}`;
}

export function replyIncludesSignature(text: string): boolean {
  const normalized = text.toLowerCase();
  return (
    normalized.includes('ryškiai geriau') ||
    normalized.includes('renatas parojus') ||
    normalized.includes('renatas pocius') ||
    normalized.includes('www.piksel.lt')
  );
}

export function stripEmailSignature(body: string): string {
  let trimmed = body.trim();
  const markers = [
    'ryškiai geriau',
    'renatas parojus',
    'renatas pocius',
    'www.piksel.lt',
  ];
  const lower = trimmed.toLowerCase();

  for (const marker of markers) {
    const index = lower.indexOf(marker);
    if (index > 0) {
      trimmed = trimmed.slice(0, index).trimEnd();
      break;
    }
  }

  return trimmed.replace(/\n{3,}/g, '\n\n').trim();
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function textBlockToHtml(text: string): string {
  if (!text.trim()) return '';

  return escapeHtml(text)
    .replace(/\r\n/g, '\n')
    .split('\n')
    .join('<br>\n');
}

/** Spark el. pašto parašo HTML (1:1 struktūra). */
export function buildSparkSignatureHtml(logoBlock: string): string {
  const s = getSignatureContent();

  return `<div style="margin-left:0px;">&nbsp;</div>
<div style="margin-left:0px;">
  <font style="color:#000000;font-family:Arial, sans-serif;">${escapeHtml(s.tagline)}</font><br><br>
  <font style="color:#000000;">${escapeHtml(s.name)}</font>
</div>
<div style="margin-left:0px;">
  <font style="color:#000000;">T. ${escapeHtml(s.phone)}</font>
</div>
<div style="margin-left:0px;">
  <font style="color:#000000;">W. </font><a href="${escapeHtml(s.websiteUrl)}"><font style="color:#000000;">${escapeHtml(s.website)}</font></a>
</div>
<div style="margin-left:0px;">&nbsp;</div>
<div style="margin-left:0px;">${logoBlock}</div>`;
}

function buildLogoImgTag(src: string): string {
  return `<img src="${src}" alt="Piksel" width="${LOGO_WIDTH_PX}" style="width:${LOGO_WIDTH_PX}px;max-width:${LOGO_WIDTH_PX}px;height:auto;margin:0.7em 0;display:block;border:0;"><br>&nbsp;`;
}

export function getSignatureHtml(): string {
  const attachments = getSignatureAttachments();
  const logoBlock = attachments.length
    ? buildLogoImgTag(`cid:${LOGO_CID}`)
    : `<font style="color:#000000;font-size:24px;font-weight:700;">Piksel</font><br>&nbsp;`;

  return buildSparkSignatureHtml(logoBlock);
}

export interface OutgoingEmailContent {
  text: string;
  html: string;
  attachments: ReturnType<typeof getSignatureAttachments>;
}

export function buildOutgoingEmail(body: string): OutgoingEmailContent {
  const messageBody = stripEmailSignature(body);
  const text = messageBody
    ? `${messageBody}\n\n${getEmailSignatureText()}`
    : getEmailSignatureText();

  const bodyHtml = textBlockToHtml(messageBody);
  const separator = messageBody ? '<br><br>' : '';

  const html = `${bodyHtml}${separator}${getSignatureHtml()}`;

  return {
    text,
    html,
    attachments: getSignatureAttachments(),
  };
}

/** @deprecated use buildOutgoingEmail */
export function appendEmailSignature(body: string): string {
  return buildOutgoingEmail(body).text;
}
