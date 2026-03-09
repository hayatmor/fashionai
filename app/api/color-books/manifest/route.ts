import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const PUBLIC_DIR = path.join(process.cwd(), "public", "color-books");
const DATA_DIR = path.join(process.cwd(), "data", "color-books");

function readManifest(dir: string): string[] {
  const file = path.join(dir, "manifest.json");
  if (!fs.existsSync(file)) return [];
  try {
    const raw = fs.readFileSync(file, "utf-8");
    const ids = JSON.parse(raw) as string[];
    return Array.isArray(ids) ? ids : [];
  } catch {
    return [];
  }
}

export async function GET() {
  try {
    const fromData = fs.existsSync(DATA_DIR) ? readManifest(DATA_DIR) : [];
    const fromPublic = fs.existsSync(PUBLIC_DIR) ? readManifest(PUBLIC_DIR) : [];
    const merged = [...new Set([...fromData, ...fromPublic])].sort();
    return NextResponse.json(merged);
  } catch (e) {
    console.error("color-books manifest", e);
    return NextResponse.json([], { status: 200 });
  }
}
