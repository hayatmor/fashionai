#!/usr/bin/env python3
"""
Renato Angi Catalog Generator
==============================
Generates high-end A4 product catalog pages from product images + CSV data.

Usage:
    python generate_catalog.py --images ./images --csv "CATALOGO 2026 MOR.csv" --output ./output

Image naming convention: {page}-{article}.jpg  (e.g. 1-3600981.jpg)

The script groups images by page number, looks up product info in the CSV,
matches the Color Book line from colors.json, and renders each page using
Jinja2 + WeasyPrint.
"""

import argparse
import base64
import csv
import io
import json
import os
import re
import sys
import tempfile
from collections import defaultdict
from pathlib import Path

from jinja2 import Environment, FileSystemLoader
from weasyprint import HTML


SCRIPT_DIR = Path(__file__).resolve().parent
DEFAULT_COLORS = SCRIPT_DIR / "colors.json"
DEFAULT_TEMPLATE = SCRIPT_DIR / "templates" / "catalog_page.html"
DEFAULT_LOGO = SCRIPT_DIR / "logo.png"


def to_file_uri(path_str: str) -> str:
    """Convert an absolute filesystem path to a file:// URI for WeasyPrint."""
    return Path(path_str).resolve().as_uri()


# ---------------------------------------------------------------------------
# CSV Parsing (handles the single-line / multi-line quirks of this catalog)
# ---------------------------------------------------------------------------

def parse_catalog_csv(csv_path: str) -> list[dict]:
    """
    Parse the Renato Angi catalog data from CSV or XLSX.

    Supports:
      - .xlsx (Excel) files via openpyxl
      - .csv files (single-line or multi-line with repeating headers)
    Fields: Page, Article, Size, Price, Color Book, Notes
    """
    p = Path(csv_path)

    if p.suffix.lower() in (".xlsx", ".xls"):
        return _parse_xlsx(p)
    return _parse_csv(p)


def _parse_xlsx(xlsx_path: Path) -> list[dict]:
    """Parse product data from an Excel workbook."""
    import openpyxl
    wb = openpyxl.load_workbook(str(xlsx_path), read_only=True, data_only=True)
    rows: list[dict] = []

    for ws in wb.worksheets:
        for row in ws.iter_rows(values_only=True):
            cells = [str(c).strip() if c is not None else "" for c in row]
            if len(cells) < 5:
                continue
            page_raw = cells[0]
            if not page_raw or page_raw.lower() == "page":
                continue
            # Must be a numeric page
            try:
                int(page_raw)
            except ValueError:
                continue

            article = cells[1]
            size = cells[2]
            price = cells[3]
            color_book = cells[4]
            notes = cells[5] if len(cells) > 5 else ""

            if not article:
                continue

            rows.append({
                "page": page_raw,
                "article": article,
                "size": format_size(size),
                "price": format_price(price),
                "color_book": normalise_line_id(color_book),
                "notes": notes,
            })

    wb.close()
    print(f"  Parsed {len(rows)} product rows from XLSX")
    return rows


def _parse_csv(csv_path: Path) -> list[dict]:
    """Parse product data from a CSV file (handles single-line quirks)."""
    raw = csv_path.read_text(encoding="utf-8-sig")
    chunks = re.split(r"Page,Article,Size,Price,Color ?Book,*", raw)

    rows: list[dict] = []
    for chunk in chunks:
        chunk = chunk.strip().strip(",")
        if not chunk:
            continue
        reader = csv.reader(io.StringIO(chunk))
        flat = []
        for csv_row in reader:
            flat.extend(csv_row)

        FIELDS_PER_ROW = 8
        for i in range(0, len(flat), FIELDS_PER_ROW):
            group = flat[i : i + FIELDS_PER_ROW]
            if len(group) < 5:
                continue
            page_raw = group[0].strip()
            article = group[1].strip()
            size = group[2].strip()
            price = group[3].strip()
            color_book = group[4].strip()
            notes = group[5].strip() if len(group) > 5 else ""

            if not page_raw or not article:
                continue
            if page_raw.lower() == "page":
                continue

            rows.append({
                "page": page_raw,
                "article": article,
                "size": format_size(size),
                "price": format_price(price),
                "color_book": normalise_line_id(color_book),
                "notes": notes,
            })

    print(f"  Parsed {len(rows)} product rows from CSV")
    return rows


