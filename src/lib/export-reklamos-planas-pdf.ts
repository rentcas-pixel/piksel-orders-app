import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import {
  CampaignBundle,
  CampaignCalculator,
  CampaignOrderInput,
  CampaignScreen,
  createCampaignCalculator,
} from '@/lib/campaign-calculator';
import { resolveCampaignIntensityLabel } from '@/lib/campaign-intensity';
import { buildReklamosPlanasFilename } from '@/lib/reklamos-planas-data';
import { buildLayoutGridHtml } from '@/lib/reklamos-planas-grid';

export interface ExportReklamosPlanasPdfParams {
  order: CampaignOrderInput;
  partnerId: string;
  partnerName: string;
  screens: CampaignScreen[];
  bundles: CampaignBundle[];
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function fmtNum(value: number, maximumFractionDigits = 0): string {
  return value.toLocaleString('lt-LT', { maximumFractionDigits });
}

function pdfCell(content: string | number): string {
  return `<div class="cell-inner">${content}</div>`;
}

function buildScreenRows(
  order: CampaignOrderInput,
  visibleScreens: CampaignScreen[],
  calc: CampaignCalculator
): { left: string; right: string } {
  let left = '';
  let right = '';

  for (const screen of visibleScreens) {
    const viewCount = calc.views(screen);
    const otsCount = calc.ots(screen);
    const clip = calc.clipPrice(screen);
    const cptVal = calc.cpt(screen);
    const priceBefore = calc.totalPrice(screen);
    const priceAfter = calc.discountPrice(screen);
    let discountPct = calc.getScreenDiscount(screen);
    if (
      order.details_screen_prices?.[screen.id] != null &&
      priceBefore > 0
    ) {
      discountPct = Math.round((1 - priceAfter / priceBefore) * 100);
    }
    const nameInner = screen.link
      ? `<a class="screen-link" href="${escapeHtml(screen.link)}">${escapeHtml(screen.name)}</a>`
      : escapeHtml(screen.name);

    left += `<tr>
      <td class="txt">${pdfCell(escapeHtml(screen.city_display || screen.city || ''))}</td>
      <td class="screen-name">${pdfCell(nameInner)}</td>
      <td class="txt">${pdfCell(escapeHtml(screen.parameters || ''))}</td>
      <td class="txt">${pdfCell(escapeHtml(screen.resolution || ''))}</td>
      <td class="txt">${pdfCell(escapeHtml(screen.type || ''))}</td>
      <td class="gap"></td>
      <td class="num">${pdfCell(escapeHtml(calc.formatFrom))}</td>
      <td class="num">${pdfCell(escapeHtml(calc.formatTo))}</td>
      <td class="num">${pdfCell(calc.days)}</td>
      <td class="num">${pdfCell(fmtNum(Math.round(viewCount)))}</td>
      <td class="num">${pdfCell(fmtNum(Math.round(otsCount)))}</td>
    </tr>
    <tr class="row-spacer"><td colspan="11"></td></tr>`;

    right += `<tr>
      <td class="num">${pdfCell(clip.toFixed(3))}</td>
      <td class="num">${pdfCell(cptVal.toFixed(2))}</td>
      <td class="num">${pdfCell(fmtNum(priceBefore, 2))}</td>
      <td class="num">${pdfCell(`${discountPct}%`)}</td>
      <td class="num">${pdfCell(fmtNum(priceAfter, 2))}</td>
    </tr>
    <tr class="row-spacer"><td colspan="5"></td></tr>`;
  }

  return { left, right };
}

function buildPlanHtml(
  order: CampaignOrderInput,
  calc: CampaignCalculator,
  partnerName: string
): string {
  void partnerName;
  const totals = calc.totals();
  const orderedById = new Map(calc.orderedPartnerScreens.map((s) => [s.id, s]));
  const visibleScreens = order.screens
    .map((id) => orderedById.get(id))
    .filter(
      (s): s is CampaignScreen =>
        !!s && !order.hidden_screens?.includes(s.id)
    );

  const { left, right } = buildScreenRows(order, visibleScreens, calc);
  const layoutGrid = buildLayoutGridHtml(order, calc.getViewsPerHour());
  const period = calc.range ? `${calc.formatFrom} - ${calc.formatTo}` : '';
  const intensityLabel = resolveCampaignIntensityLabel(order);

  const volumeRow = calc.hasViaductScreens
    ? ''
    : `<tr class="totals-row">
        <td colspan="4" class="totals-label">${pdfCell('Apimties Nuolaida')}</td>
        <td class="num">${pdfCell(`${totals.amountDiscount}%`)}</td>
      </tr>`;

  return `<!DOCTYPE html><html><head><meta charset="utf-8"/>
<link href="https://fonts.googleapis.com/css2?family=Open+Sans:wght@400;600;700&display=swap" rel="stylesheet"/>
<style>
  * { box-sizing: border-box; }
  body { margin: 0; background: #fcfcfc; }
  .sheet {
    font-family: 'Open Sans', Arial, sans-serif;
    font-size: 12px;
    color: #000;
    background: #fcfcfc;
    padding: 10px 14px 18px;
    width: 1380px;
  }
  .info-table { border-collapse: collapse; margin-bottom: 6px; }
  .info-table td { border: none; padding: 2px 10px 2px 0; background: #fcfcfc; }
  .info-label { font-weight: 700; text-align: right; padding-right: 6px; white-space: nowrap; }
  .info-value { text-align: left; }
  .plan-body {
    display: flex;
    align-items: stretch;
    border: 1px solid #bfbfbf;
    background: #fcfcfc;
  }
  .plan-left, .plan-right { border-collapse: collapse; table-layout: fixed; background: #fcfcfc; }
  .plan-left { width: 640px; flex: 0 0 640px; border-right: none; }
  .plan-right { width: 300px; flex: 0 0 300px; border-left: none; }
  .plan-center {
    flex: 0 0 200px;
    width: 200px;
    border-left: 1px solid #bfbfbf;
    border-right: 1px solid #bfbfbf;
    background: #fcfcfc;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 6px 8px 8px;
  }
  .piksel-brand {
    font-size: 36px;
    font-weight: 700;
    line-height: 1;
    margin: 4px 0 10px;
    text-align: center;
  }
  .plan-left th, .plan-left td,
  .plan-right th, .plan-right td,
  .plan-footer td {
    border: 1px solid #bfbfbf;
    padding: 0;
    vertical-align: middle;
    background: #fcfcfc;
  }
  .plan-left thead th, .plan-right thead th { font-weight: 700; height: 32px; }
  .plan-left td.gap {
    width: 8px; min-width: 8px; max-width: 8px;
    border-left: none !important; border-right: none !important;
    background: #fcfcfc !important;
  }
  .cell-inner {
    display: flex; align-items: center; justify-content: center;
    min-height: 26px; padding: 3px 5px; width: 100%; line-height: 1.2;
  }
  .txt .cell-inner { justify-content: center; text-align: center; }
  .num .cell-inner { justify-content: flex-end; text-align: right; }
  .screen-link { color: #906eff; font-weight: 600; text-decoration: underline; }
  tr.row-spacer td { height: 14px; border-left: 1px solid #bfbfbf; border-right: 1px solid #bfbfbf; }
  tr.row-spacer td.gap { border: none !important; }
  .layout-block { width: 100%; }
  .layout-block .layout-title { display: none; }
  .layout-grid { width: 100%; border-collapse: collapse; font-size: 9px; }
  .layout-grid th, .layout-grid td { border: 1px solid #bfbfbf; padding: 0; background: #fcfcfc; }
  .layout-grid .cell-inner { min-height: 14px; font-size: 9px; padding: 1px 2px; }
  .layout-note { font-size: 9px; text-align: center; margin-top: 4px; color: #333; }
  .plan-footer {
    display: flex;
    border: 1px solid #bfbfbf;
    border-top: none;
  }
  .footer-left { width: 640px; flex: 0 0 640px; }
  .footer-center { width: 200px; flex: 0 0 200px; border-left: 1px solid #bfbfbf; border-right: 1px solid #bfbfbf; }
  .footer-right { width: 300px; flex: 0 0 300px; }
  .footer-table { width: 100%; border-collapse: collapse; }
  .totals-row td { background: #595959 !important; border-color: #595959 !important; }
  .totals-row .cell-inner { color: #fff; font-weight: 700; min-height: 28px; }
  .totals-label .cell-inner { justify-content: flex-start; text-align: left; }
  .totals-row.num .cell-inner { justify-content: flex-end; }
</style></head><body>
<div class="sheet">
  <table class="info-table">
    <tr><td class="info-label">Agentūra:</td><td class="info-value">${escapeHtml(order.agency)}</td></tr>
    <tr><td class="info-label">Klientas:</td><td class="info-value">${escapeHtml(order.client)}</td></tr>
    <tr><td class="info-label">Laikotarpis:</td><td class="info-value">${escapeHtml(period)}</td></tr>
    <tr><td class="info-label">Intensyvumas:</td><td class="info-value">${escapeHtml(intensityLabel)}</td></tr>
    <tr><td class="info-label">Plano Nr.:</td><td class="info-value">${escapeHtml(calc.invoicePrefix)}-${escapeHtml(String(order.invoice_id))}</td></tr>
    <tr><td class="info-label">Klipo trukmė(s):</td><td class="info-value">${order.clip_duration}</td></tr>
  </table>

  <div class="plan-body">
    <table class="plan-left">
      <thead><tr>
        <th>${pdfCell('Miestas')}</th>
        <th>${pdfCell('Ekranas')}</th>
        <th>${pdfCell('Matmenys (m)')}</th>
        <th>${pdfCell('Parametrai (px)')}</th>
        <th>${pdfCell('Tipas')}</th>
        <th class="gap"></th>
        <th>${pdfCell('Pradžia')}</th>
        <th>${pdfCell('Pabaiga')}</th>
        <th>${pdfCell('Dienų skaičius')}</th>
        <th>${pdfCell('Parodymų sk.')}</th>
        <th>${pdfCell('OTS')}</th>
      </tr></thead>
      <tbody>${left}</tbody>
    </table>

    <div class="plan-center">
      <div class="piksel-brand">Piksel</div>
      ${layoutGrid}
    </div>

    <table class="plan-right">
      <thead><tr>
        <th>${pdfCell('Klipo kaina')}</th>
        <th>${pdfCell('CPT')}</th>
        <th>${pdfCell('Kaina be PVM')}</th>
        <th>${pdfCell('Nuolaida')}</th>
        <th>${pdfCell('Kaina')}</th>
      </tr></thead>
      <tbody>${right}</tbody>
    </table>
  </div>

  <div class="plan-footer">
    <div class="footer-left"></div>
    <div class="footer-center"></div>
    <table class="footer-table footer-right">
      ${volumeRow}
      <tr class="totals-row">
        <td colspan="4" class="totals-label">${pdfCell('Laikotarpio Nuolaida')}</td>
        <td class="num">${pdfCell(`${totals.periodDiscount}%`)}</td>
      </tr>
      <tr class="totals-row">
        <td colspan="4" class="totals-label">${pdfCell('Galutinė Kaina')}</td>
        <td class="num">${pdfCell(fmtNum(totals.total, 2))}</td>
      </tr>
    </table>
  </div>
</div>
</body></html>`;
}

async function renderHtmlToPdf(element: HTMLElement, filename: string) {
  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    allowTaint: true,
    backgroundColor: '#fcfcfc',
    width: element.scrollWidth,
    height: element.scrollHeight,
    scrollX: 0,
    scrollY: 0,
  });

  const imgData = canvas.toDataURL('image/png');
  const pdf = new jsPDF('l', 'mm', 'a4');
  const pageWidth = 297;
  const pageHeight = 210;
  const imgHeight = (canvas.height * pageWidth) / canvas.width;
  let heightLeft = imgHeight;
  let position = 0;

  pdf.addImage(imgData, 'PNG', 0, position, pageWidth, imgHeight);
  heightLeft -= pageHeight;

  while (heightLeft > 0) {
    position = heightLeft - imgHeight;
    pdf.addPage();
    pdf.addImage(imgData, 'PNG', 0, position, pageWidth, imgHeight);
    heightLeft -= pageHeight;
  }

  pdf.save(filename);
}

