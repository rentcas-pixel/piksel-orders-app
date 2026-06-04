import XLSX from 'xlsx';
import fs from 'fs';
import { createCampaignCalculator } from '../src/lib/campaign-calculator';
import { toCampaignOrderInput, toCampaignScreen } from '../src/lib/reklamos-planas-data';
import { buildReklamosPlanasXlsxBuffer } from '../src/lib/export-reklamos-planas';

async function main() {
  const base = 'https://get.piksel.lt/api';
  const orderRes = await fetch(
    `${base}/collections/orders/records?filter=invoice_id=5007&perPage=1`
  );
  const orderRaw = (await orderRes.json()).items[0];
  const viaduct = !!orderRaw.viaduct;
  const screensRes = await fetch(
    `${base}/collections/screens/records?perPage=500&filter=${encodeURIComponent(viaduct ? 'viaduct = true' : 'viaduct = false')}&sort=name`
  );
  const screenItems = (await screensRes.json()).items || [];
  const bundlesRes = await fetch(`${base}/collections/bundles/records?perPage=100`);
  const bundles = (await bundlesRes.json()).items || [];

  const order = toCampaignOrderInput(orderRaw);
  const screens = screenItems.map((r: Record<string, unknown>) =>
    toCampaignScreen(r)
  );

  const partnerId =
    screens.find((s: { partner?: string }) => s.partner)?.partner ?? '';

  const calc = createCampaignCalculator(order, screens, bundles, partnerId);
  console.log('orderedCatalogScreens', calc.orderedCatalogScreens.length);
  console.log(
    'active',
    calc.orderedCatalogScreens.filter((s) => !calc.isInactive(s)).length
  );

  const origFetch = globalThis.fetch.bind(globalThis);
  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.includes('Piksel-Logotipas-juodas-RGB.jpg')) {
      const logo = fs.readFileSync('public/Piksel-Logotipas-juodas-RGB.jpg');
      return new Response(logo, {
        status: 200,
        headers: { 'Content-Type': 'image/jpeg' },
      });
    }
    return origFetch(input, init);
  };

  const { buffer } = await buildReklamosPlanasXlsxBuffer({
    order,
    partnerId,
    screens,
    bundles,
  });
  globalThis.fetch = origFetch;

  const outPath = '/tmp/piksel-test-export.xlsx';
  fs.writeFileSync(outPath, Buffer.from(buffer));

  const ws = XLSX.readFile(outPath).Sheets['Piksel ekranų kainynas'];
  for (const k of [
    'M8',
    'M15',
    'M16',
    'B9',
    'U9',
    'B10',
    'U10',
    'K17',
    'C56',
    'AB112',
  ]) {
    const c = ws[k];
    console.log(k, c?.v ?? '', c?.f ?? '');
  }

  console.log('has logo media', fs.existsSync('/tmp/piksel-test-export.xlsx'));
}

main().catch(console.error);