def format_size(raw: str) -> str:
    """Normalise size string for display: H 40 cm, L 37 cm, W 10 cm."""
    raw = raw.strip()
    m = re.match(r"H\s*(\S+)\s*-\s*L\s*(\S+)\s*-\s*W\s*(\S+)\s*(CM)?", raw, re.I)
    if not m:
        return raw
    h, l, w = m.group(1), m.group(2), m.group(3)
    # normalise comma decimals
    h = h.replace(",", ",")
    l = l.replace(",", ",")
    w = w.replace(",", ",")
    return f"H {h} cm, L {l} cm, W {w} cm"


def format_price(raw: str) -> str:
    """Normalise price to € X,00 format."""
    raw = raw.strip()
    if raw.startswith("€"):
        return raw
    # Try to parse as number
    try:
        val = float(raw.replace(",", "."))
        cents = int(round(val * 100))
        euros = cents // 100
        remainder = cents % 100
        return f"€ {euros},{remainder:02d}"
    except (ValueError, TypeError):
        pass
    return raw


def normalise_line_id(raw: str) -> str:
    """Normalise 'LINE81' / 'LINE 81' → 'LINE 81'."""
    raw = raw.strip().upper()
    m = re.match(r"LINE\s*(\d+)", raw)
    return f"LINE {m.group(1)}" if m else raw


# ---------------------------------------------------------------------------
# Color Book
# ---------------------------------------------------------------------------

def load_color_book(json_path: str, swatches_dir: str | None = None) -> dict:
    """
    Load color book from JSON. Supports two formats:

    1. App format (data/color-books/{seasonId}.json): "lines" is an array of
       { "id", "name", "colors": [ { "code", "name", "hex?", "imageBase64?" } ] }.
       When imageBase64 is present, it is written to a temp file and used as image_path.

    2. Standalone format (colors.json): "lines" is a dict keyed by line id.
       Image resolution: "image" path, then swatches/LINE_XX/ files, then hex fallback.
    """
    json_p = Path(json_path)
    data = json.loads(json_p.read_text(encoding="utf-8"))
    raw_lines = data.get("lines", {})

    # App format: lines is a list
    if isinstance(raw_lines, list):
        lines = {}
        for line_obj in raw_lines:
            lid = line_obj.get("id", "").strip()
            if not lid:
                continue
            lines[lid] = {
                "name": line_obj.get("name", ""),
                "colors": list(line_obj.get("colors", [])),
            }
        _resolve_app_format_colors(lines, json_p.parent)
        return lines

    lines = dict(raw_lines)
    sw = Path(swatches_dir) if swatches_dir else None

    for line_id, line_data in lines.items():
        line_folder_name = line_id.replace(" ", "_")
        line_sw_dir = sw / line_folder_name if sw else None

        for color in line_data.get("colors", []):
            # imageBase64 (app-created lines)
            b64 = color.get("imageBase64", "")
            if b64:
                path_uri = _base64_to_temp_file(b64)
                if path_uri:
                    color["image_path"] = path_uri
                    continue

            img = color.get("image", "")
            if img and Path(img).is_file():
                color["image_path"] = to_file_uri(img)
                continue

            if img and (json_p.parent / img).is_file():
                color["image_path"] = to_file_uri(str(json_p.parent / img))
                continue

            code = color["code"]
            name = color.get("name", "").replace("/", "_")

            if line_sw_dir and line_sw_dir.is_dir():
                found = _find_swatch_file(line_sw_dir, code, name)
                if found:
                    color["image_path"] = to_file_uri(str(found))
                    continue

            if sw and sw.is_dir():
                found = _find_swatch_file(sw, code, name)
                if found:
                    color["image_path"] = to_file_uri(str(found))

    return lines


# Temp dir for base64 swatch images (app format); created on first use
_color_book_temp_dir: Path | None = None


def _get_color_book_temp_dir() -> Path:
    global _color_book_temp_dir
    if _color_book_temp_dir is None:
        _color_book_temp_dir = Path(tempfile.mkdtemp(prefix="catalog_swatches_"))
    return _color_book_temp_dir


def _base64_to_temp_file(b64: str, suffix: str = ".png") -> str | None:
    """Decode base64 image to a temp file and return its file:// URI."""
    try:
        raw = base64.b64decode(b64)
    except Exception:
        return None
    d = _get_color_book_temp_dir()
    path = d / f"{os.urandom(8).hex()}{suffix}"
    path.write_bytes(raw)
    return to_file_uri(str(path))


def _resolve_app_format_colors(lines: dict, _json_parent: Path) -> None:
    """For app-format lines (list converted to dict), resolve imageBase64 to temp file URIs."""
    for line_data in lines.values():
        for color in line_data.get("colors", []):
            b64 = color.get("imageBase64", "")
            if b64:
                path_uri = _base64_to_temp_file(b64)
                if path_uri:
                    color["image_path"] = path_uri
            if "hex" not in color:
                color["hex"] = "#cccccc"


