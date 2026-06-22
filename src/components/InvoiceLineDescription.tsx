const ORDER_LINE_RE = /^Reklamos transliacij\w* \((.+), U-([^)]+)\) (.+)$/i;

/** Sąrašui — be „Reklamos transliacijos“ prefikso. */
export function formatInvoiceListDescription(text: string | null | undefined): string {
  if (!text?.trim()) return '—';
  const orderMatch = text.match(ORDER_LINE_RE);
  if (orderMatch) {
    const [, client, invoiceId, period] = orderMatch;
    return `${client}, U-${invoiceId} ${period}`;
  }
  return text;
}

interface InvoiceLineDescriptionProps {
  text: string;
}

export function InvoiceLineDescription({ text }: InvoiceLineDescriptionProps) {
  const orderMatch = text.match(ORDER_LINE_RE);
  if (orderMatch) {
    const [, client, invoiceId, period] = orderMatch;
    return (
      <div className="font-normal">
        Reklamos transliacijos (
        <strong className="font-extrabold">{client}</strong>, U-{invoiceId}) {period}
      </div>
    );
  }

  return <div className="whitespace-pre-wrap font-normal">{text}</div>;
}
