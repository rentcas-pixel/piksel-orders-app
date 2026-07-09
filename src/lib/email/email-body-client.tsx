'use client';

import DOMPurify from 'dompurify';
import type { ProcessedEmail } from '@/lib/email/types';

function looksLikeHtml(value: string | null | undefined): boolean {
  if (!value) return false;
  return /<\/?[a-z][\s\S]*>/i.test(value);
}

function pickEmailHtml(email: ProcessedEmail): string | null {
  const html = email.body_html?.trim();
  if (html) return html;

  const text = email.body_text?.trim();
  if (text && looksLikeHtml(text)) return text;

  return null;
}

export function getRenderableEmailBody(email: ProcessedEmail): {
  mode: 'html' | 'text';
  content: string;
} {
  const html = pickEmailHtml(email);
  if (html) {
    return { mode: 'html', content: sanitizeEmailHtml(html) };
  }

  return {
    mode: 'text',
    content: email.body_text?.trim() || '(tuščias tekstas)',
  };
}

export function sanitizeEmailHtml(html: string): string {
  const sanitized = DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      'a',
      'b',
      'i',
      'em',
      'strong',
      'u',
      'p',
      'br',
      'ul',
      'ol',
      'li',
      'h1',
      'h2',
      'h3',
      'h4',
      'h5',
      'h6',
      'div',
      'span',
      'table',
      'thead',
      'tbody',
      'tr',
      'td',
      'th',
      'img',
      'blockquote',
      'pre',
      'hr',
      'font',
    ],
    ALLOWED_ATTR: [
      'href',
      'title',
      'target',
      'rel',
      'src',
      'alt',
      'width',
      'height',
      'style',
      'class',
      'colspan',
      'rowspan',
      'align',
      'color',
      'face',
      'size',
    ],
    ADD_ATTR: ['target', 'rel'],
  });

  return sanitized.replace(
    /<a\b([^>]*?)>/gi,
    (match, attrs: string) => {
      if (/target=/i.test(attrs)) return `<a${attrs}>`;
      return `<a${attrs} target="_blank" rel="noopener noreferrer">`;
    }
  );
}

const emailBodyClassName =
  'mt-2 text-sm text-gray-700 dark:text-gray-200 bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4 border border-gray-200 dark:border-gray-700 max-w-none break-words [&_a]:text-blue-600 [&_a]:underline dark:[&_a]:text-blue-400 [&_img]:max-w-full [&_h2]:text-base [&_h2]:font-semibold [&_h3]:text-sm [&_h3]:font-semibold [&_h4]:text-sm [&_h4]:font-medium [&_p]:my-2 [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5';

interface EmailBodyContentProps {
  email: ProcessedEmail;
}

export function EmailBodyContent({ email }: EmailBodyContentProps) {
  const body = getRenderableEmailBody(email);

  if (body.mode === 'html') {
    return (
      <div
        className={emailBodyClassName}
        dangerouslySetInnerHTML={{ __html: body.content }}
      />
    );
  }

  return (
    <pre className="mt-2 whitespace-pre-wrap text-sm text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-900/50 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
      {body.content}
    </pre>
  );
}