def _find_swatch_file(directory: Path, code: str, name: str) -> Path | None:
    """Find a swatch image matching Col.XX-Name.ext or Col.XX.ext in directory."""
    for ext in ("jpg", "jpeg", "png", "webp"):
        if name:
            candidate = directory / f"{code}-{name}.{ext}"
            if candidate.exists():
                return candidate
        candidate = directory / f"{code}.{ext}"
        if candidate.exists():
            return candidate
    # Glob fallback: anything starting with the code
    for f in directory.glob(f"{code}*"):
        if f.suffix.lower() in {".jpg", ".jpeg", ".png", ".webp"}:
            return f
    return None


def get_line_info(lines: dict, line_id: str) -> dict | None:
    """Return line display data for the template."""
    line_data = lines.get(line_id)
    if not line_data:
        return None

    num = re.search(r"\d+", line_id)
    display = f"Line  {num.group()}  {line_data['name']}" if num else line_id

    return {
        "display_title": display,
        "colors": line_data["colors"],
    }


# ---------------------------------------------------------------------------
# Image Discovery & Grouping
# ---------------------------------------------------------------------------

def discover_images(images_dir: str) -> dict[str, list[dict]]:
    """
    Scan a directory for images named {page}-{article}.ext
    Returns dict grouped by page number.
    """
    groups: dict[str, list[dict]] = defaultdict(list)
    supported = {".jpg", ".jpeg", ".png", ".webp", ".tiff"}

    img_dir = Path(images_dir)
    if not img_dir.is_dir():
        print(f"  ERROR: Images directory not found: {images_dir}")
        return groups

    for f in sorted(img_dir.iterdir()):
        if f.suffix.lower() not in supported:
            continue
        stem = f.stem
        m = re.match(r"^(\d+)-(\d+)$", stem)
        if m:
            page_num = m.group(1)
            article = m.group(2)
            groups[page_num].append({
                "page": page_num,
                "article": article,
                "image_path": str(f.resolve()),
                "filename": f.name,
            })

    print(f"  Found {sum(len(v) for v in groups.values())} images across {len(groups)} pages")
    return groups


# ---------------------------------------------------------------------------
# Build page data for template
# ---------------------------------------------------------------------------

def build_pages(
    image_groups: dict[str, list[dict]],
    csv_rows: list[dict],
    color_lines: dict,
    logo_path: str | None = None,
) -> tuple[list[dict], list[dict]]:
    """
    Match CSV rows → images → color lines, return template-ready page list.

    The CSV defines the canonical order: products appear on each page in
    exactly the sequence listed in the spreadsheet.

    Returns (pages, missing) where missing is a list of CSV rows with no image.
    """
    img_lookup: dict[tuple[str, str], dict] = {}
    for page_num, imgs in image_groups.items():
        for img in imgs:
            img_lookup[(page_num, img["article"])] = img

    csv_by_page: dict[str, list[dict]] = defaultdict(list)
    for row in csv_rows:
        csv_by_page[row["page"]].append(row)

    pages = []
    missing: list[dict] = []

    for page_num in sorted(csv_by_page.keys(), key=lambda x: int(x)):
        csv_page_rows = csv_by_page[page_num]
        products = []
        line_id = None

        for row in csv_page_rows:
            img = img_lookup.get((row["page"], row["article"]))
            if not img:
                missing.append(row)
                continue
            products.append({
                "image_path": to_file_uri(img["image_path"]),
                "article": row["article"],
                "size": row.get("size", ""),
                "price": row.get("price", ""),
            })
            if not line_id and row.get("color_book"):
                line_id = row["color_book"]

        if not products:
            continue

        line_info = get_line_info(color_lines, line_id) if line_id else None

        pages.append({
            "page_num": page_num,
            "products": products,
            "line": line_info,
            "category": None,
        })

    print(f"  Built {len(pages)} catalog pages")
    if missing:
        print(f"  ⚠ {len(missing)} products missing images")
    return pages, missing


# ---------------------------------------------------------------------------
# Render
# ---------------------------------------------------------------------------

