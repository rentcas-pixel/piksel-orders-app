const LT_ORDER_LINE_RE = /^Reklamos transliacij\w* \((.+), U-([^)]+)\) (.+)$/i;
const EN_ORDER_LINE_RE = /^Advertising broadcasts \((.+), U-([^)]+)\) (.+)$/i;

/** Sąrašui — be eilutės prefikso. */
export function formatInvoiceListDescription(text: string | null | undefined): string {
  if (!text?.trim()) return '—';
  const orderMatch = text.match(LT_ORDER_LINE_RE) ?? text.match(EN_ORDER_LINE_RE);
  if (orderMatch) {
    const [, client, invoiceId, period] = orderMatch;
    return `${client}, U-${invoiceId} ${period}`;
  }
  return text;
}

interface InvoiceLineDescriptionProps {
  text: string;
  locale?: 'lt' | 'en';
}

export function InvoiceLineDescription({ text, locale = 'lt' }: InvoiceLineDescriptionProps) {
  const orderMatch = text.match(LT_ORDER_LINE_RE) ?? text.match(EN_ORDER_LINE_RE);
  if (orderMatch) {
    const [, client, invoiceId, period] = orderMatch;
    const prefix = locale === 'en' ? 'Advertising broadcasts' : 'Reklamos transliacijos';
    return (
      <div className="w-full text-left font-normal">
        {prefix} (
        <strong className="font-extrabold">{client}</strong>, U-{invoiceId}) {period}
      </div>
    );
  }

  return <div className="whitespace-pre-wrap font-normal">{text}</div>;
}
