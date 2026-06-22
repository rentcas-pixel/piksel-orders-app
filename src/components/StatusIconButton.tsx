'use client';

import type { ComponentType, MouseEvent, SVGProps } from 'react';

type IconComponent = ComponentType<SVGProps<SVGSVGElement>>;

interface StatusIconButtonProps {
  active: boolean;
  label: string;
  icon: IconComponent;
  onClick: (e: MouseEvent<HTMLButtonElement>) => void;
  disabled?: boolean;
  activeTone?: 'default' | 'green';
}

const activeToneClass = {
  default: 'text-gray-900 dark:text-white',
  green: 'text-emerald-600 dark:text-emerald-500',
} as const;

export function StatusIconButton({
  active,
  label,
  icon: Icon,
  onClick,
  disabled = false,
  activeTone = 'default',
}: StatusIconButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      aria-pressed={active}
      className={`inline-flex rounded-md p-1 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-gray-300 ${
        disabled ? 'cursor-default' : 'hover:bg-gray-100 dark:hover:bg-gray-700'
      } ${
        active
          ? activeToneClass[activeTone]
          : 'text-gray-300 dark:text-gray-600 hover:text-gray-400 dark:hover:text-gray-500'
      }`}
    >
      <Icon className="h-5 w-5" strokeWidth={active ? 2 : 1.5} />
    </button>
  );
}
