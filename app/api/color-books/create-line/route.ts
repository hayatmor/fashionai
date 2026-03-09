import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const PUBLIC_DIR = path.join(process.cwd(), "public", "color-books");
const DATA_DIR = path.join(process.cwd(), "data", "color-books");

function safeSeasonId(id: string): string {
  if (!id || typeof id !== "string") return "";
  return id.replace(/[^a-zA-Z0-9_-]/g, "");
}

interface ColorInput {
  code: string;
  name: string;
  imageBase64: string;
}

interface Body {
  seasonId: string;
  seasonName?: string;
  lineId: string;
  lineName: string;
  colors: ColorInput[];
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Body;
    const { seasonId: rawSeasonId, seasonName, lineId, lineName, colors } = body;
    const seasonId = safeSeasonId(rawSeasonId || "");
    if (!seasonId) {
      return NextResponse.json({ error: "seasonId is required" }, { status: 400 });
    }
    if (!lineId?.trim() || !lineName?.trim()) {
      return NextResponse.json({ error: "lineId and lineName are required" }, { status: 400 });
    }
    if (!Array.isArray(colors) || colors.length === 0) {
      return NextResponse.json({ error: "At least one color (code, name, imageBase64) is required" }, { status: 400 });
    }

    const normalizedColors = colors.map((c) => ({
      code: String(c.code || "").trim(),
      name: String(c.name || "").trim(),
      imageBase64: typeof c.imageBase64 === "string" ? c.imageBase64 : "",
    }));

    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    const publicFile = path.join(PUBLIC_DIR, `${seasonId}.json`);
    const dataFile = path.join(DATA_DIR, `${seasonId}.json`);

    let season: { id: string; name: string; season?: string; lines: Array<{ id: string; name: string; colors: unknown[] }> };
    if (fs.existsSync(dataFile)) {
      const raw = fs.readFileSync(dataFile, "utf-8");
      season = JSON.parse(raw);
    } else if (fs.existsSync(publicFile)) {
      const raw = fs.readFileSync(publicFile, "utf-8");
      season = JSON.parse(raw);
    } else {
      season = {
        id: seasonId,
        name: seasonName || seasonId.replace(/([A-Z])/g, " $1").trim(),
        season: seasonName || seasonId,
        lines: [],
      };
    }

    const newLine = {
      id: lineId.trim(),
      name: lineName.trim(),
      colors: normalizedColors.map((c) => ({
        code: c.code,
        name: c.name,
        imageBase64: c.imageBase64 || undefined,
        hex: undefined,
      })),
    };

    const existingIndex = season.lines.findIndex(
      (l) => l.id.toUpperCase() === newLine.id.toUpperCase()
    );
    if (existingIndex >= 0) {
      season.lines[existingIndex] = newLine;
    } else {
      season.lines.push(newLine);
    }

    fs.writeFileSync(dataFile, JSON.stringify(season, null, 2), "utf-8");

    const manifestPath = path.join(DATA_DIR, "manifest.json");
    let manifest: string[] = [];
    if (fs.existsSync(manifestPath)) {
      manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
    }
    if (!manifest.includes(seasonId)) {
      manifest.push(seasonId);
      manifest.sort();
      fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), "utf-8");
    }

    return NextResponse.json({ ok: true, seasonId, lineId: newLine.id });
  } catch (e) {
    console.error("create-line", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to save line" },
      { status: 500 }
    );
  }
}
