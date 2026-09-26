(function () {
  const COL = {
    A: 0, B: 1, C: 2, D: 3, E: 4, F: 5, G: 6, H: 7, I: 8, J: 9,
    // Metrikos (anksčiau U–AB; K–T grid’as pašalintas iš pagrindinio sheet’o)
    K: 10, L: 11, M: 12, N: 13, O: 14, P: 15, Q: 16, R: 17, S: 18,
  };

  const borderColor = "BFBFBF";
  const gridBorderColor = "808080";
  const ink = "000000";
  const white = "FFFFFF";
  const dark = "595959";

  const border = {
    top: { style: "thin", color: { rgb: borderColor } },
    bottom: { style: "thin", color: { rgb: borderColor } },
    left: { style: "thin", color: { rgb: borderColor } },
    right: { style: "thin", color: { rgb: borderColor } },
  };

  const baseStyle = {
    font: { name: "Open Sans", sz: 12, bold: false, color: { rgb: ink } },
    fill: { patternType: "solid", fgColor: { rgb: white } },
    alignment: { horizontal: "center", vertical: "center" },
    border,
  };

  const headerStyle = {
    ...baseStyle,
    font: { name: "Open Sans", sz: 12, bold: true, color: { rgb: ink } },
    fill: { patternType: "solid", fgColor: { rgb: white } },
  };

  const clone = (value) => JSON.parse(JSON.stringify(value));

  const whiteStyle = {
    font: { name: "Open Sans", sz: 12, bold: false, color: { rgb: ink } },
    fill: { patternType: "solid", fgColor: { rgb: white } },
    alignment: { horizontal: "center", vertical: "center" },
    border: {},
  };

  function colLetter(col) {
    let value = col + 1;
    let result = "";
    while (value > 0) {
      const remainder = (value - 1) % 26;
      result = String.fromCharCode(65 + remainder) + result;
      value = Math.floor((value - 1) / 26);
    }
    return result;
  }

  function writeCell(sheet, row, col, value, style = baseStyle, numberFormat, formula) {
    const address = `${colLetter(col)}${row}`;
    const cell = {
      t: typeof value === "number" ? "n" : "s",
      v: value,
      s: clone(style),
    };
    if (numberFormat) cell.z = numberFormat;
    if (formula) cell.f = formula;
    sheet[address] = cell;
  }

  function blankCell(sheet, row, col, style = baseStyle) {
    writeCell(sheet, row, col, " ", style);
  }

  function mergePair(sheet, row, col) {
    sheet["!merges"].push({ s: { r: row - 1, c: col }, e: { r: row, c: col } });
  }

  function writeInfo(sheet, plan) {
    const labelStyle = clone(baseStyle);
    labelStyle.font.bold = true;
    labelStyle.alignment.horizontal = "right";
    labelStyle.border = {};
    const valueStyle = clone(baseStyle);
    valueStyle.alignment.horizontal = "left";
    valueStyle.border = {};

    const info = [
      ["Agentūra:", plan.agency],
      ["Klientas:", plan.client],
      ["Laikotarpis:", `${plan.from} - ${plan.to}`],
      ["Intensyvumas:", plan.intensity],
      ["Plano Nr.:", plan.campaignNo],
      ["Klipo trukmė (s):", plan.clipDuration],
    ];

    info.forEach(([label, value], index) => {
      writeCell(sheet, index + 2, COL.B, label, labelStyle);
      writeCell(sheet, index + 2, COL.C, value, valueStyle);
    });
  }

  function writeHeaders(sheet) {
    const entries = [
      [COL.B, "Miestas"], [COL.C, "Ekranas"], [COL.D, "Matmenys (m)"],
      [COL.E, "Parametrai (px)"], [COL.F, "Tipas"], [COL.H, "Pradžia"],
      [COL.I, "Pabaiga"], [COL.J, "Dienų skaičius"], [COL.K, "Parodymų sk."],
      [COL.L, "OTS"], [COL.N, "Klipo kaina"], [COL.O, "CPT"],
      [COL.P, "Kaina be PVM"], [COL.Q, "Nuolaida"], [COL.R, "Kaina"],
    ];
    entries.forEach(([col, label]) => writeCell(sheet, 9, col, label, headerStyle));
  }

  function writeScreens(sheet, plan) {
    const mergeCols = [
      COL.A, COL.B, COL.C, COL.D, COL.E, COL.F, COL.G, COL.H, COL.I, COL.J,
      COL.K, COL.L, COL.M, COL.N, COL.O, COL.P, COL.Q, COL.R,
    ];
    const nameStyle = clone(baseStyle);
    nameStyle.font.color = { rgb: "906EFF" };
    nameStyle.font.bold = false;

    plan.screens.forEach((screen, index) => {
      const row = 10 + index * 2;
      const spacerRow = row + 1;
      const itemStyle = clone(baseStyle);
      const screenNameStyle = screen.active ? nameStyle : itemStyle;
      writeCell(sheet, row, COL.A, "-", baseStyle);
      writeCell(sheet, row, COL.B, screen.city, itemStyle);
      writeCell(sheet, row, COL.C, screen.name, screenNameStyle);
      writeCell(sheet, row, COL.D, screen.dimensions, itemStyle);
      writeCell(sheet, row, COL.E, screen.resolution, itemStyle);
      writeCell(sheet, row, COL.F, screen.type, itemStyle);
      if (screen.active) {
        writeCell(sheet, row, COL.H, screen.from || plan.from, itemStyle);
        writeCell(sheet, row, COL.I, screen.to || plan.to, itemStyle);
        writeCell(sheet, row, COL.J, screen.days != null ? screen.days : plan.days, itemStyle, "##0");
        writeCell(sheet, row, COL.K, screen.impressions, itemStyle, "### ##0");
        writeCell(sheet, row, COL.L, screen.ots, itemStyle, "### ##0");
        writeCell(sheet, row, COL.N, screen.clipPrice, itemStyle, "0.000");
        writeCell(sheet, row, COL.O, screen.cpt, itemStyle, "0.00");
        writeCell(sheet, row, COL.P, screen.gross, itemStyle, "## ###.#0");
        writeCell(sheet, row, COL.Q, screen.screenDiscount, itemStyle, "#0%");
        writeCell(sheet, row, COL.R, screen.net, itemStyle, "## ###.#0", `P${row}*(1-Q${row})`);
      }

      mergeCols.forEach((col) => {
        blankCell(sheet, spacerRow, col, baseStyle);
        mergePair(sheet, row, col);
      });
      sheet["!rows"][row - 1] = { hpt: 15 };
      sheet["!rows"][spacerRow - 1] = { hpt: 15 };
    });
  }

  function writeLayoutGrid(sheet, plan, startRow = 1, hourCol = 0, dayStartCol = 2) {
    const gridHeader = clone(headerStyle);
    const gridCell = clone(baseStyle);
    gridCell.font.sz = 10;
    const gridEdge = { style: "thin", color: { rgb: gridBorderColor } };
    gridCell.border = { top: gridEdge, bottom: gridEdge, left: gridEdge, right: gridEdge };
    gridHeader.border = clone(gridCell.border);

    const titleRow = startRow;
    const dayRow = startRow + 1;
    const firstHourRow = startRow + 2;
    const noteRow = firstHourRow + 17;

    const titleStyle = clone(gridHeader);
    titleStyle.border = {
      bottom: gridEdge,
      right: gridEdge,
    };
    writeCell(sheet, titleRow, dayStartCol, "Išdėstymas", titleStyle);
    sheet["!merges"].push({
      s: { r: titleRow - 1, c: dayStartCol },
      e: { r: titleRow - 1, c: dayStartCol + 6 },
    });
    ["P", "A", "T", "K", "P", "Š", "S"].forEach((day, index) => {
      writeCell(sheet, dayRow, dayStartCol + index, day, gridHeader);
    });
    for (let hourIndex = 0; hourIndex < 17; hourIndex += 1) {
      const row = firstHourRow + hourIndex;
      const hour = hourIndex + 6;
      const hourStyle = clone(baseStyle);
      hourStyle.alignment.horizontal = "right";
      hourStyle.border = {};
      writeCell(sheet, row, hourCol, `${hour}-${hour + 1}`, hourStyle);
      for (let day = 0; day < 7; day += 1) {
        const enabled = Boolean(plan.grid[day]?.[hourIndex]);
        writeCell(
          sheet,
          row,
          dayStartCol + day,
          enabled ? plan.viewsPerHour : " ",
          gridCell,
          enabled ? "0" : undefined
        );
      }
    }
    const noteStyle = clone(baseStyle);
    noteStyle.border = {
      top: { style: "thin", color: { rgb: borderColor } },
      right: { style: "thin", color: { rgb: borderColor } },
    };
    writeCell(sheet, noteRow, dayStartCol, `${plan.viewsPerHour} - parodymų valandoje`, noteStyle);
    sheet["!merges"].push({
      s: { r: noteRow - 1, c: dayStartCol },
      e: { r: noteRow - 1, c: dayStartCol + 6 },
    });
  }

  function buildLayoutSheet(plan) {
    const sheet = { "!merges": [], "!rows": [] };
    const lastCol = 40; // A–AO
    const lastRow = 80; // nuo 40 eilutės į apačią — baltas fonas
    for (let row = 1; row <= lastRow; row += 1) {
      for (let col = 0; col <= lastCol; col += 1) blankCell(sheet, row, col, whiteStyle);
    }
    writeLayoutGrid(sheet, plan, 2, 0, 2);
    sheet["!rows"][1] = { hpt: 33, customHeight: true }; // 2 eilutė
    sheet["!rows"][20] = { hpt: 30, customHeight: true }; // 21 eilutė
    sheet["!ref"] = `A1:${colLetter(lastCol)}${lastRow}`;
    sheet["!cols"] = [
      { wch: 11 },
      { wch: 1.2 },
      { wch: 3.5 }, { wch: 3.5 }, { wch: 3.5 }, { wch: 3.5 }, { wch: 3.5 }, { wch: 3.5 }, { wch: 3.5 },
      ...Array.from({ length: lastCol - 8 }, () => ({ wch: 8.43 })),
    ];
    return sheet;
  }

  function writeFooterLabelRow(sheet, row, label, style) {
    const spacerRow = row + 1;
    const labelStyle = clone(style);
    labelStyle.alignment = { horizontal: "right", vertical: "center" };
    labelStyle.border = {};
    writeCell(sheet, row, COL.P, label, labelStyle);
    blankCell(sheet, row, COL.Q, labelStyle);
    blankCell(sheet, spacerRow, COL.P, labelStyle);
    blankCell(sheet, spacerRow, COL.Q, labelStyle);
    sheet["!merges"].push({
      s: { r: row - 1, c: COL.P },
      e: { r: spacerRow - 1, c: COL.Q },
    });
    return spacerRow;
  }

  function clearVerticalBorders(sheet, row, startCol, endCol, bottomOnly) {
    const bottom = { style: "thin", color: { rgb: borderColor } };
    for (let col = startCol; col <= endCol; col += 1) {
      const address = `${colLetter(col)}${row}`;
      const existing = sheet[address];
      if (!existing) continue;
      const style = clone(existing.s || whiteStyle);
      style.border = bottomOnly ? { bottom } : {};
      sheet[address] = { ...existing, s: style };
    }
  }

  function applyRowBottomBorderOnly(sheet, row, startCol, endCol) {
    const bottom = { style: "thin", color: { rgb: borderColor } };
    for (let col = startCol; col <= endCol; col += 1) {
      const address = `${colLetter(col)}${row}`;
      const existing = sheet[address];
      const style = clone(existing?.s || whiteStyle);
      style.border = { bottom };
      if (!style.fill) {
        style.fill = { patternType: "solid", fgColor: { rgb: white } };
      }
      if (existing) {
        sheet[address] = { ...existing, s: style };
      } else {
        writeCell(sheet, row, col, " ", style);
      }
    }
  }

  function applyRowBottomBorder(sheet, row, startCol, endCol) {
    const bottom = { style: "thin", color: { rgb: borderColor } };
    for (let col = startCol; col <= endCol; col += 1) {
      const address = `${colLetter(col)}${row}`;
      const existing = sheet[address];
      const style = clone(existing?.s || whiteStyle);
      style.border = { ...(style.border || {}), bottom };
      if (!style.fill) {
        style.fill = { patternType: "solid", fgColor: { rgb: white } };
      }
      if (existing) {
        sheet[address] = { ...existing, s: style };
      } else {
        writeCell(sheet, row, col, " ", style);
      }
    }
  }

  function writeTotals(sheet, plan) {
    const firstRow = 10;
    const lastRow = firstRow + plan.screens.length * 2 - 1;
    const totalsRow = lastRow + 1;
    const totalsSpacer = totalsRow + 1;
    const totalStyle = clone(headerStyle);

    const activeScreens = plan.screens.filter((item) => item.active);
    const sums = {
      impressions: activeScreens.reduce((sum, item) => sum + item.impressions, 0),
      ots: activeScreens.reduce((sum, item) => sum + item.ots, 0),
      gross: activeScreens.reduce((sum, item) => sum + item.gross, 0),
      net: activeScreens.reduce((sum, item) => sum + item.net, 0),
      clip: activeScreens.reduce((sum, item) => sum + item.clipPrice, 0) / Math.max(activeScreens.length, 1),
      cpt: activeScreens.reduce((sum, item) => sum + item.cpt, 0) / Math.max(activeScreens.length, 1),
      discount: activeScreens.reduce((sum, item) => sum + item.screenDiscount, 0) / Math.max(activeScreens.length, 1),
    };

    writeCell(sheet, totalsRow, COL.J, "Viso:", totalStyle);
    writeCell(sheet, totalsRow, COL.K, sums.impressions, totalStyle, "#,##0", `SUM(K${firstRow}:K${lastRow})`);
    writeCell(sheet, totalsRow, COL.L, sums.ots, totalStyle, "#,##0", `SUM(L${firstRow}:L${lastRow})`);
    writeCell(sheet, totalsRow, COL.N, sums.clip, totalStyle, "0.000", `IFERROR(AVERAGE(N${firstRow}:N${lastRow}),0)`);
    writeCell(sheet, totalsRow, COL.O, sums.cpt, totalStyle, "0.00", `IFERROR(AVERAGE(O${firstRow}:O${lastRow}),0)`);
    writeCell(sheet, totalsRow, COL.P, sums.gross, totalStyle, "#,##0.00", `SUM(P${firstRow}:P${lastRow})`);
    writeCell(sheet, totalsRow, COL.Q, sums.discount, totalStyle, "0%", `IFERROR(AVERAGE(Q${firstRow}:Q${lastRow}),0)`);
    writeCell(sheet, totalsRow, COL.R, sums.net, totalStyle, "#,##0.00", `SUM(R${firstRow}:R${lastRow})`);

    [COL.J, COL.K, COL.L, COL.N, COL.O, COL.P, COL.Q, COL.R].forEach((col) => {
      blankCell(sheet, totalsSpacer, col, totalStyle);
      mergePair(sheet, totalsRow, col);
    });

    const totalDarkStyle = clone(headerStyle);
    totalDarkStyle.fill = { patternType: "solid", fgColor: { rgb: dark } };
    totalDarkStyle.font = { name: "Open Sans", sz: 12, bold: true, color: { rgb: white } };
    for (const row of [totalsRow, totalsSpacer]) {
      for (let col = COL.P; col <= COL.R; col += 1) {
        const address = `${colLetter(col)}${row}`;
        sheet[address].s = clone(totalDarkStyle);
      }
    }

    // Kaip paprastų ekranų XLS footer (Apimties / Laikotarpio / Galutinė)
    const footerDiscountStyle = clone(headerStyle);
    footerDiscountStyle.font = { name: "Open Sans", sz: 12, bold: false, color: { rgb: ink } };
    footerDiscountStyle.border = {};

    const amountRow = lastRow + 3;
    writeFooterLabelRow(sheet, amountRow, "Apimties Nuolaida", footerDiscountStyle);
    writeCell(sheet, amountRow, COL.R, plan.volumeDiscount, footerDiscountStyle, "#0%");
    blankCell(sheet, amountRow + 1, COL.R, footerDiscountStyle);
    sheet["!merges"].push({
      s: { r: amountRow - 1, c: COL.R },
      e: { r: amountRow, c: COL.R },
    });

    const periodRow = lastRow + 5;
    writeFooterLabelRow(sheet, periodRow, "Laikotarpio Nuolaida", footerDiscountStyle);
    writeCell(sheet, periodRow, COL.R, plan.periodDiscount, footerDiscountStyle, "#0%");
    blankCell(sheet, periodRow + 1, COL.R, footerDiscountStyle);
    sheet["!merges"].push({
      s: { r: periodRow - 1, c: COL.R },
      e: { r: periodRow, c: COL.R },
    });

    const finalRow = lastRow + 7;
    writeFooterLabelRow(sheet, finalRow, "Galutinė Kaina", footerDiscountStyle);
    writeCell(
      sheet,
      finalRow,
      COL.R,
      plan.total,
      footerDiscountStyle,
      "## ###.#0",
      `R${totalsRow}*(1-R${amountRow}-R${periodRow})`
    );
    blankCell(sheet, finalRow + 1, COL.R, footerDiscountStyle);
    sheet["!merges"].push({
      s: { r: finalRow - 1, c: COL.R },
      e: { r: finalRow, c: COL.R },
    });

    applyRowBottomBorder(sheet, totalsSpacer, COL.J, COL.R);

    // 28–33 (P–R): be vertikalių borderių; spacer eilutėse — tik apatinis
    for (let row = amountRow; row <= finalRow + 1; row += 1) {
      const isSpacer = row === amountRow + 1 || row === periodRow + 1 || row === finalRow + 1;
      clearVerticalBorders(sheet, row, COL.P, COL.R, isSpacer);
      // Kaimyninių stulpelių kraštai kitaip piešia „vertikalią“ liniją ant P/R
      const leftAddr = `${colLetter(COL.O)}${row}`;
      const rightAddr = `${colLetter(COL.R + 1)}${row}`;
      if (sheet[leftAddr]?.s) {
        const s = clone(sheet[leftAddr].s);
        if (s.border) {
          const { right, ...rest } = s.border;
          s.border = rest;
        }
        sheet[leftAddr] = { ...sheet[leftAddr], s };
      }
      if (sheet[rightAddr]?.s) {
        const s = clone(sheet[rightAddr].s);
        if (s.border) {
          const { left, ...rest } = s.border;
          s.border = rest;
        }
        sheet[rightAddr] = { ...sheet[rightAddr], s };
      }
    }
    for (const spacerRow of [amountRow + 1, periodRow + 1, finalRow + 1]) {
      applyRowBottomBorderOnly(sheet, spacerRow, COL.P, COL.R);
    }

    const footerLastRow = lastRow + 8;
    for (let row = firstRow; row <= footerLastRow; row += 1) {
      sheet["!rows"][row - 1] = { hpt: 15, customHeight: true };
    }
  }

  function buildPlanSheet(plan) {
    const sheet = { "!merges": [], "!rows": [] };
    for (let row = 1; row <= 206; row += 1) {
      for (let col = 0; col <= 30; col += 1) blankCell(sheet, row, col, whiteStyle);
    }
    writeInfo(sheet, plan);
    writeHeaders(sheet);
    writeScreens(sheet, plan);
    writeTotals(sheet, plan);

    sheet["!ref"] = "A1:AE206";
    sheet["!cols"] = [
      { wch: 6 }, { wch: 21 }, { wch: 26 }, { wch: 19 }, { wch: 19 }, { wch: 16 }, { wch: 3 },
      { wch: 16 }, { wch: 16 }, { wch: 19 },
      { wch: 17 }, { wch: 15 }, { wch: 3 }, { wch: 15 }, { wch: 11 }, { wch: 18 }, { wch: 15 }, { wch: 17 },
      { wch: 8.43 },
      ...Array.from({ length: 11 }, () => ({ wch: 8.43 })),
    ];
    sheet["!rows"][8] = { hpt: 30, customHeight: true };
    return sheet;
  }

  function sheetNameForPlan(plan, index) {
    const from = String(plan?.from || "").trim();
    const to = String(plan?.to || "").trim();
    let name = from && to ? `${from} - ${to}` : `Banga ${index + 1}`;
    name = name.replace(/[:\\/?*\[\]]/g, "-").trim();
    if (!name) name = `Banga ${index + 1}`;
    return name.slice(0, 31);
  }

  function sheetNameForLayout(plan, index) {
    const from = String(plan?.from || "").trim();
    const to = String(plan?.to || "").trim();
    let name = from && to ? `Išdėstymas ${from}` : `Išdėstymas ${index + 1}`;
    name = name.replace(/[:\\/?*\[\]]/g, "-").trim();
    if (!name) name = `Išdėstymas ${index + 1}`;
    return name.slice(0, 31);
  }

  function uniqueSheetName(workbook, desired) {
    const used = new Set((workbook.SheetNames || []).map((n) => n.toLowerCase()));
    let name = desired;
    let n = 2;
    while (used.has(name.toLowerCase())) {
      const suffix = ` (${n})`;
      name = `${desired.slice(0, Math.max(1, 31 - suffix.length))}${suffix}`;
      n += 1;
    }
    return name;
  }

  function isLayoutSheetName(name) {
    return String(name || "").toLowerCase().startsWith("išdėstymas")
      || String(name || "").toLowerCase().startsWith("isdestymas");
  }

  function buildPlanWorkbook(plan) {
    if (!window.XLSX) throw new Error("Excel eksporto biblioteka neįkelta");
    const wavePlans = Array.isArray(plan?.wavePlans) && plan.wavePlans.length
      ? plan.wavePlans
      : [plan];
    if (!wavePlans[0]?.screens?.length) throw new Error("Pasirinkite bent vieną ekraną");

    const workbook = window.XLSX.utils.book_new();
    wavePlans.forEach((wavePlan, index) => {
      if (!wavePlan?.screens?.length) return;
      const planSheet = buildPlanSheet(wavePlan);
      const planName = uniqueSheetName(workbook, sheetNameForPlan(wavePlan, index));
      window.XLSX.utils.book_append_sheet(workbook, planSheet, planName);

      const layoutSheet = buildLayoutSheet(wavePlan);
      const layoutName = uniqueSheetName(workbook, sheetNameForLayout(wavePlan, index));
      window.XLSX.utils.book_append_sheet(workbook, layoutSheet, layoutName);
    });
    if (!workbook.SheetNames.length) throw new Error("Nėra lapų eksportui");
    return workbook;
  }

  async function getWorkbookSheetNames(zip) {
    const workbookXml = await zip.file("xl/workbook.xml").async("string");
    const names = [];
    const re = /<sheet\b[^>]*\bname="([^"]+)"/g;
    let match;
    while ((match = re.exec(workbookXml))) names.push(match[1]);
    return names;
  }

  function readJpegSize(buffer) {
    const view = new DataView(buffer);
    if (view.byteLength < 4 || view.getUint16(0) !== 0xffd8) {
      return { width: 1117, height: 408 };
    }
    let offset = 2;
    while (offset + 9 < view.byteLength) {
      if (view.getUint8(offset) !== 0xff) break;
      const marker = view.getUint8(offset + 1);
      const length = view.getUint16(offset + 2);
      if (marker === 0xc0 || marker === 0xc1 || marker === 0xc2) {
        return {
          height: view.getUint16(offset + 5),
          width: view.getUint16(offset + 7),
        };
      }
      offset += 2 + length;
    }
    return { width: 1117, height: 408 };
  }

  async function embedLogo(xlsxBuffer) {
    if (!window.JSZip) return xlsxBuffer;
    const zip = await window.JSZip.loadAsync(xlsxBuffer);
    const logoResponse = await fetch("./assets/Piksel-Logotipas-juodas-RGB.jpg");
    if (!logoResponse.ok) return xlsxBuffer;
    const logoBuffer = await logoResponse.arrayBuffer();
    zip.file("xl/media/image1.jpeg", logoBuffer);

    const { width: imgW, height: imgH } = readJpegSize(logoBuffer);
    const aspect = imgW / Math.max(1, imgH);

    // Dydis pagal eilutės aukštį (42 pt), išlaikant natūralų aspect ratio
    const EMU_PER_POINT = 12700;
    const EMU_PER_PIXEL = 9525;
    const MAX_DIGIT_WIDTH = 7;
    const ROW_HEIGHT_PT = 42;
    let logoCy = Math.round(ROW_HEIGHT_PT * EMU_PER_POINT);
    let logoCx = Math.round(logoCy * aspect);

    const colWidths = [
      6, 21, 26, 19, 19, 16, 3,
      16, 16, 19,
      17, 15, 3, 15, 11, 18, 15, 17,
      8.43,
    ];
    const colWchToEmu = (wch) => {
      const px = Math.trunc(((256 * wch + Math.trunc(128 / MAX_DIGIT_WIDTH)) / 256) * MAX_DIGIT_WIDTH);
      return Math.round(px * EMU_PER_PIXEL);
    };
    let sLeftEmu = 0;
    for (let i = 0; i < COL.S; i += 1) {
      sLeftEmu += colWchToEmu(colWidths[i] ?? 8.43);
    }
    // Jei logo platesnis nei iki S — sumažinam proporcingai
    if (logoCx > sLeftEmu) {
      const scale = sLeftEmu / logoCx;
      logoCx = Math.round(logoCx * scale);
      logoCy = Math.round(logoCy * scale);
    }

    const logoLeftEmu = Math.max(0, sLeftEmu - logoCx);
    let fromCol = 0;
    let fromColOff = 0;
    let remaining = logoLeftEmu;
    for (let i = 0; i < colWidths.length; i += 1) {
      const widthEmu = colWchToEmu(colWidths[i] ?? 8.43);
      if (remaining <= widthEmu) {
        fromCol = i;
        fromColOff = Math.max(0, Math.round(remaining));
        break;
      }
      remaining -= widthEmu;
      fromCol = i + 1;
      fromColOff = 0;
    }

    // Logo viršus ties 4 eilutės viršumi
    const drawingXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
  <xdr:oneCellAnchor>
    <xdr:from>
      <xdr:col>${fromCol}</xdr:col>
      <xdr:colOff>${fromColOff}</xdr:colOff>
      <xdr:row>3</xdr:row>
      <xdr:rowOff>0</xdr:rowOff>
    </xdr:from>
    <xdr:ext cx="${logoCx}" cy="${logoCy}"/>
    <xdr:pic>
      <xdr:nvPicPr><xdr:cNvPr id="1" name="Piksel logotipas"/><xdr:cNvPicPr><a:picLocks noChangeAspect="1"/></xdr:cNvPicPr></xdr:nvPicPr>
      <xdr:blipFill><a:blip xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:embed="rId1"/><a:stretch><a:fillRect/></a:stretch></xdr:blipFill>
      <xdr:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></xdr:spPr>
    </xdr:pic>
    <xdr:clientData/>
  </xdr:oneCellAnchor>
</xdr:wsDr>`;

    const sheetFiles = Object.keys(zip.files)
      .filter((path) => /^xl\/worksheets\/sheet\d+\.xml$/.test(path))
      .sort((a, b) => {
        const na = Number((/sheet(\d+)/.exec(a) || [])[1] || 0);
        const nb = Number((/sheet(\d+)/.exec(b) || [])[1] || 0);
        return na - nb;
      });
    const sheetNames = await getWorkbookSheetNames(zip);

    let contentTypes = await zip.file("[Content_Types].xml").async("string");
    if (!contentTypes.includes('Extension="jpeg"')) {
      contentTypes = contentTypes.replace("</Types>", '<Default Extension="jpeg" ContentType="image/jpeg"/></Types>');
    }

    for (let i = 0; i < sheetFiles.length; i += 1) {
      if (isLayoutSheetName(sheetNames[i])) continue;

      const sheetPath = sheetFiles[i];
      const sheetIndex = i + 1;
      const drawingPath = `xl/drawings/drawing${sheetIndex}.xml`;
      const drawingRelsPath = `xl/drawings/_rels/drawing${sheetIndex}.xml.rels`;
      const sheetRelsPath = `xl/worksheets/_rels/sheet${sheetIndex}.xml.rels`;

      zip.file(drawingPath, drawingXml);
      zip.file(drawingRelsPath, `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/image1.jpeg"/>
</Relationships>`);

      let sheetXml = await zip.file(sheetPath).async("string");
      if (!sheetXml.includes("xmlns:r=")) {
        sheetXml = sheetXml.replace("<worksheet", '<worksheet xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"');
      }
      if (!sheetXml.includes("<drawing ")) {
        sheetXml = sheetXml.replace("</worksheet>", '<drawing r:id="rId1"/></worksheet>');
      }
      zip.file(sheetPath, sheetXml);
      zip.file(sheetRelsPath, `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/drawing${sheetIndex}.xml"/>
</Relationships>`);

      if (!contentTypes.includes(`/xl/drawings/drawing${sheetIndex}.xml`)) {
        contentTypes = contentTypes.replace(
          "</Types>",
          `<Override PartName="/xl/drawings/drawing${sheetIndex}.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/></Types>`
        );
      }
    }

    zip.file("[Content_Types].xml", contentTypes);
    return zip.generateAsync({ type: "arraybuffer", compression: "DEFLATE" });
  }

  async function freezeHeaderRows(xlsxBuffer) {
    const zip = await window.JSZip.loadAsync(xlsxBuffer);
    const sheetFiles = Object.keys(zip.files)
      .filter((path) => /^xl\/worksheets\/sheet\d+\.xml$/.test(path))
      .sort((a, b) => {
        const na = Number((/sheet(\d+)/.exec(a) || [])[1] || 0);
        const nb = Number((/sheet(\d+)/.exec(b) || [])[1] || 0);
        return na - nb;
      });
    const sheetNames = await getWorkbookSheetNames(zip);
    const sheetViews = '<sheetViews><sheetView workbookViewId="0"><pane ySplit="9" topLeftCell="A10" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft" activeCell="A10" sqref="A10"/></sheetView></sheetViews>';
    for (let i = 0; i < sheetFiles.length; i += 1) {
      if (isLayoutSheetName(sheetNames[i])) continue;
      const sheetPath = sheetFiles[i];
      let sheetXml = await zip.file(sheetPath).async("string");
      if (sheetXml.includes("<sheetViews>")) {
        sheetXml = sheetXml.replace(/<sheetViews>[\s\S]*?<\/sheetViews>/, sheetViews);
      } else {
        sheetXml = sheetXml.replace("<dimension ", `${sheetViews}<dimension `);
      }
      zip.file(sheetPath, sheetXml);
    }
    return zip.generateAsync({ type: "arraybuffer", compression: "DEFLATE" });
  }

  function defaultPlanFilename(plan, suffix = "Bendras") {
    const date = new Date().toISOString().slice(0, 10);
    const number = String(plan.campaignNo).replace(/^U-/, "");
    const client = String(plan.client || "Klientas")
      .replace(/[\u2010-\u2015\u2212]/g, "-")
      .replace(/[^a-zA-Z0-9_-]+/g, "-");
    const safeSuffix = String(suffix || "Bendras")
      .replace(/[\u2010-\u2015\u2212]/g, "-")
      .replace(/[^a-zA-Z0-9_-]+/g, "-");
    return `Piksel-${number}-U-${client}-${date}-${safeSuffix}.xlsx`;
  }

  async function buildPlanBytes(plan) {
    const workbook = buildPlanWorkbook(plan);
    const raw = window.XLSX.write(workbook, { bookType: "xlsx", type: "array", compression: true });
    const withLogo = await embedLogo(raw);
    return freezeHeaderRows(withLogo);
  }

  async function exportPlan(plan, options = {}) {
    const filename = options.filename || defaultPlanFilename(plan, options.suffix || "Bendras");
    const finalized = await buildPlanBytes(plan);
    const blob = new Blob([finalized], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return filename;
  }

  async function exportPlansZip(entries, zipName) {
    if (!window.JSZip) throw new Error("JSZip nerastas");
    const zip = new window.JSZip();
    for (const entry of entries) {
      const bytes = await buildPlanBytes(entry.plan);
      zip.file(entry.filename, bytes);
    }
    const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = zipName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return zipName;
  }

  window.PikselExcel = { buildPlanWorkbook, embedLogo, freezeHeaderRows, exportPlan, buildPlanBytes, exportPlansZip, defaultPlanFilename };
})();
