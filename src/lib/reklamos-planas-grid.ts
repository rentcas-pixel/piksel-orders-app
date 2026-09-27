import { CampaignOrderInput } from '@/lib/campaign-calculator';

export const CAMPAIGN_GRID_ROW_COUNT = 17;
export const CAMPAIGN_GRID_COL_COUNT = 7;
export const CAMPAIGN_GRID_SIZE =
  CAMPAIGN_GRID_COL_COUNT * CAMPAIGN_GRID_ROW_COUNT;
export const CAMPAIGN_GRID_DAY_LABELS = ['P', 'A', 'T', 'K', 'P', 'Š', 'S'] as const;

/** Skaičiuoklės / test orderio grid → flat number[119] (col-major, 1/0). */
export function flattenCampaignGrid(
  grid: boolean[][] | number[] | unknown
): number[] {
  const flat = new Array(CAMPAIGN_GRID_SIZE).fill(0);
  if (!grid || !Array.isArray(grid)) return flat;

  if (typeof grid[0] === 'number' || typeof grid[0] === 'boolean') {
    const source = grid as Array<number | boolean>;
    for (let i = 0; i < Math.min(CAMPAIGN_GRID_SIZE, source.length); i += 1) {
      flat[i] = source[i] ? 1 : 0;
    }
    return flat;
  }

  if (!Array.isArray(grid[0])) return flat;
  const days = grid as boolean[][];
  for (let day = 0; day < CAMPAIGN_GRID_COL_COUNT; day += 1) {
    const dayRow = days[day] || [];
    for (let hour = 0; hour < CAMPAIGN_GRID_ROW_COUNT; hour += 1) {
      flat[day * CAMPAIGN_GRID_ROW_COUNT + hour] = dayRow[hour] ? 1 : 0;
    }
  }
  return flat;
}

export function getCampaignGridHourLabel(row: number): string {
  const start = 6 + row;
  return `${start}-${start + 1}`;
}

export function getCampaignGridCellValue(
  grid: number[],
  col: number,
  row: number,
  viewsPerHour: number
): string {
  const index = col * CAMPAIGN_GRID_ROW_COUNT + row;
  return grid[index] === 1 ? String(viewsPerHour) : '';
}

function layoutCell(content: string): string {
  return `<div class="cell-inner">${content}</div>`;
}

export function buildLayoutGridHtml(
  order: CampaignOrderInput,
  viewsPerHour: number
): string {
  const headerCells = CAMPAIGN_GRID_DAY_LABELS.map(
    (day) => `<th class="layout-day">${layoutCell(day)}</th>`
  ).join('');

  const bodyRows = Array.from({ length: CAMPAIGN_GRID_ROW_COUNT }, (_, row) => {
    const hour = getCampaignGridHourLabel(row);
    const dayCells = Array.from({ length: CAMPAIGN_GRID_COL_COUNT }, (_, col) => {
      const value = getCampaignGridCellValue(order.grid, col, row, viewsPerHour);
      const active = value !== '';
      return `<td class="${active ? 'layout-on' : 'layout-off'}">${layoutCell(value)}</td>`;
    }).join('');
    return `<tr><th class="layout-hour">${layoutCell(hour)}</th>${dayCells}</tr>`;
  }).join('');

  return `<div class="layout-block">
    <div class="layout-title">Išdėstymas</div>
    <table class="layout-grid">
      <thead><tr><th>${layoutCell('')}</th>${headerCells}</tr></thead>
      <tbody>${bodyRows}</tbody>
    </table>
    <div class="layout-note">${viewsPerHour} – parodymų valandoje</div>
  </div>`;
}
