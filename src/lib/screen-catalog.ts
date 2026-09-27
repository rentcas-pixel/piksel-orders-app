export type PikselCatalogScreen = {
  id: string;
  name: string;
  city?: string;
  owner?: string;
  type?: string;
  dimensions?: string;
  resolution?: string;
  ots?: number;
  viaduct?: boolean;
  link?: string;
  price_by_avg_views_per_day?: Record<string, number>;
};

let cachedCatalog: PikselCatalogScreen[] | null = null;

export function parsePikselScreenCatalog(source: string): PikselCatalogScreen[] {
  const start = source.indexOf('{');
  const end = source.lastIndexOf('}');
  if (start < 0 || end <= start) {
    throw new Error('Ekranų kainynas neperskaitomas');
  }
  const parsed = JSON.parse(source.slice(start, end + 1)) as {
    screens?: PikselCatalogScreen[];
  };
  if (!Array.isArray(parsed.screens) || parsed.screens.length === 0) {
    throw new Error('Ekranų kainynas tuščias');
  }
  return parsed.screens;
}

export async function loadPikselScreenCatalog(): Promise<PikselCatalogScreen[]> {
  if (cachedCatalog) return cachedCatalog;
  if (typeof window === 'undefined') {
    const { readFile } = await import('fs/promises');
    const { join } = await import('path');
    const source = await readFile(
      join(process.cwd(), 'public/skaiciuokle/screen-catalog.js'),
      'utf8'
    );
    cachedCatalog = parsePikselScreenCatalog(source);
    return cachedCatalog;
  }
  const response = await fetch('/skaiciuokle/screen-catalog.js');
  if (!response.ok) {
    throw new Error('Nepavyko užkrauti ekranų kainyno');
  }
  cachedCatalog = parsePikselScreenCatalog(await response.text());
  return cachedCatalog;
}
