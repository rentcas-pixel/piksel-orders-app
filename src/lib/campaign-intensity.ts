import { CampaignOrderInput } from '@/lib/campaign-calculator';
import { CAMPAIGN_GRID_COL_COUNT, CAMPAIGN_GRID_ROW_COUNT } from '@/lib/reklamos-planas-grid';

/** Kaip skaičiuoklėje (Logo store) — standartiniai režimai */
export const CAMPAIGN_INTENSITY_LABELS = [
  'Max',
  'Medi',
  'Min',
  'Pikas',
] as const;

export const CAMPAIGN_INTENSITY_INDIVIDUAL = 'Individualus';

const MIN_GRID_BY_DAY: number[][] = [
  [0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1],
  [1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0],
  [0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1],
  [1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0],
  [0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1],
  [1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0],
  [0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1],
];

const PIKAS_GRID_BY_DAY: number[][] = [
  [0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 0, 0, 0, 0],
  [0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 0, 0, 0, 0],
  [0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 0, 0, 0, 0],
  [0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 0, 0, 0, 0],
  [0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
];

function buildColumnMajorGrid(dayRows: number[][]): number[] {
  const grid: number[] = [];
  for (let col = 0; col < CAMPAIGN_GRID_COL_COUNT; col++) {
    for (let row = 0; row < CAMPAIGN_GRID_ROW_COUNT; row++) {
      grid.push(dayRows[col][row]);
    }
  }
  return grid;
}

const PRESET_GRID_KEYS = [
  Array(CAMPAIGN_GRID_COL_COUNT * CAMPAIGN_GRID_ROW_COUNT).fill(1).join(''),
  Array.from(
    { length: CAMPAIGN_GRID_COL_COUNT * CAMPAIGN_GRID_ROW_COUNT },
    (_, index) => (index % 2 ? 0 : 1)
  ).join(''),
  buildColumnMajorGrid(MIN_GRID_BY_DAY).join(''),
  buildColumnMajorGrid(PIKAS_GRID_BY_DAY).join(''),
];

function getSelectedModeFromGrid(grid: number[]): number {
  const key = grid.slice(0, PRESET_GRID_KEYS[0].length).join('');
  return PRESET_GRID_KEYS.indexOf(key);
}

/**
 * Intensyvumas eksporte: Max / Medi / Min / Pikas / Individualus (pagal grid).
 * Viadukų dažnio (Kas 1/2/4 min.) kol kas nenaudojame — tik grid šablonai.
 */
export function resolveCampaignIntensityLabel(
  order: CampaignOrderInput
): string {
  const modeIndex = getSelectedModeFromGrid(order.grid);
  if (modeIndex >= 0 && modeIndex < CAMPAIGN_INTENSITY_LABELS.length) {
    return CAMPAIGN_INTENSITY_LABELS[modeIndex];
  }

  return CAMPAIGN_INTENSITY_INDIVIDUAL;
}
