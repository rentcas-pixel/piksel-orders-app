import type { FilterOption } from '@/components/FilterDropdown';

export const monthFilterOptions: FilterOption[] = [
  { value: '01', label: 'Sausis' },
  { value: '02', label: 'Vasaris' },
  { value: '03', label: 'Kovas' },
  { value: '04', label: 'Balandis' },
  { value: '05', label: 'Gegužė' },
  { value: '06', label: 'Birželis' },
  { value: '07', label: 'Liepa' },
  { value: '08', label: 'Rugpjūtis' },
  { value: '09', label: 'Rugsėjis' },
  { value: '10', label: 'Spalis' },
  { value: '11', label: 'Lapkritis' },
  { value: '12', label: 'Gruodis' },
];

export const yearFilterOptions: FilterOption[] = Array.from({ length: 5 }, (_, i) => {
  const y = new Date().getFullYear() - 2 + i;
  return { value: String(y), label: String(y) };
});

export const statusFilterOptions: FilterOption[] = [
  { value: '', label: 'Visi statusai' },
  { value: 'taip', label: 'Patvirtinta' },
  { value: 'ne', label: 'Nepatvirtinta' },
];

export const mediaFilterOptions: FilterOption[] = [
  { value: '', label: 'Visi media' },
  { value: 'true', label: 'Media gautas' },
  { value: 'false', label: 'Media negautas' },
];

export const invoiceFilterOptions: FilterOption[] = [
  { value: '', label: 'Visos sąskaitos' },
  { value: 'true', label: 'Sąskaita išrašyta' },
  { value: 'false', label: 'Sąskaita neišrašyta' },
];

export const statusTabs: FilterOption[] = [
  { value: '', label: 'Visi' },
  { value: 'taip', label: 'Patvirtinta' },
  { value: 'ne', label: 'Nepatvirtinta' },
];

export const yearTabs: FilterOption[] = [
  { value: '2026', label: '2026' },
  { value: '2025', label: '2025' },
];

/** Mėnesio tab'ai su tikrais pavadinimais (praeitas / esamas / būsimas mėnuo) */
export function getMonthTabOptions(referenceDate = new Date()): FilterOption[] {
  const currentIdx = referenceDate.getMonth();
  const prevIdx = (currentIdx + 11) % 12;
  const nextIdx = (currentIdx + 1) % 12;
  return [
    { value: 'past', label: monthFilterOptions[prevIdx].label },
    { value: 'current', label: monthFilterOptions[currentIdx].label },
    { value: 'future', label: monthFilterOptions[nextIdx].label },
  ];
}

export function withAllOption(options: FilterOption[], allLabel: string): FilterOption[] {
  return [{ value: '', label: allLabel }, ...options];
}
