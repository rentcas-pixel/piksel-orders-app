'use client';

import { useState } from 'react';
import {
  invoicePaymentStatusClass,
  invoicePaymentStatusLabel,
  invoicePartialPaymentTooltip,
} from '@/lib/invoice-payment-table';
import type { PaymentTrackingRow } from '@/lib/payment-tracking';

export function InvoicePaymentStatusBadge({ payment }: { payment: PaymentTrackingRow }) {
  const tip = invoicePartialPaymentTooltip(payment);
  const [hover, setHover] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0 });

  const updatePos = (clientX: number, clientY: number) => {
    setPos({ x: clientX, y: clientY });
  };

  return (
    <>
      <span
        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${invoicePaymentStatusClass(payment.status)} ${tip ? 'cursor-help' : ''}`}
        onMouseEnter={(event) => {
          if (!tip) return;
          setHover(true);
          updatePos(event.clientX, event.clientY);
        }}
        onMouseMove={(event) => {
          if (!tip) return;
          updatePos(event.clientX, event.clientY);
        }}
        onMouseLeave={() => setHover(false)}
      >
        {invoicePaymentStatusLabel(payment.status)}
      </span>
      {tip && hover ? (
        <div
          role="tooltip"
          className="pointer-events-none fixed z-[100] max-w-xs rounded-md bg-gray-900 px-2.5 py-1.5 text-xs font-normal text-white shadow-lg dark:bg-gray-700"
          style={{ left: pos.x + 12, top: pos.y + 12 }}
        >
          {tip}
        </div>
      ) : null}
    </>
  );
}
