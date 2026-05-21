export type OrderDesignVariant =
  | 'classic'
  | 'sidebar'
  | 'dashboard'
  | 'minimal'
  | 'dense'
  | 'ocean'
  | 'cards'
  | 'rail'
  | 'terminal'
  | 'warm';

export type TableTheme =
  | 'default'
  | 'modern'
  | 'dashboard'
  | 'minimal'
  | 'dense'
  | 'ocean'
  | 'cards'
  | 'rail'
  | 'terminal'
  | 'warm';

export type FilterTheme = TableTheme;

export type QuickCardTheme = 'default' | 'dashboard' | 'chips' | 'hidden' | 'warm' | 'strip';

export const ORDER_DESIGN_VARIANTS: {
  id: OrderDesignVariant;
  label: string;
  tagline: string;
  swatch: string;
}[] = [
  {
    id: 'classic',
    label: '1 · Klasikinis',
    tagline: 'Dabartinis Piksel header + mėlyni akcentai',
    swatch: 'bg-gradient-to-br from-blue-100 to-slate-100',
  },
  {
    id: 'sidebar',
    label: '2 · Workspace',
    tagline: 'Šoninė navigacija, SaaS stilius',
    swatch: 'bg-gradient-to-br from-slate-100 to-gray-200',
  },
  {
    id: 'dashboard',
    label: '3 · Dashboard',
    tagline: 'KPI kortelės, spalvingi akcentai',
    swatch: 'bg-gradient-to-br from-indigo-100 via-white to-emerald-50',
  },
  {
    id: 'minimal',
    label: '4 · Minimal',
    tagline: 'Švarus, be šoninės juostos',
    swatch: 'bg-white ring-1 ring-gray-200',
  },
  {
    id: 'dense',
    label: '5 · Dense',
    tagline: 'Maksimalus tankis 13" ekranui',
    swatch: 'bg-gradient-to-br from-gray-800 to-gray-900',
  },
  {
    id: 'ocean',
    label: '6 · Ocean',
    tagline: 'Mėlynas gradient header, šviesus fonas',
    swatch: 'bg-gradient-to-br from-sky-400 to-blue-700',
  },
  {
    id: 'cards',
    label: '7 · Cards',
    tagline: 'Kiekviena sekcija atskiroje kortelėje',
    swatch: 'bg-gray-100 shadow-inner ring-1 ring-gray-200',
  },
  {
    id: 'rail',
    label: '8 · Rail',
    tagline: 'Siaura ikonų juosta kairėje',
    swatch: 'bg-gradient-to-b from-violet-600 to-indigo-800',
  },
  {
    id: 'terminal',
    label: '9 · Terminal',
    tagline: 'Tamsus, monospace, dev stilius',
    swatch: 'bg-black ring-1 ring-emerald-500/50',
  },
  {
    id: 'warm',
    label: '10 · Warm',
    tagline: 'Kreminis fonas, amber akcentai',
    swatch: 'bg-gradient-to-br from-amber-50 to-orange-100',
  },
];

export const TABLE_THEME: Record<OrderDesignVariant, TableTheme> = {
  classic: 'default',
  sidebar: 'modern',
  dashboard: 'dashboard',
  minimal: 'minimal',
  dense: 'dense',
  ocean: 'ocean',
  cards: 'cards',
  rail: 'rail',
  terminal: 'terminal',
  warm: 'warm',
};

export const FILTER_THEME: Record<OrderDesignVariant, FilterTheme> = { ...TABLE_THEME };

export const QUICK_CARD_THEME: Record<OrderDesignVariant, QuickCardTheme> = {
  classic: 'hidden',
  sidebar: 'default',
  dashboard: 'dashboard',
  minimal: 'chips',
  dense: 'chips',
  ocean: 'strip',
  cards: 'default',
  rail: 'chips',
  terminal: 'hidden',
  warm: 'warm',
};

export function isOrderDesignVariant(value: string): value is OrderDesignVariant {
  return ORDER_DESIGN_VARIANTS.some((v) => v.id === value);
}
