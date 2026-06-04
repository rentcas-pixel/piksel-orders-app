import JSZip from 'jszip';

const DRAWING_REL_TYPE =
  'http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing';
const DRAWING_CONTENT_TYPE =
  'application/vnd.openxmlformats-officedocument.drawing+xml';

const EMU_PER_POINT = 12700;
const EMU_PER_PIXEL = 9525;
const MAX_DIGIT_WIDTH = 7;
/** Excel stulpelių EMU konversija šiek tiek suspaudžia — kompensuojame vertikaliai */
const LOGO_VERTICAL_SCALE = 1.3608;

export interface LogoAnchor {
  fromCol: number;
  fromRow: number;
  toCol: number;
  toRow: number;
  /** Stulpelių plotis (wch) nuo fromCol iki toCol-1 */
  colWidths?: number[];
  /** Eilutės aukštis punktais */
  rowHeightPt?: number;
  /** Langelis, kurį pašalinti prieš įterpiant paveikslėlį (pvz. N8) */
  placeholderCell?: string;
}

interface AnchorPoint {
  col: number;
  colOff: number;
  row: number;
  rowOff: number;
}

interface LogoPlacement {
  from: AnchorPoint;
  to: AnchorPoint;
}

function nextRelationshipId(relsXml: string): string {
  const ids = [...relsXml.matchAll(/Id="rId(\d+)"/g)].map((match) =>
    Number.parseInt(match[1], 10)
  );
  return `rId${Math.max(0, ...ids) + 1}`;
}

function readJpegSize(buffer: ArrayBuffer): { width: number; height: number } {
  const view = new DataView(buffer);
  if (view.byteLength < 4 || view.getUint16(0) !== 0xffd8) {
    throw new Error('Logotipas nėra JPEG formato');
  }

  let offset = 2;
  while (offset + 9 < view.byteLength) {
    if (view.getUint8(offset) !== 0xff) break;
    const marker = view.getUint8(offset + 1);
    const length = view.getUint16(offset + 2);
    if (marker === 0xc0 || marker === 0xc2) {
      return {
        height: view.getUint16(offset + 5),
        width: view.getUint16(offset + 7),
      };
    }
    offset += 2 + length;
  }

  throw new Error('Nepavyko nuskaityti logotipo matmenų');
}

function columnWidthToPixels(wch: number): number {
  return Math.trunc(
    ((256 * wch + Math.trunc(128 / MAX_DIGIT_WIDTH)) / 256) * MAX_DIGIT_WIDTH
  );
}

function columnWidthToEMU(wch: number): number {
  return Math.round(columnWidthToPixels(wch) * EMU_PER_PIXEL);
}

function ptToEMU(pt: number): number {
  return Math.round(pt * EMU_PER_POINT);
}

function resolveAnchorPoint(
  startCol: number,
  startRow: number,
  colWidths: number[],
  rowHeightPt: number,
  xEMU: number,
  yEMU: number
): AnchorPoint {
  let col = startCol;
  let remainingX = xEMU;

  for (let i = 0; i < colWidths.length; i++) {
    const widthEMU = columnWidthToEMU(colWidths[i]);
    if (remainingX <= widthEMU || i === colWidths.length - 1) {
      const rowHeightEMU = ptToEMU(rowHeightPt);
      let row = startRow;
      let rowOff = Math.max(0, yEMU);
      if (rowOff >= rowHeightEMU) {
        row += Math.floor(rowOff / rowHeightEMU);
        rowOff %= rowHeightEMU;
      }
      return {
        col,
        colOff: Math.min(Math.max(0, remainingX), widthEMU),
        row,
        rowOff,
      };
    }
    remainingX -= widthEMU;
    col += 1;
  }

  const rowHeightEMU = ptToEMU(rowHeightPt);
  let row = startRow;
  let rowOff = Math.max(0, yEMU);
  if (rowOff >= rowHeightEMU) {
    row += Math.floor(rowOff / rowHeightEMU);
    rowOff %= rowHeightEMU;
  }
  return { col: startCol, colOff: 0, row, rowOff };
}

function computeLogoPlacement(
  anchor: LogoAnchor,
  imageWidth: number,
  imageHeight: number
): LogoPlacement {
  const colCount = Math.max(0, anchor.toCol - anchor.fromCol);
  const colWidths =
    anchor.colWidths ??
    Array.from({ length: colCount }, () => 8.43);
  const rowHeightPt = anchor.rowHeightPt ?? 15;

  const containerWidthEMU = colWidths.reduce(
    (sum, wch) => sum + columnWidthToEMU(wch),
    0
  );
  const containerHeightEMU = ptToEMU(rowHeightPt);
  const imageAspect = imageWidth / imageHeight;

  let cx: number;
  let cy: number;
  if (containerWidthEMU / containerHeightEMU > imageAspect) {
    cy = containerHeightEMU;
    cx = Math.round(cy * imageAspect);
  } else {
    cx = containerWidthEMU;
    cy = Math.round(cx / imageAspect);
  }

  cy = Math.round(cy * LOGO_VERTICAL_SCALE);

  const colOff = Math.max(0, Math.round((containerWidthEMU - cx) / 2));
  const rowOff = Math.max(0, Math.round((containerHeightEMU - cy) / 2));

  return {
    from: resolveAnchorPoint(
      anchor.fromCol,
      anchor.fromRow,
      colWidths,
      rowHeightPt,
      colOff,
      rowOff
    ),
    to: resolveAnchorPoint(
      anchor.fromCol,
      anchor.fromRow,
      colWidths,
      rowHeightPt,
      colOff + cx,
      rowOff + cy
    ),
  };
}

