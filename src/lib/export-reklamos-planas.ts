import JSZip from 'jszip';
import XLSX from 'xlsx-js-style';
import {
  CampaignBundle,
  CampaignCalculator,
  CampaignOrderInput,
  CampaignScreen,
  createCampaignCalculator,
} from '@/lib/campaign-calculator';
import {
  CAMPAIGN_GRID_COL_COUNT,
  CAMPAIGN_GRID_DAY_LABELS,
  CAMPAIGN_GRID_ROW_COUNT,
  getCampaignGridCellValue,
  getCampaignGridHourLabel,
} from '@/lib/reklamos-planas-grid';
import { resolveCampaignIntensityLabel } from '@/lib/campaign-intensity';
import { buildReklamosPlanasFilename } from '@/lib/reklamos-planas-data';
import {
  applyFreezePanesInXlsx,
  downloadXlsxBuffer,
  embedLogoInXlsx,
} from '@/lib/xlsx-embed-logo';

const PIKSEL_LOGO_PATH = '/Piksel-Logotipas-juodas-RGB.jpg';
const SHEET_NAME = 'Piksel ekranų kainynas';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Cell = any;

/** Stulpelių indeksai (0 = A) — atitinka reference xlsx */
const COL = {
  A: 0,
  B: 1,
  C: 2,
  D: 3,
  E: 4,
  F: 5,
  G: 6,
  H: 7,
  I: 8,
  J: 9,
  K: 10,
  L: 11,
  M: 12,
  N: 13,
  R: 17,
  S: 18,
  T: 19,
  U: 20,
  V: 21,
  W: 22,
  X: 23,
  Y: 24,
  Z: 25,
  AA: 26,
  AB: 27,
  AC: 28,
} as const;

const PADDING_FIRST_COL = COL.AC;
const PADDING_LAST_COL = 99; // CV — kaip reference xlsx

const WHITE_COLUMNS = new Set<number>([
  COL.A,
  COL.G,
  COL.K,
  COL.T,
  COL.W,
]);
for (let col = PADDING_FIRST_COL; col <= PADDING_LAST_COL; col++) {
  WHITE_COLUMNS.add(col);
}

const PIKSEL_ROW = 8;
const PIKSEL_ROW_HEIGHT = 42;
const TOP_WHITE_LAST_ROW = 8;
const FOOTER_WHITE_FIRST_ROW = 106;
const FOOTER_WHITE_LAST_ROW = 206;
const MID_WHITE_FIRST_ROW = 34;
const MID_WHITE_LAST_ROW = 113;

const TOTALS_MERGE_COLS = [
  COL.T,
  COL.U,
  COL.V,
  COL.X,
  COL.Y,
  COL.Z,
  COL.AA,
  COL.AB,
];
const HEADER_ROW = 9;
const DATA_START_ROW = 10;
const GRID_TITLE_ROW = 15;
const GRID_DAY_HEADER_ROW = 16;
const GRID_FIRST_HOUR_ROW = 17;
const GRID_NOTE_ROW = 35;

/** Sujungimai kaip reference — ne H, U, X, AA */
const MERGE_COLS = [
  COL.A,
  COL.B,
  COL.C,
  COL.D,
  COL.E,
  COL.F,
  COL.G,
  COL.H,
  COL.I,
  COL.J,
  COL.V,
  COL.W,
  COL.Y,
  COL.Z,
  COL.U,
  COL.X,
  COL.AA,
  COL.AB,
];

const COL_WIDTHS = [
  { wch: 6 },
  { wch: 21 },
  { wch: 26 },
  { wch: 19 },
  { wch: 19 },
  { wch: 16 },
  { wch: 3 },
  { wch: 16 },
  { wch: 16 },
  { wch: 19 },
  { wch: 11.27 },
  { wch: 0.45 },
  { wch: 3.17 },
  { wch: 3.17 },
  { wch: 3.17 },
  { wch: 3.17 },
  { wch: 3.17 },
  { wch: 3.17 },
  { wch: 3.17 },
  { wch: 12 },
  { wch: 17 },
  { wch: 15 },
  { wch: 3 },
  { wch: 15 },
  { wch: 11 },
  { wch: 18 },
  { wch: 15 },
  { wch: 17 },
];

const BORDER_COLOR = 'bfbfbf';
const HEADER_ROW_HEIGHT = 30;
/** Viena eilutė ekrano poroje / suvestinėje (2× merge); 15 pt ≈ Excel default, fit 12 pt tekstui */
const SCREEN_PAIR_ROW_HEIGHT = 15;
const GRID_BORDER_COLOR = '808080';
const SHEET_FILL = 'ffffff';
const TOTALS_DARK_FILL = '595959';
const TOTALS_DARK_FONT = 'ffffff';

