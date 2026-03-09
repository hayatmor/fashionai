#!/usr/bin/env python3
"""
Color Book Builder
==================
Builds/updates colors.json from folders of swatch images.

Directory structure expected:
    swatches/
      LINE_81/
        Col.01-White.jpg
        Col.03-Beige.jpg
        Col.51-Pink.jpg
        ...
      LINE_01/
        Col.80-Navy.jpg
        Col.90-Black.jpg
      LINE_17/
        Col.01-White.jpg
        Col.190-White_Black.jpg
        ...

Image naming: Col.{code}-{Name}.{jpg|png}
  - Code: the numeric part after "Col." (e.g. "01", "03", "190")
  - Name: display name, underscores become slashes (e.g. "White_Black" → "White/Black")

Folder naming: LINE_{number} (e.g. LINE_81, LINE_01)
  - You can also add the leather name: LINE_81_FRANCIA_LEATHER/

Usage:
    python build_color_book.py --swatches ./swatches --name "FRANCIA LEATHER" --line "LINE 81"
    python build_color_book.py --swatches ./swatches   (auto-detect all lines)
"""

import argparse
import json
import re
import sys
from pathlib import Path


SCRIPT_DIR = Path(__file__).resolve().parent
DEFAULT_COLORS_JSON = SCRIPT_DIR / "colors.json"
SUPPORTED_EXTS = {".jpg", ".jpeg", ".png", ".webp", ".tiff"}


def parse_swatch_filename(filename: str) -> dict | None:
    """
    Parse a swatch image filename like 'Col.03-Beige.jpg'.
    Returns { "code": "Col.03", "name": "Beige", "code_num": "03" } or None.
    """
    stem = Path(filename).stem
    # Match: Col.{digits}-{Name} or Col.{digits} {Name} or Col.{digits}_{Name}
    m = re.match(r"^Col\.(\d+)\s*[-_ ]\s*(.+)$", stem, re.I)
    if m:
        code_num = m.group(1)
        raw_name = m.group(2).strip()
        display_name = raw_name.replace("_", "/").replace("-", "/")
        return {
            "code": f"Col.{code_num}",
            "code_num": code_num,
            "name": display_name,
        }

    # Fallback: just Col.{digits}
    m2 = re.match(r"^Col\.(\d+)$", stem, re.I)
    if m2:
        return {
            "code": f"Col.{m2.group(1)}",
            "code_num": m2.group(1),
            "name": "",
        }

    return None


def parse_line_folder_name(folder_name: str) -> tuple[str, str]:
    """
    Parse a line folder name like 'LINE_81' or 'LINE_81_FRANCIA_LEATHER'.
    Returns (line_id, leather_name).
    """
    folder_name = folder_name.strip()
    m = re.match(r"^LINE[_ ]?(\d+)(?:[_ ](.+))?$", folder_name, re.I)
    if m:
        num = m.group(1)
        name = m.group(2) or ""
        name = name.replace("_", " ").strip()
        return f"LINE {num}", name
    return folder_name, ""


def scan_line_folder(folder: Path) -> list[dict]:
    """Scan a single line folder for swatch images."""
    colors = []
    for f in sorted(folder.iterdir()):
        if f.suffix.lower() not in SUPPORTED_EXTS:
            continue
        parsed = parse_swatch_filename(f.name)
        if parsed:
            parsed["image"] = str(f.resolve())
            colors.append(parsed)
        else:
            print(f"    SKIP: Cannot parse '{f.name}' — expected Col.XX-Name.ext format")

    # Sort by numeric code
    colors.sort(key=lambda c: int(c["code_num"]))
    return colors


def build_from_directory(swatches_dir: Path, existing: dict | None = None) -> dict:
    """
    Scan all LINE_* subfolders and build the color book dict.
    Merges with existing data if provided (preserves leather names etc).
    """
    existing_lines = existing.get("lines", {}) if existing else {}
    result_lines = dict(existing_lines)

    for d in sorted(swatches_dir.iterdir()):
        if not d.is_dir():
            continue
        line_id, leather_name = parse_line_folder_name(d.name)
        if not line_id.startswith("LINE"):
            continue

        colors = scan_line_folder(d)
        if not colors:
            print(f"  SKIP: No valid swatch images in {d.name}/")
            continue

        # Preserve existing leather name if not provided by folder name
        prev = existing_lines.get(line_id, {})
        if not leather_name and prev.get("name"):
            leather_name = prev["name"]

        result_lines[line_id] = {
            "name": leather_name,
            "colors": [
                {
                    "code": c["code"],
                    "name": c["name"],
                    "image": c["image"],
                }
                for c in colors
            ],
        }
        print(f"  ✓ {line_id} ({leather_name or '—'}): {len(colors)} swatches")

    return result_lines


def build_single_line(
    swatches_dir: Path,
    line_id: str,
    leather_name: str,
    existing: dict | None = None,
) -> dict:
    """Build a single line from a flat folder of swatch images."""
    existing_lines = existing.get("lines", {}) if existing else {}
    result_lines = dict(existing_lines)

    colors = scan_line_folder(swatches_dir)
    if not colors:
        print(f"  ERROR: No valid swatch images found in {swatches_dir}")
        sys.exit(1)

    result_lines[line_id] = {
        "name": leather_name,
        "colors": [
            {
                "code": c["code"],
                "name": c["name"],
                "image": c["image"],
            }
            for c in colors
        ],
    }
    print(f"  ✓ {line_id} ({leather_name}): {len(colors)} swatches")
    return result_lines


def main():
    parser = argparse.ArgumentParser(description="Build color book from swatch images")
    parser.add_argument(
        "--swatches", "-s",
        required=True,
        help=(
            "Path to swatches. If --line is given, this is a flat folder of Col.XX-Name images. "
            "Otherwise, this should contain LINE_XX subfolders."
        ),
    )
    parser.add_argument(
        "--line", "-l",
        default=None,
        help="Line ID (e.g. 'LINE 81'). If given, --swatches is treated as a flat folder for this line.",
    )
    parser.add_argument(
        "--name", "-n",
        default="",
        help="Leather name (e.g. 'FRANCIA LEATHER'). Used with --line.",
    )
    parser.add_argument(
        "--output", "-o",
        default=str(DEFAULT_COLORS_JSON),
        help="Output colors.json path (default: catalog-generator/colors.json)",
    )
    parser.add_argument(
        "--season",
        default="Fall Winter 2026",
        help="Season name (default: 'Fall Winter 2026')",
    )

    args = parser.parse_args()
    sw_dir = Path(args.swatches)
    if not sw_dir.is_dir():
        print(f"ERROR: '{args.swatches}' is not a directory")
        sys.exit(1)

    out = Path(args.output)

    # Load existing if it exists
    existing = None
    if out.exists():
        existing = json.loads(out.read_text(encoding="utf-8"))
        print(f"  Loaded existing colors.json ({len(existing.get('lines', {}))} lines)")

    print(f"\n  Scanning swatches in: {sw_dir}\n")

    if args.line:
        line_id = args.line.upper()
        if not line_id.startswith("LINE"):
            line_id = f"LINE {line_id}"
        lines = build_single_line(sw_dir, line_id, args.name, existing)
    else:
        lines = build_from_directory(sw_dir, existing)

    result = {
        "season": args.season,
        "lines": lines,
    }

    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(result, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"\n  Saved → {out}")
    print(f"  Total lines: {len(lines)}")
    for lid, ldata in sorted(lines.items()):
        print(f"    {lid}: {ldata['name']} ({len(ldata['colors'])} colors)")


if __name__ == "__main__":
    main()