def render_catalog(
    pages: list[dict],
    output_path: str,
    template_path: str | None = None,
    logo_path: str | None = None,
    output_format: str = "pdf",
    show_price: bool = True,
):
    """Render pages to PDF or PNG using WeasyPrint + PyMuPDF."""
    tmpl_path = Path(template_path or DEFAULT_TEMPLATE)
    env = Environment(loader=FileSystemLoader(str(tmpl_path.parent)))
    template = env.get_template(tmpl_path.name)

    logo_uri = None
    if logo_path and Path(logo_path).exists():
        logo_uri = Path(logo_path).resolve().as_uri()

    html_str = template.render(pages=pages, logo_path=logo_uri, show_price=show_price)
    html_obj = HTML(string=html_str, base_url=str(SCRIPT_DIR))

    out = Path(output_path)
    out.parent.mkdir(parents=True, exist_ok=True)

    pdf_bytes = html_obj.write_pdf()

    if output_format == "pdf":
        out.write_bytes(pdf_bytes)
        print(f"  PDF saved → {out}")
    else:
        import pymupdf
        doc = pymupdf.open(stream=pdf_bytes, filetype="pdf")
        dpi = 200
        for i, page in enumerate(doc):
            mat = pymupdf.Matrix(dpi / 72, dpi / 72)
            pix = page.get_pixmap(matrix=mat, alpha=False)
            if output_format == "png" and len(doc) == 1:
                page_path = out
            else:
                page_path = out.parent / f"{out.stem}_page{i+1}.png"
            pix.save(str(page_path))
            print(f"  PNG saved → {page_path}")
        doc.close()

    html_debug = out.parent / f"{out.stem}_debug.html"
    html_debug.write_text(html_str, encoding="utf-8")
    print(f"  Debug HTML → {html_debug}")


# ---------------------------------------------------------------------------
# Missing Products Report
# ---------------------------------------------------------------------------

def _write_missing_report(
    missing: list[dict],
    csv_rows: list[dict],
    image_groups: dict[str, list[dict]],
    report_path: Path,
):
    """Write a text report listing products with no image and images with no CSV match."""
    lines: list[str] = []
    lines.append("=" * 65)
    lines.append("  MISSING PRODUCTS REPORT")
    lines.append("  Expected image filename format: {page}-{article}.jpg")
    lines.append("=" * 65)
    lines.append("")

    # Build sets of CSV articles per page
    csv_articles_by_page: dict[str, list[str]] = defaultdict(list)
    csv_count_by_page: dict[str, int] = defaultdict(int)
    for row in csv_rows:
        csv_articles_by_page[row["page"]].append(row["article"])
        csv_count_by_page[row["page"]] += 1

    # Build sets of image articles per page
    img_articles_by_page: dict[str, set[str]] = defaultdict(set)
    img_filenames_by_page: dict[str, list[str]] = defaultdict(list)
    for page_num, imgs in image_groups.items():
        for img in imgs:
            img_articles_by_page[page_num].add(img["article"])
            img_filenames_by_page[page_num].append(img["filename"])

    # Find unmatched images (images with no CSV row)
    unmatched_by_page: dict[str, list[str]] = defaultdict(list)
    for page_num, imgs in image_groups.items():
        csv_set = set(csv_articles_by_page.get(page_num, []))
        for img in imgs:
            if img["article"] not in csv_set:
                unmatched_by_page[page_num].append(img["filename"])

    # Group missing by page
    missing_by_page: dict[str, list[dict]] = defaultdict(list)
    for row in missing:
        missing_by_page[row["page"]].append(row)

    if not missing and not any(unmatched_by_page.values()):
        lines.append("  ✓ All products have matching images. Nothing missing!")
        lines.append("")
    else:
        if missing:
            lines.append(f"  Total CSV products missing images: {len(missing)}")
        total_unmatched = sum(len(v) for v in unmatched_by_page.values())
        if total_unmatched:
            lines.append(f"  Total image files with no CSV match: {total_unmatched}")
        lines.append("")

        # Collect all pages that have issues
        all_pages = sorted(
            set(list(missing_by_page.keys()) + list(unmatched_by_page.keys())),
            key=lambda x: int(x),
        )

        for page_num in all_pages:
            page_missing = missing_by_page.get(page_num, [])
            page_unmatched = unmatched_by_page.get(page_num, [])
            total_in_csv = csv_count_by_page.get(page_num, 0)
            found = total_in_csv - len(page_missing)

            lines.append(f"  Page {page_num}  ({found}/{total_in_csv} images matched)")
            lines.append(f"  {'─' * 55}")

            for row in page_missing:
                expected = f"{row['page']}-{row['article']}.jpg"
                lines.append(
                    f"    ✗ MISSING  Article {row['article']:>7}  |  "
                    f"{row.get('price', ''):>10}  |  "
                    f"Need: {expected}"
                )

            for fname in page_unmatched:
                lines.append(
                    f"    ? EXTRA    {fname:>25}  |  "
                    f"Image exists but no CSV match — typo?"
                )

            # Suggest possible renames when a missing article looks similar to an extra
            if page_missing and page_unmatched:
                lines.append("")
                lines.append(f"    💡 Possible fixes:")
                extra_arts = {f.split("-", 1)[1].rsplit(".", 1)[0]: f for f in page_unmatched if "-" in f}
                for row in page_missing:
                    target = row["article"]
                    for extra_art, extra_fname in extra_arts.items():
                        if _is_similar(target, extra_art):
                            correct = f"{row['page']}-{target}{Path(extra_fname).suffix}"
                            lines.append(
                                f"       Rename '{extra_fname}' → '{correct}'"
                            )

            lines.append("")

    lines.append("=" * 65)

    report_path.write_text("\n".join(lines), encoding="utf-8")
    if missing:
        print(f"  ⚠ Missing report → {report_path}")
    else:
        print(f"  ✓ Missing report → {report_path} (all found)")