function gridBorderStyle() {
  const edge = { style: 'thin', color: { rgb: GRID_BORDER_COLOR } };
  return { top: edge, bottom: edge, left: edge, right: edge };
}

function clone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const normalStyle: any = {
  font: { name: 'Open Sans', sz: 12, bold: false },
  fill: { fgColor: { rgb: SHEET_FILL } },
  alignment: { horizontal: 'center', vertical: 'center' },
  border: {
    top: { style: 'thin', color: { rgb: BORDER_COLOR } },
    bottom: { style: 'thin', color: { rgb: BORDER_COLOR } },
    right: { style: 'thin', color: { rgb: BORDER_COLOR } },
    left: { style: 'thin', color: { rgb: BORDER_COLOR } },
  },
};

const tableItemStyle = { ...normalStyle };
const tableHeaderStyle = {
  font: { name: 'Open Sans', sz: 12, bold: true },
  fill: { fgColor: { rgb: SHEET_FILL } },
  alignment: { horizontal: 'center', vertical: 'center' },
  border: {
    top: { style: 'thin', color: { rgb: BORDER_COLOR } },
    bottom: { style: 'thin', color: { rgb: BORDER_COLOR } },
    left: { style: 'thin', color: { rgb: BORDER_COLOR } },
    right: { style: 'thin', color: { rgb: BORDER_COLOR } },
  },
};

const nameActiveStyle = {
  ...tableItemStyle,
  font: { ...tableItemStyle.font, color: { rgb: '906eff' } },
};

const gridHourStyle = clone(tableItemStyle);
gridHourStyle.alignment = { horizontal: 'right', vertical: 'center' };

const gridCellStyle = clone(tableItemStyle);
gridCellStyle.font = { ...gridCellStyle.font, sz: 10 };
gridCellStyle.border = gridBorderStyle();

const gridHeaderStyle = clone(tableHeaderStyle);
gridHeaderStyle.border = gridBorderStyle();

const whiteColumnStyle = {
  font: { name: 'Open Sans', sz: 12, bold: false },
  fill: { fgColor: { rgb: SHEET_FILL } },
  alignment: { horizontal: 'center', vertical: 'center' },
  border: {},
};

function applyWhiteColumnStyle(cell: Cell, col: number): Cell {
  const style = clone(cell.s || whiteColumnStyle);
  style.fill = { fgColor: { rgb: SHEET_FILL } };
  style.border = {};
  if (col === COL.K) {
    style.alignment = { ...(style.alignment || {}), horizontal: 'right', vertical: 'center' };
  }
  return { ...cell, s: style };
}

function applyWhiteColumns(sheet: XLSX.WorkSheet, lastRow: number) {
  for (let row = 1; row <= lastRow; row++) {
    for (const col of WHITE_COLUMNS) {
      const addr = `${colLetter(col)}${row}`;
      const existing = sheet[addr];
      if (existing) {
        sheet[addr] = applyWhiteColumnStyle(existing, col);
      } else {
        writeCell(
          sheet,
          row,
          col,
          col === COL.K
            ? styledCell(' ', { ...whiteColumnStyle, alignment: { horizontal: 'right', vertical: 'center' } })
            : blankCell(whiteColumnStyle)
        );
      }
    }
  }
}

function applyWhiteRowStyle(cell: Cell): Cell {
  const style = clone(cell.s || whiteColumnStyle);
  style.fill = { fgColor: { rgb: SHEET_FILL } };
  style.border = {};
  return { ...cell, s: style };
}

function applyWhiteRows(
  sheet: XLSX.WorkSheet,
  startRow: number,
  endRow: number
) {
  for (let row = startRow; row <= endRow; row++) {
    for (let col = 0; col <= PADDING_LAST_COL; col++) {
      const addr = `${colLetter(col)}${row}`;
      const existing = sheet[addr];
      if (existing) {
        sheet[addr] = applyWhiteRowStyle(existing);
      } else {
        writeCell(sheet, row, col, blankCell(whiteColumnStyle));
      }
    }
  }
}

function applyWhiteRange(
  sheet: XLSX.WorkSheet,
  startRow: number,
  endRow: number,
  startCol: number,
  endCol: number
) {
  for (let row = startRow; row <= endRow; row++) {
    for (let col = startCol; col <= endCol; col++) {
      const addr = `${colLetter(col)}${row}`;
      const existing = sheet[addr];
      if (existing) {
        sheet[addr] = applyWhiteRowStyle(existing);
      } else {
        writeCell(sheet, row, col, blankCell(whiteColumnStyle));
      }
    }
  }
}

