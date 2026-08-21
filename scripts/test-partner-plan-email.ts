/**
 * Lokalus E2E: siunčia Owexx planą → renatas@piksel.lt per Hub API.
 *
 *   npm run test:partner-email -- --orderId=<pb_order_id>
 *
 * Arba be orderId — naudoja PARTNER_TEST_ORDER_ID iš .env.local
 */
import fs from 'fs';
import path from 'path';

function loadEnvLocal() {
  const envPath = path.join(process.cwd(), '.env.local');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env) || !process.env[key]) {
      process.env[key] = value;
    }
  }
}

function argValue(name: string): string | undefined {
  const prefix = `--${name}=`;
  const hit = process.argv.find((item) => item.startsWith(prefix));
  return hit ? hit.slice(prefix.length).trim() : undefined;
}

async function main() {
  loadEnvLocal();

  const orderId =
    argValue('orderId') ||
    process.env.PARTNER_TEST_ORDER_ID?.trim() ||
    '';
  if (!orderId) {
    console.error(
      'Nurodyk orderId: npm run test:partner-email -- --orderId=XXX\narba PARTNER_TEST_ORDER_ID=.env.local'
    );
    process.exit(1);
  }

  const base =
    process.env.PARTNER_TEST_HUB_URL?.trim() || 'http://127.0.0.1:3000';

  console.log('POST', `${base}/api/partner-plans/send`);
  console.log('orderId', orderId);

  const res = await fetch(`${base}/api/partner-plans/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ orderId }),
  });
  const data = await res.json().catch(() => ({}));
  console.log('HTTP', res.status);
  console.log(JSON.stringify(data, null, 2));

  if (!res.ok) process.exit(1);

  const confirmUrl = data.results?.find(
    (r: { confirmUrl?: string }) => r.confirmUrl
  )?.confirmUrl;
  if (confirmUrl) {
    console.log('\nConfirm nuoroda (atidaryk naršyklėje):');
    console.log(confirmUrl);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