export async function downloadReklamosPlanasPdf(params: ExportReklamosPlanasPdfParams) {
  const { order, partnerId, partnerName, screens, bundles } = params;
  const calc = createCampaignCalculator(order, screens, bundles, partnerId);

  if (calc.hasViaductScreens) {
    throw new Error('Viadukų užsakymų PDF eksportas dar neįdiegtas — naudokite skaičiuoklę.');
  }

  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.left = '-10000px';
  iframe.style.top = '0';
  iframe.style.width = '1420px';
  iframe.style.height = '1000px';
  iframe.style.border = 'none';
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument;
  if (!doc) {
    document.body.removeChild(iframe);
    throw new Error('Nepavyko paruošti PDF dokumento');
  }

  doc.open();
  doc.write(buildPlanHtml(order, calc, partnerName));
  doc.close();

  await new Promise<void>((resolve) => {
    iframe.onload = () => resolve();
    setTimeout(resolve, 600);
  });

  const sheet = doc.querySelector('.sheet') as HTMLElement | null;
  if (!sheet) {
    document.body.removeChild(iframe);
    throw new Error('Nepavyko sugeneruoti PDF turinio');
  }

  const filename = buildReklamosPlanasFilename(
    order,
    calc.invoicePrefix,
    'pdf',
    partnerName
  );

  try {
    await renderHtmlToPdf(sheet, filename);
  } finally {
    document.body.removeChild(iframe);
  }
}