function tableBorderStyle() {
  const edge = { style: 'thin', color: { rgb: BORDER_COLOR } };
  return { top: edge, bottom: edge, left: edge, right: edge };
}

function ensureRangeBorders(
  sheet: XLSX.WorkSheet,
  startRow: number,
  endRow: number,
  startCol: number,
  endCol: number
) {
  const border = tableBorderStyle();
  const baseStyle = { ...tableItemStyle, border };

  for (let row = startRow; row <= endRow; row++) {
    for (let col = startCol; col <= endCol; col++) {
      const existing = sheet[`${colLetter(col)}${row}`];
      if (existing) {
        const style = clone(existing.s || baseStyle);
        style.border = border;
        if (!style.fill) {
          style.fill = { fgColor: { rgb: SHEET_FILL } };
        }
        sheet[`${colLetter(col)}${row}`] = { ...existing, s: style };
      } else {
        writeCell(sheet, row, col, blankCell(baseStyle));
      }
    }
  }
}

function applyRowBottomBorder(
  sheet: XLSX.WorkSheet,
  row: number,
  startCol: number,
  endCol: number
) {
  const bottom = { style: 'thin', color: { rgb: BORDER_COLOR } };

  for (let col = startCol; col <= endCol; col++) {
    const addr = `${colLetter(col)}${row}`;
    const existing = sheet[addr];
    const style = clone(existing?.s || whiteColumnStyle);
    style.border = { ...(style.border || {}), bottom };
    if (!style.fill) {
      style.fill = { fgColor: { rgb: SHEET_FILL } };
    }
    if (existing) {
      sheet[addr] = { ...existing, s: style };
    } else {
      writeCell(sheet, row, col, blankCell(style));
    }
  }
}

function totalsDarkStyle() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const style: any = clone(tableHeaderStyle);
  style.fill = { fgColor: { rgb: TOTALS_DARK_FILL } };
  style.font = {
    name: 'Open Sans',
    sz: 12,
    bold: true,
    color: { rgb: TOTALS_DARK_FONT },
  };
  return style;
}

function applyTotalsDarkStyle(
  sheet: XLSX.WorkSheet,
  totalsRow: number,
  totalsSpacerRow: number
) {
  const style = totalsDarkStyle();
  for (const row of [totalsRow, totalsSpacerRow]) {
    for (let col = COL.Z; col <= COL.AB; col++) {
      const existing = sheet[`${colLetter(col)}${row}`];
      if (existing) {
        sheet[`${colLetter(col)}${row}`] = { ...existing, s: clone(style) };
      } else {
        writeCell(sheet, row, col, blankCell(style));
      }
    }
  }
}

function applyScreenPairRowHeights(
  sheet: XLSX.WorkSheet,
  startRow: number,
  endRow: number
) {
  if (!sheet['!rows']) sheet['!rows'] = [];
  for (let row = startRow; row <= endRow; row++) {
    sheet['!rows'][row - 1] = {
      hpt: SCREEN_PAIR_ROW_HEIGHT,
      customHeight: true,
    } as XLSX.RowInfo;
  }
}

function styledCell(
  value: string | number,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  style: any,
  extra?: Partial<Cell>
): Cell {
  return { t: typeof value === 'number' ? 'n' : 's', v: value, s: clone(style), ...extra };
}

function blankCell(style = tableItemStyle): Cell {
  return styledCell(' ', style);
}

