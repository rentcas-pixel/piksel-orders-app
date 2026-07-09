'use client';

import { useRef } from 'react';
import { PaperClipIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { formatAttachmentSize } from '@/lib/email/attachment-client';
import { MAX_EMAIL_ATTACHMENT_COUNT } from '@/lib/email/outgoing-attachments';

interface EmailAttachmentPickerProps {
  files: File[];
  onChange: (files: File[]) => void;
  disabled?: boolean;
}

export function EmailAttachmentPicker({ files, onChange, disabled }: EmailAttachmentPickerProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(event.target.files ?? []);
    event.target.value = '';
    if (!selected.length) return;

    const merged = [...files, ...selected].slice(0, MAX_EMAIL_ATTACHMENT_COUNT);
    onChange(merged);
  };

  const removeFile = (index: number) => {
    onChange(files.filter((_, itemIndex) => itemIndex !== index));
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          onChange={handleFileChange}
          disabled={disabled || files.length >= MAX_EMAIL_ATTACHMENT_COUNT}
        />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={disabled || files.length >= MAX_EMAIL_ATTACHMENT_COUNT}
          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-1.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-900/50 disabled:opacity-50"
        >
          <PaperClipIcon className="w-4 h-4" />
          Prisegti failą
        </button>
        <span className="text-xs text-gray-400">
          Iki {MAX_EMAIL_ATTACHMENT_COUNT} failų, po 10 MB
        </span>
      </div>

      {files.length > 0 && (
        <ul className="space-y-1">
          {files.map((file, index) => (
            <li
              key={`${file.name}-${file.size}-${index}`}
              className="flex items-center justify-between gap-2 rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2 text-sm"
            >
              <div className="flex min-w-0 items-center gap-2">
                <PaperClipIcon className="w-4 h-4 shrink-0 text-gray-400" />
                <span className="truncate text-gray-700 dark:text-gray-200">{file.name}</span>
                <span className="shrink-0 text-xs text-gray-400">{formatAttachmentSize(file.size)}</span>
              </div>
              <button
                type="button"
                onClick={() => removeFile(index)}
                disabled={disabled}
                className="text-gray-400 hover:text-gray-600 disabled:opacity-50"
                aria-label="Pašalinti priedą"
              >
                <XMarkIcon className="w-4 h-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
