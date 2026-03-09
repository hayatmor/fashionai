import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";

export const maxDuration = 30;

// A4 portrait at 150 DPI: 1240 x 1754
const PAGE_W = 1240;
const PAGE_H = 1754;
const PADDING = 60;
const HEADER_H = 80;
const CELL_GAP = 40;
const TEXT_BLOCK_H = 52;
const SWATCH_H = 120;

const SWATCH_COLORS = [
  { r: 255, g: 255, b: 255 },
  { r: 210, g: 180, b: 140 },
  { r: 255, g: 192, b: 203 },
  { r: 139, g: 90, b: 43 },
  { r: 139, g: 133, b: 120 },
  { r: 178, g: 34, b: 34 },
  { r: 100, g: 149, b: 237 },
  { r: 128, g: 128, b: 128 },
  { r: 0, g: 0, b: 128 },
  { r: 0, g: 0, b: 0 },
];

function escapeXml(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function createProductTextSvg(
  page: string,
  article: string,
  size: string,
  price: string,
  width: number,
  height: number
): Buffer {
  const pageArticle = [page, article].filter(Boolean).length
    ? escapeXml(`${page || ""}-${article || ""}`.replace(/^-|-$/g, "").trim() || "—")
    : "—";
  const s = escapeXml(size || "—");
  const p = escapeXml(price || "—");
  const svg = `
<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <text x="0" y="18" font-family="Helvetica, Arial, sans-serif" font-size="14" font-weight="600" fill="#1a1a1a">${pageArticle}</text>
  <text x="0" y="34" font-family="Helvetica, Arial, sans-serif" font-size="12" fill="#666">${s}</text>
  <text x="0" y="50" font-family="Helvetica, Arial, sans-serif" font-size="14" font-weight="600" fill="#1a1a1a">${p}</text>
</svg>`;
  return Buffer.from(svg.trim());
}

function createLineTitleSvg(title: string, width: number): Buffer {
  const t = escapeXml(title);
  const svg = `
<svg width="${width}" height="36" xmlns="http://www.w3.org/2000/svg">
  <text x="0" y="24" font-family="Helvetica, Arial, sans-serif" font-size="16" font-weight="600" fill="#1a1a1a">${t}</text>
</svg>`;
  return Buffer.from(svg.trim());
}

function createSwatchBuffer(color: { r: number; g: number; b: number }, size: number): Promise<Buffer> {
  return sharp({
    create: {
      width: size,
      height: size,
      channels: 3,
      background: color,
    },
  })
    .jpeg({ quality: 90 })
    .toBuffer();
}

interface ProductDataItem {
  page?: string;
  article?: string;
  size?: string;
  price?: string;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      images,
      productData,
      lineTitle,
      textImages,
      lineTitleImage,
    } = body as {
      images: Array<{ base64: string; mimeType?: string }>;
      productData?: ProductDataItem[];
      lineTitle?: string;
      textImages?: string[];
      lineTitleImage?: string;
    };

    const count = Array.isArray(images) ? images.length : 0;
    if (count !== 1 && count !== 2 && count !== 4) {
      return NextResponse.json({ error: "Send 1, 2, or 4 images" }, { status: 400 });
    }

    const contentW = PAGE_W - 2 * PADDING;
    const contentH = PAGE_H - 2 * PADDING - HEADER_H - SWATCH_H;

    let cellW: number;
    let cellH: number;
    let across: number;
    let rows: number;

    if (count === 1) {
      across = 1;
      rows = 1;
      cellW = contentW;
      cellH = contentH - TEXT_BLOCK_H - 10;
    } else if (count === 2) {
      across = 2;
      rows = 1;
      cellW = (contentW - CELL_GAP) / 2;
      cellH = contentH - TEXT_BLOCK_H - 10;
    } else {
      across = 2;
      rows = 2;
      cellW = (contentW - CELL_GAP) / 2;
      cellH = (contentH - CELL_GAP - 2 * (TEXT_BLOCK_H + 10)) / 2;
    }

    const resizedBuffers = await Promise.all(
      images.map(async (img) => {
        const buf = Buffer.from(img.base64, "base64");
        return sharp(buf)
          .resize(Math.round(cellW), Math.round(cellH), {
            fit: "contain",
            background: { r: 255, g: 255, b: 255 },
          })
          .png()
          .toBuffer();
      })
    );

    let gridBuffer: Buffer;
    if (count === 1) {
      gridBuffer = resizedBuffers[0]!;
    } else {
      gridBuffer = await sharp(resizedBuffers, {
        join: { across, shim: CELL_GAP },
      })
        .png()
        .toBuffer();
    }

    const gridMeta = await sharp(gridBuffer).metadata();
    const gridW = gridMeta.width ?? contentW;
    const gridH = gridMeta.height ?? rows * cellH + (rows - 1) * CELL_GAP;
    const gridLeft = PADDING + (contentW - gridW) / 2;
    const gridTop = PADDING + HEADER_H;

    const composites: Array<{ input: Buffer; left: number; top: number }> = [
      { input: gridBuffer, left: Math.round(gridLeft), top: Math.round(gridTop) },
    ];

    const data = Array.isArray(productData) ? productData.slice(0, count) : [];
    const useClientTexts = Array.isArray(textImages) && textImages.length === count;
    if (useClientTexts || data.length > 0) {
      for (let i = 0; i < count; i++) {
        const col = i % across;
        const row = Math.floor(i / across);
        const textLeft = gridLeft + col * (cellW + CELL_GAP);
        const textTop = gridTop + row * (cellH + CELL_GAP) + cellH + 10;
        let textBuffer: Buffer;
        if (useClientTexts && textImages![i]) {
          const raw = Buffer.from(textImages![i], "base64");
          textBuffer = await sharp(raw)
            .resize(Math.round(cellW), TEXT_BLOCK_H, { fit: "contain", background: { r: 255, g: 255, b: 255 } })
            .png()
            .toBuffer();
        } else if (data[i]) {
          const item = data[i]!;
          const textSvg = createProductTextSvg(
            item.page ?? "",
            item.article ?? "",
            item.size ?? "",
            item.price ?? "",
            Math.round(cellW),
            TEXT_BLOCK_H
          );
          textBuffer = await sharp(textSvg).png().toBuffer();
        } else {
          continue;
        }
        composites.push({ input: textBuffer, left: Math.round(textLeft), top: Math.round(textTop) });
      }
    }

    const swatchSize = 60;
    const swatchGap = 8;
    const swatchesRowW = 5 * swatchSize + 4 * swatchGap;
    const swatchesRowH = 2 * swatchSize + swatchGap;

    const swatchBuffers = await Promise.all(
      SWATCH_COLORS.map((c) => createSwatchBuffer(c, swatchSize))
    );

    const row1 = await sharp(swatchBuffers.slice(0, 5), {
      join: { across: 5, shim: swatchGap },
    })
      .png()
      .toBuffer();
    const row2 = await sharp(swatchBuffers.slice(5, 10), {
      join: { across: 5, shim: swatchGap },
    })
      .png()
      .toBuffer();

    const swatchesStacked = await sharp([row1, row2], {
      join: { across: 1, shim: swatchGap },
    })
      .png()
      .toBuffer();

    const swatchesMeta = await sharp(swatchesStacked).metadata();
    const swatchesW = swatchesMeta.width ?? swatchesRowW;
    const swatchesH = swatchesMeta.height ?? swatchesRowH;
    const swatchesLeft = PADDING + (contentW - swatchesW) / 2;

    if (lineTitleImage) {
      const titleBuffer = await sharp(Buffer.from(lineTitleImage, "base64"))
        .resize(Math.round(contentW), 36, { fit: "contain", background: { r: 255, g: 255, b: 255 } })
        .png()
        .toBuffer();
      const titleTop = PAGE_H - PADDING - SWATCH_H - 44;
      composites.push({ input: titleBuffer, left: PADDING, top: titleTop });
    } else if (lineTitle && String(lineTitle).trim()) {
      const titleSvg = createLineTitleSvg(String(lineTitle).trim(), Math.round(contentW));
      const titleBuffer = await sharp(titleSvg).png().toBuffer();
      const titleTop = PAGE_H - PADDING - SWATCH_H - 44;
      composites.push({ input: titleBuffer, left: PADDING, top: titleTop });
    }

    const swatchesTop = PAGE_H - PADDING - SWATCH_H + 36;
    composites.push({
      input: swatchesStacked,
      left: Math.round(swatchesLeft),
      top: Math.round(swatchesTop),
    });

    const base = sharp({
      create: {
        width: PAGE_W,
        height: PAGE_H,
        channels: 3,
        background: { r: 255, g: 255, b: 255 },
      },
    });

    const composed = await base
      .composite(composites)
      .jpeg({ quality: 95 })
      .toBuffer();

    return NextResponse.json({
      image: composed.toString("base64"),
      mimeType: "image/jpeg",
      text: "",
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Catalog compose failed";
    console.error("Catalog compose error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