function colLetter(col: number): string {
  let n = col + 1;
  let s = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

function writeCell(
  sheet: XLSX.WorkSheet,
  excelRow: number,
  col: number,
  cell: Cell | null | undefined
) {
  if (!cell || Object.keys(cell).length === 0) return;
  sheet[`${colLetter(col)}${excelRow}`] = cell;
}

function writeInfoBlock(
  sheet: XLSX.WorkSheet,
  calc: CampaignCalculator,
  order: CampaignOrderInput
) {
  const boldRight = clone(normalStyle);
  boldRight.font.bold = true;
  boldRight.alignment = { horizontal: 'right', vertical: 'center' };
  const left = clone(normalStyle);
  left.alignment = { horizontal: 'left', vertical: 'center' };
  const period = calc.range ? `${calc.formatFrom} - ${calc.formatTo}` : '';

  const intensityLabel = resolveCampaignIntensityLabel(order);

  const rows: [string, string | number][] = [
    ['Agentūra: ', order.agency],
    ['Klientas: ', order.client],
    ['Laikotarpis: ', period],
    ['Intensyvumas: ', intensityLabel],
    ['Plano Nr.: ', `${calc.invoicePrefix}-${order.invoice_id}`],
    ['Klipo trukmė (s): ', order.clip_duration],
  ];

  rows.forEach(([label, value], index) => {
    const row = index + 2;
    writeCell(sheet, row, COL.B, styledCell(label, boldRight));
    writeCell(
      sheet,
      row,
      COL.C,
      styledCell(value, left, typeof value === 'number' ? { t: 'n' } : {})
    );
  });
}

function writeHeaderRow(sheet: XLSX.WorkSheet) {
  const r = HEADER_ROW;
  writeCell(sheet, r, COL.B, styledCell('Miestas', tableHeaderStyle));
  writeCell(sheet, r, COL.C, styledCell('Ekranas', tableHeaderStyle));
  writeCell(sheet, r, COL.D, styledCell('Matmenys (m)', tableHeaderStyle));
  writeCell(sheet, r, COL.E, styledCell('Parametrai (px)', tableHeaderStyle));
  writeCell(sheet, r, COL.F, styledCell('Tipas', tableHeaderStyle));
  writeCell(sheet, r, COL.H, styledCell('Pradžia', tableHeaderStyle));
  writeCell(sheet, r, COL.I, styledCell('Pabaiga', tableHeaderStyle));
  writeCell(sheet, r, COL.J, styledCell('Dienų skaičius', tableHeaderStyle));
  writeCell(sheet, r, COL.U, styledCell('Parodymų sk.', tableHeaderStyle));
  writeCell(sheet, r, COL.V, styledCell('OTS', tableHeaderStyle));
  writeCell(sheet, r, COL.X, styledCell('Klipo kaina', tableHeaderStyle));
  writeCell(sheet, r, COL.Y, styledCell('CPT', tableHeaderStyle));
  writeCell(sheet, r, COL.Z, styledCell('Kaina be PVM', tableHeaderStyle));
  writeCell(sheet, r, COL.AA, styledCell('Nuolaida', tableHeaderStyle));
  writeCell(sheet, r, COL.AB, styledCell('Kaina', tableHeaderStyle));
}

function writePikselLogoArea(sheet: XLSX.WorkSheet) {
  if (!sheet['!merges']) sheet['!merges'] = [];
  sheet['!merges'].push({
    s: { r: PIKSEL_ROW - 1, c: COL.N },
    e: { r: PIKSEL_ROW - 1, c: COL.R },
  });
  writeCell(sheet, PIKSEL_ROW, COL.N, blankCell(tableItemStyle));
  if (!sheet['!rows']) sheet['!rows'] = [];
  sheet['!rows'][PIKSEL_ROW - 1] = { hpt: PIKSEL_ROW_HEIGHT };
}

function writeScreenPair(
  sheet: XLSX.WorkSheet,
  calc: CampaignCalculator,
  screen: CampaignScreen,
  pairIndex: number
) {
  const dataRow = DATA_START_ROW + pairIndex * 2;
  const spacerRow = dataRow + 1;
  const inactive = calc.isInactive(screen);
  const gray = clone(tableItemStyle);
  const item = inactive ? gray : tableItemStyle;
  const nameStyle = inactive ? gray : nameActiveStyle;

  writeCell(sheet, dataRow, COL.A, styledCell('-', clone(whiteColumnStyle)));
  writeCell(
    sheet,
    dataRow,
    COL.B,
    styledCell(screen.city_display || screen.city || '', item)
  );
  writeCell(
    sheet,
    dataRow,
    COL.C,
    styledCell(
      screen.name,
      nameStyle,
      screen.link ? { l: { Target: screen.link } } : {}
    )
  );
  writeCell(sheet, dataRow, COL.D, styledCell(screen.parameters || '', item));
  writeCell(sheet, dataRow, COL.E, styledCell(screen.resolution || '', item));
  writeCell(sheet, dataRow, COL.F, styledCell(screen.type || '', item));

  if (!inactive) {
    writeCell(sheet, dataRow, COL.H, styledCell(calc.formatFrom, item));
    writeCell(sheet, dataRow, COL.I, styledCell(calc.formatTo, item));
    writeCell(
      sheet,
      dataRow,
      COL.J,
      styledCell(calc.days, item, { t: 'n', z: '##0' })
    );

    const zAddr = `${colLetter(COL.Z)}${dataRow}`;
    const aaAddr = `${colLetter(COL.AA)}${dataRow}`;

    writeCell(
      sheet,
      dataRow,
      COL.U,
      styledCell(Math.round(calc.views(screen)), item, {
        t: 'n',
        z: '### ##0',
      })
    );
    writeCell(
      sheet,
      dataRow,
      COL.V,
      styledCell(calc.ots(screen), item, { t: 'n', z: '### ##0' })
    );
    writeCell(
      sheet,
      dataRow,
      COL.X,
      styledCell(calc.clipPrice(screen), item, { t: 'n', z: '0.000' })
    );
    writeCell(
      sheet,
      dataRow,
      COL.Y,
      styledCell(calc.cpt(screen), item, { t: 'n', z: '0.00' })
    );
    writeCell(
      sheet,
      dataRow,
      COL.Z,
      styledCell(calc.totalPrice(screen), item, { t: 'n', z: '## ###.#0' })
    );
    writeCell(
      sheet,
      dataRow,
      COL.AA,
      styledCell(calc.getScreenDiscount(screen) / 100, item, {
        t: 'n',
        z: '#0%',
      })
    );
    writeCell(sheet, dataRow, COL.AB, {
      t: 'n',
      s: clone(item),
      z: '## ###.#0',
      f: `${zAddr}*(1-${aaAddr})`,
    });
  }

  for (const col of [
    COL.A,
    COL.B,
    COL.C,
    COL.D,
    COL.E,
    COL.F,
    COL.G,
    COL.H,
    COL.I,
    COL.J,
    COL.U,
    COL.V,
    COL.X,
    COL.Y,
    COL.Z,
    COL.AA,
    COL.AB,
  ]) {
    writeCell(sheet, spacerRow, col, blankCell());
  }
}

function writeLayoutGrid(
  sheet: XLSX.WorkSheet,
  order: CampaignOrderInput,
  viewsPerHour: number
) {
  const titleStyle = clone(tableHeaderStyle);
  titleStyle.alignment = { horizontal: 'center', vertical: 'center' };
  writeCell(
    sheet,
    GRID_TITLE_ROW,
    COL.M,
    styledCell('Išdėstymas', titleStyle)
  );
  if (!sheet['!merges']) sheet['!merges'] = [];
  sheet['!merges'].push({
    s: { r: GRID_TITLE_ROW - 1, c: COL.M },
    e: { r: GRID_TITLE_ROW - 1, c: COL.S },
  });

  CAMPAIGN_GRID_DAY_LABELS.forEach((day, index) => {
    writeCell(
      sheet,
      GRID_DAY_HEADER_ROW,
      COL.M + index,
      styledCell(day, gridHeaderStyle)
    );
  });

  for (let gridRow = 0; gridRow < CAMPAIGN_GRID_ROW_COUNT; gridRow++) {
    const excelRow = GRID_FIRST_HOUR_ROW + gridRow;
    writeCell(
      sheet,
      excelRow,
      COL.K,
      styledCell(getCampaignGridHourLabel(gridRow), gridHourStyle)
    );
    for (let col = 0; col < CAMPAIGN_GRID_COL_COUNT; col++) {
      const value = getCampaignGridCellValue(
        order.grid,
        col,
        gridRow,
        viewsPerHour
      );
      writeCell(
        sheet,
        excelRow,
        COL.M + col,
        value
          ? styledCell(value, gridCellStyle, { t: 'n' })
          : blankCell(gridCellStyle)
      );
    }
  }

  const noteStyle = clone(tableItemStyle);
  noteStyle.alignment = { horizontal: 'center', vertical: 'center' };
  writeCell(
    sheet,
    GRID_NOTE_ROW,
    COL.M,
    styledCell(`${viewsPerHour} - parodymų valandoje`, noteStyle)
  );
  sheet['!merges'].push({
    s: { r: GRID_NOTE_ROW - 1, c: COL.M },
    e: { r: GRID_NOTE_ROW - 1, c: COL.S },
  });
}

function addScreenMerges(sheet: XLSX.WorkSheet, screenCount: number) {
  if (!sheet['!merges']) sheet['!merges'] = [];
  for (let i = 0; i < screenCount; i++) {
    const start = DATA_START_ROW - 1 + i * 2;
    const end = start + 1;
    for (const c of MERGE_COLS) {
      sheet['!merges'].push({ s: { r: start, c }, e: { r: end, c } });
    }
  }
}

function writeFooterLabelRow(
  sheet: XLSX.WorkSheet,
  row: number,
  label: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  footerStyle: any
): number {
  const spacerRow = row + 1;
  const labelStyle = clone(footerStyle);
  labelStyle.alignment = { horizontal: 'right', vertical: 'center' };
  writeCell(sheet, row, COL.Z, styledCell(label, labelStyle));
  writeCell(sheet, row, COL.AA, blankCell(labelStyle));
  writeCell(sheet, spacerRow, COL.Z, blankCell(labelStyle));
  writeCell(sheet, spacerRow, COL.AA, blankCell(labelStyle));
  if (!sheet['!merges']) sheet['!merges'] = [];
  sheet['!merges'].push({
    s: { r: row - 1, c: COL.Z },
    e: { r: spacerRow - 1, c: COL.AA },
  });
  return spacerRow;
}

function writeTotals(
  sheet: XLSX.WorkSheet,
  calc: CampaignCalculator,
  screenPairCount: number
) {
  const totals = calc.totals();
  const firstData = DATA_START_ROW;
  const lastData = firstData + screenPairCount * 2 - 1;
  const totalsRow = lastData + 1;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const footerStyle: any = clone(tableHeaderStyle);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const footerDiscountStyle: any = clone(tableHeaderStyle);
  footerDiscountStyle.font = { name: 'Open Sans', sz: 12, bold: false };

  const sum = (col: number) =>
    `SUM(${colLetter(col)}${firstData}:${colLetter(col)}${lastData})`;
  const avg = (col: number) =>
    `AVERAGE(${colLetter(col)}${firstData}:${colLetter(col)}${lastData})`;

  writeCell(sheet, totalsRow, COL.T, styledCell('Viso:', footerStyle));
  writeCell(sheet, totalsRow, COL.U, {
    t: 'n',
    s: clone(footerStyle),
    f: sum(COL.U),
    z: '### ##0',
  });
  writeCell(sheet, totalsRow, COL.V, {
    t: 'n',
    s: clone(footerStyle),
    f: sum(COL.V),
    z: '### ##0',
  });
  writeCell(sheet, totalsRow, COL.X, {
    t: 'n',
    s: clone(footerStyle),
    f: avg(COL.X),
    z: '#0.000',
  });
  writeCell(sheet, totalsRow, COL.Y, {
    t: 'n',
    s: clone(footerStyle),
    f: avg(COL.Y),
    z: '0.00',
  });
  writeCell(sheet, totalsRow, COL.Z, {
    t: 'n',
    s: clone(footerStyle),
    f: sum(COL.Z),
    z: '## ###.#0',
  });
  writeCell(sheet, totalsRow, COL.AA, {
    t: 'n',
    s: clone(footerStyle),
    f: avg(COL.AA),
    z: '#0%',
  });
  writeCell(sheet, totalsRow, COL.AB, {
    t: 'n',
    s: clone(footerStyle),
    f: sum(COL.AB),
    z: '## ###.#0',
  });

  const totalsSpacerRow = totalsRow + 1;
  for (const col of TOTALS_MERGE_COLS) {
    writeCell(sheet, totalsSpacerRow, col, blankCell(footerStyle));
  }
  if (!sheet['!merges']) sheet['!merges'] = [];
  for (const col of TOTALS_MERGE_COLS) {
    sheet['!merges'].push({
      s: { r: totalsRow - 1, c: col },
      e: { r: totalsSpacerRow - 1, c: col },
    });
  }

  if (calc.hasViaductScreens) return;

  const amountRow = lastData + 3;
  writeFooterLabelRow(sheet, amountRow, 'Apimties Nuolaida', footerDiscountStyle);
  writeCell(
    sheet,
    amountRow,
    COL.AB,
    styledCell(totals.amountDiscount / 100, footerDiscountStyle, { t: 'n', z: '#0%' })
  );
  writeCell(sheet, amountRow + 1, COL.AB, blankCell(footerDiscountStyle));
  sheet['!merges'].push({
    s: { r: amountRow - 1, c: COL.AB },
    e: { r: amountRow, c: COL.AB },
  });

  const periodRow = lastData + 5;
  writeFooterLabelRow(sheet, periodRow, 'Laikotarpio Nuolaida', footerDiscountStyle);
  writeCell(
    sheet,
    periodRow,
    COL.AB,
    styledCell(totals.periodDiscount / 100, footerDiscountStyle, { t: 'n', z: '#0%' })
  );
  writeCell(sheet, periodRow + 1, COL.AB, blankCell(footerDiscountStyle));
  sheet['!merges'].push({
    s: { r: periodRow - 1, c: COL.AB },
    e: { r: periodRow, c: COL.AB },
  });

  const finalRow = lastData + 7;
  const abSum = `${colLetter(COL.AB)}${totalsRow}`;
  const abAmount = `${colLetter(COL.AB)}${amountRow}`;
  const abPeriod = `${colLetter(COL.AB)}${periodRow}`;
  writeFooterLabelRow(sheet, finalRow, 'Galutinė Kaina', footerDiscountStyle);
  writeCell(sheet, finalRow, COL.AB, {
    t: 'n',
    s: clone(footerDiscountStyle),
    z: '## ###.#0',
    f: `${abSum}*(1-${abAmount}-${abPeriod})`,
  });
  writeCell(sheet, finalRow + 1, COL.AB, blankCell(footerDiscountStyle));
  sheet['!merges'].push({
    s: { r: finalRow - 1, c: COL.AB },
    e: { r: finalRow, c: COL.AB },
  });
}

function buildWorksheet(
  calc: CampaignCalculator,
  order: CampaignOrderInput
): XLSX.WorkSheet {
  const sheet: XLSX.WorkSheet = {};

  writeInfoBlock(sheet, calc, order);
  writeHeaderRow(sheet);
  writePikselLogoArea(sheet);

  const exportScreens = calc.orderedCatalogScreens.filter(
    (s) => !order.hidden_screens?.includes(s.id)
  );

  exportScreens.forEach((screen, index) => {
    writeScreenPair(sheet, calc, screen, index);
  });

  addScreenMerges(sheet, exportScreens.length);
  writeLayoutGrid(sheet, order, calc.getViewsPerHour());

  const lastDataRow = DATA_START_ROW + exportScreens.length * 2 - 1;
  ensureRangeBorders(sheet, HEADER_ROW, lastDataRow, COL.B, COL.F);
  ensureRangeBorders(sheet, HEADER_ROW, lastDataRow, COL.H, COL.J);
  ensureRangeBorders(sheet, HEADER_ROW, lastDataRow, COL.U, COL.V);
  ensureRangeBorders(sheet, HEADER_ROW, lastDataRow, COL.X, COL.AB);

  writeTotals(sheet, calc, exportScreens.length);

  const contentLastRow = DATA_START_ROW + exportScreens.length * 2 + 8;
  const lastRow = Math.max(contentLastRow, FOOTER_WHITE_LAST_ROW);
  applyWhiteColumns(sheet, lastRow);
  applyWhiteRows(sheet, 1, TOP_WHITE_LAST_ROW);
  applyWhiteRange(sheet, HEADER_ROW, GRID_TITLE_ROW, COL.K, COL.T);
  applyWhiteRange(sheet, MID_WHITE_FIRST_ROW, MID_WHITE_LAST_ROW, COL.K, COL.T);
  applyWhiteRows(sheet, FOOTER_WHITE_FIRST_ROW, FOOTER_WHITE_LAST_ROW);

  ensureRangeBorders(sheet, GRID_TITLE_ROW, GRID_TITLE_ROW, COL.M, COL.S);

  const totalsRow = lastDataRow + 1;
  const totalsSpacerRow = totalsRow + 1;
  const footerLastRow = lastDataRow + 8;
  applyTotalsDarkStyle(sheet, totalsRow, totalsSpacerRow);
  applyRowBottomBorder(sheet, totalsSpacerRow, COL.T, COL.AB);
  for (const spacerRow of [
    lastDataRow + 4,
    lastDataRow + 6,
    lastDataRow + 8,
  ]) {
    applyRowBottomBorder(sheet, spacerRow, COL.Z, COL.AB);
  }

  if (!sheet['!rows']) sheet['!rows'] = [];
  const pikselRowHeight = sheet['!rows'][PIKSEL_ROW - 1];
  applyScreenPairRowHeights(sheet, DATA_START_ROW, footerLastRow);
  if (pikselRowHeight) {
    sheet['!rows'][PIKSEL_ROW - 1] = pikselRowHeight;
  }
  sheet['!rows'][HEADER_ROW - 1] = {
    hpt: HEADER_ROW_HEIGHT,
    customHeight: true,
  } as XLSX.RowInfo;

  sheet['!ref'] = `A1:${colLetter(PADDING_LAST_COL)}${lastRow}`;
  sheet['!cols'] = [
    ...COL_WIDTHS,
    ...Array.from({ length: PADDING_LAST_COL - PADDING_FIRST_COL + 1 }, () => ({
      wch: 8.43,
    })),
  ];
  return sheet;
}

export const COMBINED_EXPORT_PARTNER_LABEL = 'Bendras';

export interface ExportReklamosPlanasParams {
  order: CampaignOrderInput;
  /** null — visi tiekėjai viename faile */
  partnerId: string | null;
  partnerName?: string;
  screens: CampaignScreen[];
  bundles: CampaignBundle[];
}

export function buildReklamosPlanasXlsxFilename(
  order: CampaignOrderInput,
  calc: CampaignCalculator,
  partnerName?: string
): string {
  return buildReklamosPlanasFilename(
    order,
    calc.invoicePrefix,
    'xlsx',
    partnerName
  );
}

export async function buildReklamosPlanasXlsxBuffer(
  params: ExportReklamosPlanasParams
): Promise<{ buffer: ArrayBuffer; filename: string }> {
  const { order, partnerId, partnerName, screens, bundles } = params;
  const calc = createCampaignCalculator(order, screens, bundles, partnerId);

  if (calc.hasViaductScreens) {
    throw new Error('Viadukų užsakymų eksportas dar neįdiegtas — naudokite skaičiuoklę.');
  }

  const sheet = buildWorksheet(calc, order);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, SHEET_NAME);
  const filename = buildReklamosPlanasXlsxFilename(order, calc, partnerName);

  const xlsxBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  const logoResponse = await fetch(PIKSEL_LOGO_PATH);
  if (!logoResponse.ok) {
    throw new Error('Nepavyko užkrauti Piksel logotipo');
  }
  const logoBuffer = await logoResponse.arrayBuffer();
  const buffer = await applyFreezePanesInXlsx(
    await embedLogoInXlsx(xlsxBuffer, logoBuffer, {
      fromCol: COL.N,
      fromRow: PIKSEL_ROW - 1,
      toCol: COL.R + 1,
      toRow: PIKSEL_ROW,
      colWidths: COL_WIDTHS.slice(COL.N, COL.R + 1).map((col) => col.wch),
      rowHeightPt: PIKSEL_ROW_HEIGHT,
      placeholderCell: `${colLetter(COL.N)}${PIKSEL_ROW}`,
    }),
    HEADER_ROW
  );

  return { buffer, filename };
}

