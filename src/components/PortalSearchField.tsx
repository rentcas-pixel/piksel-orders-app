'use client';

import { MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import {
  portalSearchFieldClass,
  portalSearchIconClass,
  portalSearchInputClass,
} from '@/lib/portal-ui';

interface PortalSearchFieldProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export function PortalSearchField({
  value,
  onChange,
  placeholder = 'Ieškoti…',
  className = '',
}: PortalSearchFieldProps) {
  return (
    <div className={`${portalSearchFieldClass} ${className}`.trim()}>
      <MagnifyingGlassIcon className={portalSearchIconClass} />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={portalSearchInputClass}
      />
    </div>
  );
}
