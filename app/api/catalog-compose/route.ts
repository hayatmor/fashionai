import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";

export const maxDuration = 30;

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "20mb",
    },
  },
};

// A4 portrait at 150 DPI: 1240 x 1754
const PAGE_W = 1240;
const PAGE_H = 1754;
const PADDING = 60;
const HEADER_H = 100;
const CELL_GAP = 40;
const TEXT_SPACE = 50;
const SWATCH_H = 100;

// Leather swatch colors (White, Beige, Pink, Cuoio, Taupe, Red, Bluette, Grey, Navy, Black)
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

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { images } = body as { images: Array<{ base64: string; mimeType?: string }> };

    if (!Array.isArray(images) || images.length !== 4) {
      return NextResponse.json(
        { error: "Exactly 4 images required" },
        { status: 400 },
      );
    }

    const cellW = (PAGE_W - 2 * PADDING - CELL_GAP) / 2;
    const cellH = (PAGE_H - 2 * PADDING - HEADER_H - TEXT_SPACE * 2 - SWATCH_H - CELL_GAP) / 2;

    // Resize each product image to fit cell (contain, preserve aspect)
    const resizedBuffers = await Promise.all(
      images.map(async (img) => {
        const buf = Buffer.from(img.base64, "base64");
        return sharp(buf)
          .resize(Math.round(cellW), Math.round(cellH), { fit: "contain", background: { r: 255, g: 255, b: 255 } })
          .png()
          .toBuffer();
      }),
    );

    // Create 2x2 product grid using sharp join
    const gridBuffer = await sharp(resizedBuffers, {
      join: { across: 2, shim: CELL_GAP },
    })
      .png()
      .toBuffer();

    const gridMeta = await sharp(gridBuffer).metadata();
    const gridW = gridMeta.width ?? PAGE_W - 2 * PADDING;
    const gridH = gridMeta.height ?? cellH * 2 + CELL_GAP;

    const gridLeft = PADDING + (PAGE_W - 2 * PADDING - gridW) / 2;
    const gridTop = PADDING + HEADER_H;

    // Create swatches row (2 rows x 5 cols)
    const swatchSize = 60;
    const swatchGap = 8;
    const swatchesRowW = 5 * swatchSize + 4 * swatchGap;
    const swatchesRowH = 2 * swatchSize + swatchGap;

    const swatchBuffers = await Promise.all(
      SWATCH_COLORS.map((c) => createSwatchBuffer(c, swatchSize)),
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
    const swatchesLeft = PADDING + (PAGE_W - 2 * PADDING - swatchesW) / 2;
    const swatchesTop = PAGE_H - PADDING - SWATCH_H + (SWATCH_H - swatchesH) / 2;

    // Create white base canvas and composite everything
    const base = sharp({
      create: {
        width: PAGE_W,
        height: PAGE_H,
        channels: 3,
        background: { r: 255, g: 255, b: 255 },
      },
    });

    const composed = await base
      .composite([
        { input: gridBuffer, left: Math.round(gridLeft), top: Math.round(gridTop) },
        { input: swatchesStacked, left: Math.round(swatchesLeft), top: Math.round(swatchesTop) },
      ])
      .jpeg({ quality: 95 })
      .toBuffer();

    const base64 = composed.toString("base64");

    return NextResponse.json({
      image: base64,
      mimeType: "image/jpeg",
      text: "",
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Catalog compose failed";
    console.error("Catalog compose error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