export async function downloadReklamosPlanas(params: ExportReklamosPlanasParams) {
  const { buffer, filename } = await buildReklamosPlanasXlsxBuffer(params);
  downloadXlsxBuffer(buffer, filename);
}

export async function downloadReklamosPlanasCombined(
  params: Omit<ExportReklamosPlanasParams, 'partnerId' | 'partnerName'>
) {
  await downloadReklamosPlanas({
    ...params,
    partnerId: null,
    partnerName: COMBINED_EXPORT_PARTNER_LABEL,
  });
}

export interface ExportReklamosPlanasZipParams {
  order: CampaignOrderInput;
  screens: CampaignScreen[];
  bundles: CampaignBundle[];
  partners: { id: string; name: string }[];
}

function uniqueZipEntryName(filename: string, used: Set<string>): string {
  if (!used.has(filename)) {
    used.add(filename);
    return filename;
  }
  const dot = filename.lastIndexOf('.');
  const base = dot >= 0 ? filename.slice(0, dot) : filename;
  const ext = dot >= 0 ? filename.slice(dot) : '';
  let n = 2;
  let candidate = `${base} (${n})${ext}`;
  while (used.has(candidate)) {
    n += 1;
    candidate = `${base} (${n})${ext}`;
  }
  used.add(candidate);
  return candidate;
}