function buildDrawingXml(placement: LogoPlacement): string {
  const { from, to } = placement;
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <xdr:twoCellAnchor editAs="oneCell">
    <xdr:from>
      <xdr:col>${from.col}</xdr:col>
      <xdr:colOff>${from.colOff}</xdr:colOff>
      <xdr:row>${from.row}</xdr:row>
      <xdr:rowOff>${from.rowOff}</xdr:rowOff>
    </xdr:from>
    <xdr:to>
      <xdr:col>${to.col}</xdr:col>
      <xdr:colOff>${to.colOff}</xdr:colOff>
      <xdr:row>${to.row}</xdr:row>
      <xdr:rowOff>${to.rowOff}</xdr:rowOff>
    </xdr:to>
    <xdr:pic>
      <xdr:nvPicPr>
        <xdr:cNvPr id="1" name="Piksel logo"/>
        <xdr:cNvPicPr><a:picLocks noChangeAspect="0"/></xdr:cNvPicPr>
      </xdr:nvPicPr>
      <xdr:blipFill>
        <a:blip r:embed="rId1"/>
        <a:stretch><a:fillRect/></a:stretch>
      </xdr:blipFill>
      <xdr:spPr>
        <a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/></a:xfrm>
        <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
      </xdr:spPr>
    </xdr:pic>
    <xdr:clientData/>
  </xdr:twoCellAnchor>
</xdr:wsDr>`;
}

export async function embedLogoInXlsx(
  xlsxBuffer: ArrayBuffer,
  logoBuffer: ArrayBuffer,
  anchor: LogoAnchor = { fromCol: 12, fromRow: 7, toCol: 19, toRow: 8 }
): Promise<ArrayBuffer> {
  const { width, height } = readJpegSize(logoBuffer);
  const placement = computeLogoPlacement(anchor, width, height);
  const zip = await JSZip.loadAsync(xlsxBuffer);

  zip.file('xl/media/image1.jpeg', logoBuffer);
  zip.file('xl/drawings/drawing1.xml', buildDrawingXml(placement));
  zip.file(
    'xl/drawings/_rels/drawing1.xml.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/image1.jpeg"/>
</Relationships>`
  );

  const relsPath = 'xl/worksheets/_rels/sheet1.xml.rels';
  const relsFile = zip.file(relsPath);
  if (!relsFile) {
    throw new Error('Excel lapo reliacijos nerastos');
  }

  let relsXml = await relsFile.async('string');
  const drawingRelId = nextRelationshipId(relsXml);
  relsXml = relsXml.replace(
    '</Relationships>',
    `<Relationship Id="${drawingRelId}" Type="${DRAWING_REL_TYPE}" Target="../drawings/drawing1.xml"/></Relationships>`
  );
  zip.file(relsPath, relsXml);

  const sheetPath = 'xl/worksheets/sheet1.xml';
  const sheetFile = zip.file(sheetPath);
  if (!sheetFile) {
    throw new Error('Excel lapas nerastas');
  }

  let sheetXml = await sheetFile.async('string');
  if (anchor.placeholderCell) {
    const cellRef = anchor.placeholderCell.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    sheetXml = sheetXml.replace(
      new RegExp(`<c r="${cellRef}"[^/]*\\/>|<c r="${cellRef}"[^>]*>[\\s\\S]*?<\\/c>`),
      ''
    );
  }
  if (!sheetXml.includes('<drawing ')) {
    sheetXml = sheetXml.replace(
      '</worksheet>',
      `<drawing r:id="${drawingRelId}"/></worksheet>`
    );
  }
  zip.file(sheetPath, sheetXml);

  const contentTypesPath = '[Content_Types].xml';
  let contentTypes = await zip.file(contentTypesPath)!.async('string');
  if (!contentTypes.includes('/xl/drawings/drawing1.xml')) {
    contentTypes = contentTypes.replace(
      '</Types>',
      `<Override PartName="/xl/drawings/drawing1.xml" ContentType="${DRAWING_CONTENT_TYPE}"/></Types>`
    );
    zip.file(contentTypesPath, contentTypes);
  }

  return zip.generateAsync({ type: 'arraybuffer', compression: 'DEFLATE' });
}

export async function applyFreezePanesInXlsx(
  xlsxBuffer: ArrayBuffer,
  freezeThroughRow: number
): Promise<ArrayBuffer> {
  const zip = await JSZip.loadAsync(xlsxBuffer);
  const sheetPath = 'xl/worksheets/sheet1.xml';
  const sheetFile = zip.file(sheetPath);
  if (!sheetFile) {
    throw new Error('Excel lapas nerastas');
  }

  const topLeftCell = `A${freezeThroughRow + 1}`;
  const sheetViews = `<sheetViews><sheetView workbookViewId="0"><pane ySplit="${freezeThroughRow}" topLeftCell="${topLeftCell}" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft" activeCell="${topLeftCell}" sqref="${topLeftCell}"/></sheetView></sheetViews>`;

  let sheetXml = await sheetFile.async('string');
  if (sheetXml.includes('<sheetViews>')) {
    sheetXml = sheetXml.replace(/<sheetViews>[\s\S]*?<\/sheetViews>/, sheetViews);
  } else {
    sheetXml = sheetXml.replace('<dimension ', `${sheetViews}<dimension `);
  }
  zip.file(sheetPath, sheetXml);

  return zip.generateAsync({ type: 'arraybuffer', compression: 'DEFLATE' });
}

export function downloadXlsxBuffer(buffer: ArrayBuffer, filename: string) {
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
