'use client';

import { getSignatureHtml } from '@/lib/email/signature-client';

export function EmailSignaturePreview() {
  const html = getSignatureHtml();

  return (
    <div className="mt-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40 p-4">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
        Parašas (bus pridėtas siunčiant)
      </p>
      <div
        className="text-sm text-gray-800 dark:text-gray-100 [&_img]:block [&_img]:max-w-[120px] [&_img]:w-[120px] [&_img]:h-auto"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}