function downloadZipBuffer(buffer: ArrayBuffer, filename: string) {
  const blob = new Blob([buffer], { type: 'application/zip' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export async function downloadReklamosPlanasZip(
  params: ExportReklamosPlanasZipParams
): Promise<void> {
  const { order, screens, bundles, partners } = params;
  if (partners.length === 0) {
    throw new Error('Nėra partnerių eksportui.');
  }

  const zip = new JSZip();
  const usedNames = new Set<string>();

  for (const partner of partners) {
    const { buffer, filename } = await buildReklamosPlanasXlsxBuffer({
      order,
      partnerId: partner.id,
      partnerName: partner.name,
      screens,
      bundles,
    });
    zip.file(uniqueZipEntryName(filename, usedNames), buffer);
  }

  const calc = createCampaignCalculator(
    order,
    screens,
    bundles,
    partners[0].id
  );
  const zipFilename = buildReklamosPlanasFilename(
    order,
    calc.invoicePrefix,
    'xlsx'
  ).replace(/\.xlsx$/i, '.zip');

  const zipBuffer = await zip.generateAsync({
    type: 'arraybuffer',
    compression: 'DEFLATE',
  });
  downloadZipBuffer(zipBuffer, zipFilename);
}

export { toCampaignOrderInput, toCampaignScreen } from '@/lib/reklamos-planas-data';
