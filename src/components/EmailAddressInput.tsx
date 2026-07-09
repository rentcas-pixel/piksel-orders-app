'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import {
  formatRecipientEntry,
  parseRecipientEntry,
} from '@/lib/email/email-addresses';
import type { EmailContact } from '@/lib/email/email-contacts-service';

interface EmailAddressInputProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  label: string;
  mailboxAddress?: string;
}

function getActiveToken(value: string, cursor: number): {
  token: string;
  start: number;
  end: number;
} {
  const before = value.slice(0, cursor);
  const after = value.slice(cursor);
  const start = Math.max(before.lastIndexOf(',') + 1, before.lastIndexOf(';') + 1);
  const nextComma = after.search(/[;,]/);
  const end = nextComma === -1 ? value.length : cursor + nextComma;
  return {
    token: value.slice(start, end).trim(),
    start,
    end,
  };
}

function replaceToken(value: string, start: number, end: number, replacement: string): string {
  const prefix = value.slice(0, start);
  const suffix = value.slice(end);
  const needsComma = suffix.trim().length > 0 && !suffix.trimStart().startsWith(',');
  const spacer = suffix.length === 0 ? '' : needsComma ? ', ' : '';
  return `${prefix}${replacement}${spacer}${suffix.trimStart().replace(/^,\s*/, '')}`;
}

export function EmailAddressInput({
  value,
  onChange,
  disabled,
  placeholder,
  label,
  mailboxAddress,
}: EmailAddressInputProps) {
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [contacts, setContacts] = useState<EmailContact[]>([]);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [tokenRange, setTokenRange] = useState({ start: 0, end: 0 });
  const [query, setQuery] = useState('');

  const loadContacts = useCallback(async () => {
    if (contacts.length > 0 || loadingContacts) return;
    setLoadingContacts(true);
    try {
      const params = new URLSearchParams();
      if (mailboxAddress) params.set('exclude', mailboxAddress);
      params.set('limit', '200');
      const response = await fetch(`/api/email/contacts?${params.toString()}`);
      const payload = (await response.json()) as { data?: EmailContact[] };
      if (response.ok && payload.data) {
        setContacts(payload.data);
      }
    } catch {
      // Autocomplete neturi blokuoti rašymo.
    } finally {
      setLoadingContacts(false);
    }
  }, [contacts.length, loadingContacts, mailboxAddress]);

  const suggestions = (() => {
    const needle = query.toLowerCase();
    const selected = new Set(
      value
        .split(/[;,]/)
        .map((part) => parseRecipientEntry(part).email.toLowerCase())
        .filter(Boolean)
    );

    return contacts
      .filter((contact) => {
        if (selected.has(contact.email.toLowerCase())) return false;
        if (!needle) return true;
        const email = contact.email.toLowerCase();
        const name = contact.name?.toLowerCase() ?? '';
        return email.includes(needle) || name.includes(needle);
      })
      .slice(0, 8);
  })();

  const updateSuggestions = useCallback(() => {
    const input = inputRef.current;
    if (!input) return;
    const token = getActiveToken(value, input.selectionStart ?? value.length);
    setTokenRange({ start: token.start, end: token.end });
    setQuery(token.token);
    setActiveIndex(0);
    setOpen(true);
  }, [value]);

  useEffect(() => {
    if (document.activeElement === inputRef.current) {
      updateSuggestions();
    }
  }, [contacts, updateSuggestions]);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const applySuggestion = (contact: EmailContact) => {
    const formatted = formatRecipientEntry(contact.email, contact.name);
    const nextValue = replaceToken(value, tokenRange.start, tokenRange.end, formatted);
    onChange(nextValue);
    setOpen(false);
    requestAnimationFrame(() => {
      inputRef.current?.focus();
    });
  };

  const showDropdown = open && !disabled && suggestions.length > 0;

  return (
    <div ref={containerRef} className="relative">
      <label htmlFor={listId} className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-300">
        {label}
      </label>
      <input
        ref={inputRef}
        id={listId}
        type="text"
        value={value}
        disabled={disabled}
        placeholder={placeholder}
        autoComplete="off"
        onFocus={() => {
          void loadContacts();
          updateSuggestions();
        }}
        onChange={(event) => {
          onChange(event.target.value);
          requestAnimationFrame(updateSuggestions);
        }}
        onClick={updateSuggestions}
        onKeyUp={updateSuggestions}
        onKeyDown={(event) => {
          if (!showDropdown) return;
          if (event.key === 'ArrowDown') {
            event.preventDefault();
            setActiveIndex((prev) => Math.min(prev + 1, suggestions.length - 1));
          } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            setActiveIndex((prev) => Math.max(prev - 1, 0));
          } else if (event.key === 'Enter' && suggestions[activeIndex]) {
            event.preventDefault();
            applySuggestion(suggestions[activeIndex]);
          } else if (event.key === 'Escape') {
            setOpen(false);
          }
        }}
        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900"
      />

      {showDropdown && (
        <ul
          className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-700 dark:bg-gray-900"
          role="listbox"
        >
          {suggestions.map((contact, index) => (
            <li key={contact.email} role="option" aria-selected={index === activeIndex}>
              <button
                type="button"
                className={`flex w-full flex-col items-start px-3 py-2 text-left text-sm ${
                  index === activeIndex
                    ? 'bg-violet-50 text-violet-900 dark:bg-violet-950/40 dark:text-violet-100'
                    : 'text-gray-800 hover:bg-gray-50 dark:text-gray-100 dark:hover:bg-gray-800'
                }`}
                onMouseDown={(event) => {
                  event.preventDefault();
                  applySuggestion(contact);
                }}
              >
                <span className="font-medium">{contact.name || contact.email}</span>
                {contact.name && (
                  <span className="text-xs text-gray-500 dark:text-gray-400">{contact.email}</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