def _is_similar(a: str, b: str) -> bool:
    """Check if two article numbers are likely typos of each other (same digits, different order)."""
    if a == b:
        return False
    if len(a) != len(b):
        return False
    # Same digits in different order
    if sorted(a) == sorted(b):
        return True
    # Differ by only 1-2 characters
    diffs = sum(1 for x, y in zip(a, b) if x != y)
    return diffs <= 2


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(
        description="Generate Renato Angi catalog pages from images + CSV"
    )
    parser.add_argument(
        "--images", "-i",
        required=True,
        help="Directory containing product images named {page}-{article}.jpg",
    )
    parser.add_argument(
        "--csv", "-c",
        required=True,
        help="Path to catalog data file (.csv or .xlsx)",
    )
    parser.add_argument(
        "--colors",
        default=str(DEFAULT_COLORS),
        help="Path to color book JSON (default: catalog-generator/colors.json). Can also be app data, e.g. ../data/color-books/FallWinter2026.json",
    )
    parser.add_argument(
        "--swatches",
        default=str(SCRIPT_DIR / "swatches"),
        help="Directory with swatch images named Col.XX.jpg (optional)",
    )
    parser.add_argument(
        "--logo",
        default=str(DEFAULT_LOGO) if DEFAULT_LOGO.exists() else None,
        help="Path to brand logo image (default: logo.png in script dir)",
    )
    parser.add_argument(
        "--output", "-o",
        default=str(SCRIPT_DIR / "output" / "catalog.pdf"),
        help="Output file path (.pdf or .png)",
    )
    parser.add_argument(
        "--format", "-f",
        choices=["pdf", "png", "png-multi"],
        default="pdf",
        help="Output format: pdf (default), png (single image), png-multi (one per page)",
    )
    parser.add_argument(
        "--pages",
        default=None,
        help="Comma-separated page numbers to generate (e.g. '1,2,3'). Default: all.",
    )
    parser.add_argument(
        "--no-price",
        action="store_true",
        help="Generate catalog without price on product blocks.",
    )

    args = parser.parse_args()

    print("\n╔══════════════════════════════════════════╗")
    print("║   Renato Angi — Catalog Generator        ║")
    print("╚══════════════════════════════════════════╝\n")

    print("[1/5] Parsing CSV...")
    csv_rows = parse_catalog_csv(args.csv)

    print("[2/5] Loading color book...")
    color_lines = load_color_book(args.colors, args.swatches)
    print(f"  Loaded {len(color_lines)} color lines")

    print("[3/5] Discovering images...")
    image_groups = discover_images(args.images)

    if args.pages:
        filter_pages = set(p.strip() for p in args.pages.split(","))
        image_groups = {k: v for k, v in image_groups.items() if k in filter_pages}
        print(f"  Filtered to pages: {', '.join(sorted(filter_pages, key=int))}")

    if not image_groups:
        print("\n  No matching images found. Check naming: {page}-{article}.jpg")
        sys.exit(1)

    print("[4/5] Building page layouts...")
    pages, missing = build_pages(image_groups, csv_rows, color_lines, args.logo)

    print("[5/5] Rendering catalog...")
    fmt = "png-multi" if args.format == "png-multi" else args.format
    show_price = not args.no_price
    if fmt == "png-multi":
        render_catalog(pages, args.output, logo_path=args.logo, output_format="png-multi", show_price=show_price)
    else:
        render_catalog(pages, args.output, logo_path=args.logo, output_format=fmt, show_price=show_price)

    # Write missing products report
    out = Path(args.output)
    report_path = out.parent / f"{out.stem}_missing.txt"
    _write_missing_report(missing, csv_rows, image_groups, report_path)

    print("\n✓ Done!\n")


if __name__ == "__main__":
    main()
