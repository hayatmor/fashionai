import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const PUBLIC_DIR = path.join(process.cwd(), "public", "color-books");
const DATA_DIR = path.join(process.cwd(), "data", "color-books");

function safeSeasonId(id: string): string {
  if (!id || typeof id !== "string") return "";
  return id.replace(/[^a-zA-Z0-9_-]/g, "");
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ seasonId: string }> }
) {
  const seasonId = safeSeasonId((await params).seasonId);
  if (!seasonId) return NextResponse.json({ error: "Missing season id" }, { status: 400 });

  const noCache = { "Cache-Control": "no-store, max-age=0" };
  try {
    const dataFile = path.join(DATA_DIR, `${seasonId}.json`);
    const publicFile = path.join(PUBLIC_DIR, `${seasonId}.json`);
    if (fs.existsSync(dataFile)) {
      const raw = fs.readFileSync(dataFile, "utf-8");
      return NextResponse.json(JSON.parse(raw), { headers: noCache });
    }
    if (fs.existsSync(publicFile)) {
      const raw = fs.readFileSync(publicFile, "utf-8");
      return NextResponse.json(JSON.parse(raw), { headers: noCache });
    }
    return NextResponse.json({ error: "Season not found" }, { status: 404 });
  } catch (e) {
    console.error("color-books get season", e);
    return NextResponse.json({ error: "Failed to load season" }, { status: 500 });
  }
}
