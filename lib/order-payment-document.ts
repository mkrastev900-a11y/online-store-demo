import { readFileSync } from "node:fs";
import { join } from "node:path";
import { resolvePublicContactEmails } from "@/lib/contact-config";
import { EMAIL_BRAND_NAME } from "@/lib/email-config";

const EMBEDDED_FONT = readFileSync(join(process.cwd(), "public", "fonts", "Geist-Regular.ttf"));

export type PaymentDocumentOrder = {
  createdAt: Date;
  total: unknown;
  shippingCost: unknown;
  promoCode?: string | null;
  promoDiscount?: unknown;
  customerName: string;
  customerEmail: string;
  customerPhone: string | null;
  address: string;
  city: string;
  postalCode: string;
  country: string;
  deliveryMethod: string;
  paymentMethod: string;
  paymentStatus: string;
  vatRegisteredAtSale?: boolean;
  vatRateAtSale?: unknown;
  taxBaseAtSale?: unknown;
  vatAmountAtSale?: unknown;
  courierProvider: string | null;
  courierOfficeName: string | null;
  notes: string | null;
  items: Array<{
    name: string;
    size: string;
    price: unknown;
    quantity: number;
  }>;
};

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const PDF_FONT = "F1";
const PDF_BASE_FONT = "GeistRegular";

type PdfPage = {
  commands: string[];
  usedGlyphs: Map<number, number>;
};

type FontCmap = {
  glyphIdForCodeUnit: (codeUnit: number) => number;
};

function money(value: unknown) {
  return new Intl.NumberFormat("bg-BG", { style: "currency", currency: "EUR" }).format(Number(value));
}

function deliveryLabel(value: string) {
  return value === "OFFICE" ? "До офис / автомат" : "До адрес";
}

function paymentLabel(value: string) {
  return value === "CARD" ? "Онлайн с карта" : "При получаване (ППП)";
}

function courierLabel(value: string | null) {
  if (value === "ECONT") return "Еконт";
  if (value === "SPEEDY") return "Спиди";
  return "-";
}

function cleanText(value: unknown) {
  return String(value ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function number(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/\.?0+$/, "");
}

function rgb(hex: string) {
  const value = hex.replace("#", "");
  const r = Number.parseInt(value.slice(0, 2), 16) / 255;
  const g = Number.parseInt(value.slice(2, 4), 16) / 255;
  const b = Number.parseInt(value.slice(4, 6), 16) / 255;
  return `${number(r)} ${number(g)} ${number(b)}`;
}

function fillRect(commands: string[], x: number, y: number, width: number, height: number, fill: string) {
  commands.push(`${rgb(fill)} rg ${number(x)} ${number(y)} ${number(width)} ${number(height)} re f`);
}

function strokeRect(commands: string[], x: number, y: number, width: number, height: number, stroke: string, lineWidth = 1) {
  commands.push(`${number(lineWidth)} w ${rgb(stroke)} RG ${number(x)} ${number(y)} ${number(width)} ${number(height)} re S`);
}

function drawLine(commands: string[], x1: number, y1: number, x2: number, y2: number, stroke = "#eadce2", lineWidth = 1) {
  commands.push(`${number(lineWidth)} w ${rgb(stroke)} RG ${number(x1)} ${number(y1)} m ${number(x2)} ${number(y2)} l S`);
}

function readUInt16(buffer: Buffer, offset: number) {
  return buffer.readUInt16BE(offset);
}

function readUInt32(buffer: Buffer, offset: number) {
  return buffer.readUInt32BE(offset);
}

function fontTableOffset(font: Buffer, tagToFind: string) {
  const tableCount = readUInt16(font, 4);
  for (let index = 0; index < tableCount; index += 1) {
    const offset = 12 + index * 16;
    const tag = font.toString("ascii", offset, offset + 4);
    if (tag === tagToFind) return readUInt32(font, offset + 8);
  }
  throw new Error(`Embedded PDF font is missing ${tagToFind} table.`);
}

function createFormat4Cmap(font: Buffer, offset: number): FontCmap {
  const segmentCount = readUInt16(font, offset + 6) / 2;
  const endCodeOffset = offset + 14;
  const startCodeOffset = endCodeOffset + 2 + segmentCount * 2;
  const idDeltaOffset = startCodeOffset + segmentCount * 2;
  const idRangeOffsetOffset = idDeltaOffset + segmentCount * 2;

  return {
    glyphIdForCodeUnit(codeUnit: number) {
      for (let segment = 0; segment < segmentCount; segment += 1) {
        const endCode = readUInt16(font, endCodeOffset + segment * 2);
        const startCode = readUInt16(font, startCodeOffset + segment * 2);
        if (codeUnit < startCode || codeUnit > endCode) continue;

        const idDelta = readUInt16(font, idDeltaOffset + segment * 2);
        const idRangeOffset = readUInt16(font, idRangeOffsetOffset + segment * 2);
        if (idRangeOffset === 0) return (codeUnit + idDelta) & 0xffff;

        const glyphIndexOffset = idRangeOffsetOffset + segment * 2 + idRangeOffset + (codeUnit - startCode) * 2;
        if (glyphIndexOffset < 0 || glyphIndexOffset + 2 > font.length) return 0;

        const glyphIndex = readUInt16(font, glyphIndexOffset);
        return glyphIndex === 0 ? 0 : (glyphIndex + idDelta) & 0xffff;
      }

      return 0;
    },
  };
}

function createEmbeddedFontCmap(font: Buffer): FontCmap {
  const cmapOffset = fontTableOffset(font, "cmap");
  const subtableCount = readUInt16(font, cmapOffset + 2);
  const subtables = [];

  for (let index = 0; index < subtableCount; index += 1) {
    const recordOffset = cmapOffset + 4 + index * 8;
    const platform = readUInt16(font, recordOffset);
    const encoding = readUInt16(font, recordOffset + 2);
    const offset = cmapOffset + readUInt32(font, recordOffset + 4);
    const format = readUInt16(font, offset);
    subtables.push({ platform, encoding, offset, format });
  }

  const preferred = subtables.find((table) => table.format === 4 && table.platform === 3 && table.encoding === 1)
    ?? subtables.find((table) => table.format === 4);
  if (!preferred) throw new Error("Embedded PDF font has no supported cmap format 4 table.");
  return createFormat4Cmap(font, preferred.offset);
}

const EMBEDDED_FONT_CMAP = createEmbeddedFontCmap(EMBEDDED_FONT);

function embeddedGlyphWidth(glyphId: number) {
  const headOffset = fontTableOffset(EMBEDDED_FONT, "head");
  const hheaOffset = fontTableOffset(EMBEDDED_FONT, "hhea");
  const hmtxOffset = fontTableOffset(EMBEDDED_FONT, "hmtx");
  const unitsPerEm = readUInt16(EMBEDDED_FONT, headOffset + 18);
  const hMetricCount = readUInt16(EMBEDDED_FONT, hheaOffset + 34);
  const metricIndex = Math.max(0, Math.min(glyphId, hMetricCount - 1));
  const advanceWidth = readUInt16(EMBEDDED_FONT, hmtxOffset + metricIndex * 4);
  return Math.max(1, Math.round((advanceWidth / unitsPerEm) * 1000));
}

function buildGlyphWidths(glyphIds: number[]) {
  const uniqueGlyphs = [...new Set(glyphIds)]
    .filter((glyphId) => Number.isInteger(glyphId) && glyphId > 0 && glyphId <= 0xffff)
    .sort((a, b) => a - b);

  return uniqueGlyphs
    .map((glyphId) => `${glyphId} [${embeddedGlyphWidth(glyphId)}]`)
    .join(" ");
}

function encodeTextForFont(usedGlyphs: Map<number, number>, value: string) {
  let hex = "";
  for (let index = 0; index < value.length; index += 1) {
    const codeUnit = value.charCodeAt(index);
    const glyphId = EMBEDDED_FONT_CMAP.glyphIdForCodeUnit(codeUnit)
      || EMBEDDED_FONT_CMAP.glyphIdForCodeUnit("?".charCodeAt(0));
    if (glyphId) {
      usedGlyphs.set(glyphId, codeUnit);
      hex += glyphId.toString(16).padStart(4, "0");
    }
  }
  return hex;
}

function textWidth(value: string, size: number) {
  let units = 0;
  for (const char of value) {
    if (char === " ") units += 0.28;
    else if (/[,.:;!|'`]/.test(char)) units += 0.24;
    else if (/[ilI1]/.test(char)) units += 0.3;
    else if (/[mwMW]/.test(char)) units += 0.78;
    else units += 0.56;
  }
  return units * size;
}

function splitLongWord(word: string, maxWidth: number, size: number) {
  const parts: string[] = [];
  let current = "";
  for (const char of word) {
    const next = `${current}${char}`;
    if (current && textWidth(next, size) > maxWidth) {
      parts.push(current);
      current = char;
    } else {
      current = next;
    }
  }
  if (current) parts.push(current);
  return parts;
}

function wrapText(value: unknown, maxWidth: number, size: number) {
  const words = cleanText(value).split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    if (textWidth(word, size) > maxWidth) {
      if (current) {
        lines.push(current);
        current = "";
      }
      lines.push(...splitLongWord(word, maxWidth, size));
      continue;
    }

    const next = current ? `${current} ${word}` : word;
    if (current && textWidth(next, size) > maxWidth) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }

  if (current) lines.push(current);
  return lines.length ? lines : [""];
}

function text(
  page: PdfPage,
  x: number,
  y: number,
  value: unknown,
  size = 10,
  fill = "#351022",
  weight: 400 | 600 | 700 | 800 = 400,
) {
  const safe = cleanText(value);
  if (!safe) return;
  const encoded = encodeTextForFont(page.usedGlyphs, safe);
  page.commands.push(`${rgb(fill)} rg BT /${PDF_FONT} ${number(size)} Tf 1 0 0 1 ${number(x)} ${number(y)} Tm <${encoded}> Tj ET`);
  if (weight >= 700) {
    page.commands.push(`${rgb(fill)} rg BT /${PDF_FONT} ${number(size)} Tf 1 0 0 1 ${number(x + 0.25)} ${number(y)} Tm <${encoded}> Tj ET`);
  }
}

function textBlock(
  page: PdfPage,
  x: number,
  y: number,
  value: unknown,
  options: { width: number; size?: number; lineHeight?: number; fill?: string; weight?: 400 | 600 | 700 | 800; maxLines?: number },
) {
  const size = options.size ?? 10;
  const lineHeight = options.lineHeight ?? size + 5;
  const lines = wrapText(value, options.width, size).slice(0, options.maxLines);
  lines.forEach((line, index) => text(page, x, y - index * lineHeight, line, size, options.fill, options.weight));
  return y - lines.length * lineHeight;
}

function createPage(): PdfPage {
  const page = { commands: [], usedGlyphs: new Map<number, number>() };
  fillRect(page.commands, 0, 0, PAGE_WIDTH, PAGE_HEIGHT, "#f8f2ec");
  fillRect(page.commands, 40, 50, PAGE_WIDTH - 80, PAGE_HEIGHT - 100, "#ffffff");
  strokeRect(page.commands, 40, 50, PAGE_WIDTH - 80, PAGE_HEIGHT - 100, "#eadce2");
  fillRect(page.commands, 40, PAGE_HEIGHT - 120, PAGE_WIDTH - 80, 70, "#4e0827");
  return page;
}

function createPaymentDocumentPage(
  order: PaymentDocumentOrder,
  pageItems: PaymentDocumentOrder["items"],
  pageIndex: number,
  pageCount: number,
  startItemIndex: number,
) {
  const page = createPage();
  const subtotal = order.items.reduce((sum, item) => sum + Number(item.price) * item.quantity, 0);
  const date = new Intl.DateTimeFormat("bg-BG", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "Europe/Sofia",
  }).format(order.createdAt);
  const office = order.courierOfficeName ? ` · ${order.courierOfficeName}` : "";
  const address = `${order.address}, ${order.postalCode} ${order.city}, ${order.country}`;
  const orderContactEmail = resolvePublicContactEmails().orders;

  text(page, 58, PAGE_HEIGHT - 80, EMAIL_BRAND_NAME.toLocaleUpperCase("en-US"), 20, "#f3d476", 800);
  text(page, 58, PAGE_HEIGHT - 103, "Платежен документ / потвърждение на заявка", 11, "#fff6df", 600);
  if (pageCount > 1) text(page, PAGE_WIDTH - 92, PAGE_HEIGHT - 103, `${pageIndex + 1} / ${pageCount}`, 10, "#fff6df", 600);

  text(page, 58, 690, "Данни за заявката", 16, "#351022", 700);
  text(page, 58, 665, `Дата: ${date}`, 10, "#725765");
  text(page, 58, 645, `Клиент: ${order.customerName}`, 10, "#351022", 600);
  text(page, 58, 625, `Имейл: ${order.customerEmail}`, 10, "#725765");
  text(page, 58, 605, `Телефон: ${order.customerPhone || "-"}`, 10, "#725765");

  text(page, 315, 690, "Доставка и плащане", 16, "#351022", 700);
  text(page, 315, 665, `Куриер: ${courierLabel(order.courierProvider)}`, 10, "#351022", 600);
  textBlock(page, 315, 645, `Метод: ${deliveryLabel(order.deliveryMethod)}${office}`, {
    width: 220,
    size: 10,
    lineHeight: 15,
    fill: "#725765",
    maxLines: 2,
  });
  text(page, 315, 610, `Плащане: ${paymentLabel(order.paymentMethod)}`, 10, "#725765");
  text(page, 315, 590, `Статус на плащането: ${order.paymentStatus}`, 10, "#725765");

  text(page, 58, 560, "Адрес", 12, "#351022", 700);
  textBlock(page, 58, 542, address, { width: 480, size: 10, lineHeight: 15, fill: "#725765", maxLines: 3 });

  const tableTop = 480;
  fillRect(page.commands, 58, tableTop, PAGE_WIDTH - 116, 28, "#f1dfbd");
  text(page, 70, tableTop + 9, "Артикул", 10, "#351022", 700);
  text(page, 340, tableTop + 9, "Размер", 10, "#351022", 700);
  text(page, 430, tableTop + 9, "Брой", 10, "#351022", 700);
  text(page, 535, tableTop + 9, "Сума", 10, "#351022", 700);

  let y = tableTop - 25;
  for (let index = 0; index < pageItems.length; index += 1) {
    const item = pageItems[index];
    const itemLines = wrapText(`${startItemIndex + index + 1}. ${item.name}`, 250, 10).slice(0, 2);
    itemLines.forEach((line, lineIndex) => text(page, 70, y - lineIndex * 14, line, 10, "#351022", lineIndex === 0 ? 600 : 400));
    text(page, 340, y, item.size || "-", 10, "#351022", 600);
    text(page, 435, y, item.quantity, 10, "#351022", 600);
    text(page, 490, y, money(Number(item.price) * item.quantity), 10, "#351022", 600);
    drawLine(page.commands, 58, y - 18, PAGE_WIDTH - 58, y - 18);
    y -= 44;
  }

  if (pageIndex === pageCount - 1) {
    const totalsY = 190;
    fillRect(page.commands, 315, totalsY, 220, 115, "#fbf3e5");
    strokeRect(page.commands, 315, totalsY, 220, 115, "#ead7b3");
    text(page, 335, totalsY + 85, "Артикули", 10, "#351022");
    text(page, 460, totalsY + 85, money(subtotal), 10, "#351022", 700);
    const hasPromo = Number(order.promoDiscount ?? 0) > 0;
    if (hasPromo) {
      text(page, 335, totalsY + 60, `Промокод ${order.promoCode || ""}`, 10, "#247039");
      text(page, 460, totalsY + 60, `-${money(order.promoDiscount)}`, 10, "#247039", 700);
      text(page, 335, totalsY + 40, "Доставка", 10, "#351022");
      text(page, 460, totalsY + 40, Number(order.shippingCost) ? money(order.shippingCost) : "Безплатна", 10, "#351022", 700);
      drawLine(page.commands, 335, totalsY + 31, 515, totalsY + 31, "#c69a46", 1.4);
    } else {
      text(page, 335, totalsY + 60, "Доставка", 10, "#351022");
      text(page, 460, totalsY + 60, Number(order.shippingCost) ? money(order.shippingCost) : "Безплатна", 10, "#351022", 700);
      drawLine(page.commands, 335, totalsY + 43, 515, totalsY + 43, "#c69a46", 1.4);
    }
    text(page, 335, totalsY + 20, "Общо", 14, "#351022", 700);
    text(page, 460, totalsY + 20, money(order.total), 14, "#6d0d35", 800);

    if (order.vatRegisteredAtSale) {
      text(page, 335, totalsY - 22, `Данъчна основа: ${money(order.taxBaseAtSale ?? 0)}`, 9, "#725765");
      text(page, 335, totalsY - 38, `ДДС ${Number(order.vatRateAtSale ?? 0)}%: ${money(order.vatAmountAtSale ?? 0)}`, 9, "#725765");
    } else {
      text(page, 335, totalsY - 22, "Продажба без начислен ДДС", 9, "#725765");
    }

    if (order.notes) {
      text(page, 58, totalsY + 85, "Бележка", 12, "#351022", 700);
      textBlock(page, 58, totalsY + 63, order.notes, { width: 220, size: 9, lineHeight: 13, fill: "#725765", maxLines: 5 });
    }
  }

  text(page, 58, 87, "Документът е автоматично генериран след направената заявка.", 8.5, "#8c7480");
  text(page, PAGE_WIDTH - 165, 87, EMAIL_BRAND_NAME, 8.5, "#8c7480", 600);
  text(page, 58, 68, `Въпроси по поръчката: ${orderContactEmail}`, 8.5, "#8c7480");

  return page;
}

function buildToUnicodeCMap(glyphs: Map<number, number>) {
  const mappings = [...glyphs.entries()]
    .filter(([glyphId, codeUnit]) => (
      Number.isInteger(glyphId) &&
      Number.isInteger(codeUnit) &&
      glyphId > 0 &&
      glyphId <= 0xffff &&
      codeUnit > 0 &&
      codeUnit <= 0xffff
    ))
    .sort(([left], [right]) => left - right)
    .map(([glyphId, codeUnit]) => {
      const source = glyphId.toString(16).padStart(4, "0");
      const target = codeUnit.toString(16).padStart(4, "0");
      return `<${source}> <${target}>`;
    });

  const chunks: string[] = [];
  for (let index = 0; index < mappings.length; index += 100) {
    const group = mappings.slice(index, index + 100);
    chunks.push(`${group.length} beginbfchar\n${group.join("\n")}\nendbfchar`);
  }

  return `/CIDInit /ProcSet findresource begin
12 dict begin
begincmap
/CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def
/CMapName /StoreIdentityH def
/CMapType 2 def
1 begincodespacerange
<0000> <ffff>
endcodespacerange
${chunks.join("\n")}
endcmap
CMapName currentdict /CMap defineresource pop
end
end`;
}

function streamObject(stream: Buffer | string, extraDictionary = "") {
  const buffer = Buffer.isBuffer(stream) ? stream : Buffer.from(stream);
  return Buffer.concat([
    Buffer.from(`<< /Length ${buffer.length}${extraDictionary ? ` ${extraDictionary}` : ""} >>\nstream\n`),
    buffer,
    Buffer.from("\nendstream"),
  ]);
}

function pagesToPdf(pages: PdfPage[]) {
  const objects: Buffer[] = [];
  const pageObjectIds: number[] = [];
  const contentObjectIds: number[] = [];
  const usedGlyphs = new Map<number, number>();
  pages.forEach((page) => page.usedGlyphs.forEach((codeUnit, glyphId) => {
    if (!usedGlyphs.has(glyphId)) usedGlyphs.set(glyphId, codeUnit);
  }));
  const glyphWidths = buildGlyphWidths([...usedGlyphs.keys()]);

  objects.push(Buffer.from("<< /Type /Catalog /Pages 2 0 R >>"));
  objects.push(Buffer.alloc(0));
  objects.push(Buffer.from(`<< /Type /Font /Subtype /Type0 /BaseFont /${PDF_BASE_FONT} /Encoding /Identity-H /DescendantFonts [4 0 R] /ToUnicode 7 0 R >>`));
  objects.push(Buffer.from(`<< /Type /Font /Subtype /CIDFontType2 /BaseFont /${PDF_BASE_FONT} /CIDSystemInfo << /Registry (Adobe) /Ordering (Identity) /Supplement 0 >> /FontDescriptor 5 0 R /CIDToGIDMap /Identity /DW 560${glyphWidths ? ` /W [${glyphWidths}]` : ""} >>`));
  objects.push(Buffer.from(`<< /Type /FontDescriptor /FontName /${PDF_BASE_FONT} /Flags 4 /FontBBox [-400 -300 1400 1100] /ItalicAngle 0 /Ascent 950 /Descent -250 /CapHeight 720 /StemV 80 /FontFile2 6 0 R >>`));
  objects.push(streamObject(EMBEDDED_FONT, `/Length1 ${EMBEDDED_FONT.length}`));
  objects.push(streamObject(buildToUnicodeCMap(usedGlyphs)));

  for (const page of pages) {
    const pageId = objects.length + 1;
    pageObjectIds.push(pageId);
    objects.push(Buffer.alloc(0));

    const contentId = objects.length + 1;
    contentObjectIds.push(contentId);
    objects.push(streamObject(page.commands.join("\n")));
  }

  objects[1] = Buffer.from(`<< /Type /Pages /Kids [${pageObjectIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageObjectIds.length} >>`);
  pageObjectIds.forEach((pageId, index) => {
    objects[pageId - 1] = Buffer.from(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /${PDF_FONT} 3 0 R >> >> /Contents ${contentObjectIds[index]} 0 R >>`);
  });

  const chunks: Buffer[] = [Buffer.from("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n", "binary")];
  const offsets = [0];
  let position = chunks[0].length;
  objects.forEach((object, index) => {
    offsets.push(position);
    const chunk = Buffer.concat([Buffer.from(`${index + 1} 0 obj\n`), object, Buffer.from("\nendobj\n")]);
    chunks.push(chunk);
    position += chunk.length;
  });

  const xrefOffset = position;
  let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let index = 1; index <= objects.length; index += 1) {
    xref += `${String(offsets[index]).padStart(10, "0")} 00000 n \n`;
  }
  xref += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  chunks.push(Buffer.from(xref));
  return Buffer.concat(chunks);
}

export async function generatePaymentDocumentPdf(order: PaymentDocumentOrder) {
  const itemsPerPage = 7;
  const pages = Math.max(1, Math.ceil(order.items.length / itemsPerPage));
  const pdfPages: PdfPage[] = [];

  for (let page = 0; page < pages; page += 1) {
    const start = page * itemsPerPage;
    pdfPages.push(createPaymentDocumentPage(order, order.items.slice(start, start + itemsPerPage), page, pages, start));
  }

  return pagesToPdf(pdfPages);
}
