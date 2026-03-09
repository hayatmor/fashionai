"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Upload, FileSpreadsheet, BookOpen, Sparkles, Loader2, Download, XCircle } from "lucide-react";
import Link from "next/link";

const COLOR_BOOKS_API = "/api/color-books";

export interface ColorSwatch {
  code: string;
  name: string;
  hex?: string;
  imageBase64?: string;
}

export interface ColorLine {
  id: string;
  name: string;
  colors: ColorSwatch[];
}

/** Season = Color Book (e.g. Fall Winter 2026). Contains multiple lines (LINE 81, LINE 82, …). */
export interface ColorBook {
  id: string;
  name: string;
  season?: string;
  lines: ColorLine[];
}

export interface CatalogRow {
  page: string;
  article: string;
  size: string;
  price: string;
  colorBook: string;
}

function parseCSV(text: string): CatalogRow[] {
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
  const get = (values: string[], ...names: string[]) => {
    for (const name of names) {
      const i = headers.indexOf(name);
      if (i >= 0 && values[i] !== undefined) return values[i].trim();
    }
    return "";
  };
  const rows: CatalogRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(",").map((v) => v.replace(/^"|"$/g, "").trim());
    rows.push({
      page: get(values, "page"),
      article: get(values, "article"),
      size: get(values, "size"),
      price: get(values, "price"),
      colorBook: get(values, "color book", "colorbook", "line"),
    });
  }
  return rows;
}

export default function CatalogBuilderPage() {
  const [colorBookIds, setColorBookIds] = useState<string[]>([]);
  const [selectedColorBookId, setSelectedColorBookId] = useState<string>("");
  const [colorBook, setColorBook] = useState<ColorBook | null>(null);
  const [csvRows, setCsvRows] = useState<CatalogRow[]>([]);
  const [productImages, setProductImages] = useState<(File | null)[]>([null, null, null, null]);
  const [previewUrls, setPreviewUrls] = useState<(string | null)[]>([null, null, null, null]);
  const [imagesPerPage, setImagesPerPage] = useState<1 | 2 | 4>(4);
  const [hidePrice, setHidePrice] = useState(false);
  const [generateStatus, setGenerateStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [generatedDataUrl, setGeneratedDataUrl] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${COLOR_BOOKS_API}/manifest`)
      .then((r) => r.json())
      .then((ids: string[]) => {
        setColorBookIds(ids);
        if (ids.length > 0 && !selectedColorBookId) setSelectedColorBookId(ids[0]);
      })
      .catch(() => setColorBookIds([]));
  }, [selectedColorBookId]);

  useEffect(() => {
    if (!selectedColorBookId) {
      setColorBook(null);
      return;
    }
    fetch(`${COLOR_BOOKS_API}/${selectedColorBookId}`)
      .then((r) => r.json())
      .then(setColorBook)
      .catch(() => setColorBook(null));
  }, [selectedColorBookId]);

  const handleCSV = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = reader.result as string;
      setCsvRows(parseCSV(text));
    };
    reader.readAsText(file);
    e.target.value = "";
  }, []);

  const setProductImage = useCallback((index: number, file: File | null) => {
    setProductImages((prev) => {
      const next = [...prev];
      next[index] = file;
      return next;
    });
    setPreviewUrls((prev) => {
      const next = [...prev];
      if (prev[index]) URL.revokeObjectURL(prev[index]!);
      next[index] = file ? URL.createObjectURL(file) : null;
      return next;
    });
  }, []);

  const catalogProducts = csvRows.slice(0, 4);
  /** Line of color for this page: from first product's Color Book column (e.g. LINE 81, LINE 82). */
  const lineForPage = colorBook && catalogProducts[0]?.colorBook
    ? colorBook.lines?.find((l) => l.id.toUpperCase() === catalogProducts[0].colorBook.toUpperCase().trim())
    : null;
  const hasData = catalogProducts.length > 0 && colorBook && productImages.some(Boolean);

  const requiredImages = productImages.slice(0, imagesPerPage);
  const hasRequiredImages = requiredImages.every((f): f is File => f !== null);

  const loadImageFromFile = (file: File): Promise<HTMLImageElement> =>
    new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
      img.onerror = reject;
      img.src = url;
    });

  const handleGenerate = useCallback(async () => {
    if (!hasRequiredImages) return;
    setGenerateStatus("loading");
    setGenerateError(null);
    setGeneratedDataUrl(null);

    try {
      const PAGE_W = 1240;
      const PAGE_H = 1754;
      const PAD = 60;
      const HEADER_H = 110;
      const CELL_GAP = 30;
      const TEXT_H = 80;
      const SWATCH_AREA_H = 180;

      const canvas = document.createElement("canvas");
      canvas.width = PAGE_W;
      canvas.height = PAGE_H;
      const ctx = canvas.getContext("2d")!;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, PAGE_W, PAGE_H);

      // --- HEADER ---
      ctx.textAlign = "center";
      ctx.fillStyle = "#1a1a1a";
      ctx.font = "italic 600 28px Georgia, 'Times New Roman', serif";
      ctx.fillText("RENATO ANGI", PAGE_W / 2, PAD + 36);
      ctx.font = "14px Helvetica, Arial, sans-serif";
      ctx.fillStyle = "#666";
      ctx.fillText("VENEZIA", PAGE_W / 2, PAD + 56);
      ctx.textAlign = "left";

      // --- PRODUCT GRID ---
      const count = imagesPerPage;
      const contentW = PAGE_W - 2 * PAD;
      const gridTop = PAD + HEADER_H;
      const gridAvailH = PAGE_H - PAD - HEADER_H - SWATCH_AREA_H - PAD;

      let across: number, rows: number;
      if (count === 1) { across = 1; rows = 1; }
      else if (count === 2) { across = 2; rows = 1; }
      else { across = 2; rows = 2; }

      const cellW = (contentW - (across - 1) * CELL_GAP) / across;
      const cellH = (gridAvailH - (rows - 1) * CELL_GAP - rows * TEXT_H) / rows;

      const files = requiredImages as File[];
      const imgs = await Promise.all(files.map(loadImageFromFile));
      const data = catalogProducts.slice(0, count);

      for (let i = 0; i < count; i++) {
        const col = i % across;
        const row = Math.floor(i / across);
        const x = PAD + col * (cellW + CELL_GAP);
        const y = gridTop + row * (cellH + TEXT_H + CELL_GAP);

        // Draw product image (fit contain)
        const img = imgs[i];
        if (img) {
          const scale = Math.min(cellW / img.width, cellH / img.height);
          const dw = img.width * scale;
          const dh = img.height * scale;
          const dx = x + (cellW - dw) / 2;
          const dy = y + (cellH - dh) / 2;
          ctx.drawImage(img, dx, dy, dw, dh);
        }

        // Draw product text below image
        const csvRow = data[i];
        if (csvRow) {
          const textX = x + cellW / 2;
          let textY = y + cellH + 20;
          ctx.textAlign = "center";

          // Article line (bold)
          ctx.fillStyle = "#1a1a1a";
          ctx.font = "bold 18px Helvetica, Arial, sans-serif";
          ctx.fillText(`Article ${csvRow.article || "—"}`, textX, textY);
          textY += 22;

          // Size line
          ctx.fillStyle = "#555";
          ctx.font = "14px Helvetica, Arial, sans-serif";
          ctx.fillText(csvRow.size || "—", textX, textY);
          textY += 22;

          // Price line (bold) — skip when hidePrice
          if (!hidePrice) {
            ctx.fillStyle = "#1a1a1a";
            ctx.font = "bold 16px Helvetica, Arial, sans-serif";
            ctx.fillText(csvRow.price || "—", textX, textY);
          }

          ctx.textAlign = "left";
        }
      }

      // --- LINE TITLE ---
      const swatchTop = PAGE_H - PAD - SWATCH_AREA_H;
      if (lineForPage) {
        ctx.fillStyle = "#1a1a1a";
        ctx.font = "600 16px Helvetica, Arial, sans-serif";
        ctx.fillText(`${lineForPage.id}  ${lineForPage.name}`, PAD, swatchTop + 16);
      }

      // --- COLOR SWATCHES ---
      if (lineForPage) {
        const colors = lineForPage.colors;
        const swatchSize = 64;
        const swatchGap = 12;
        const colsPerRow = 5;
        const swatchStartY = swatchTop + 36;

        const loadSwatchImg = (b64: string): Promise<HTMLImageElement> =>
          new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = reject;
            img.src = `data:image/png;base64,${b64}`;
          });

        const swatchImgs = await Promise.all(
          colors.map((c) => (c.imageBase64 ? loadSwatchImg(c.imageBase64) : Promise.resolve(null)))
        );

        for (let ci = 0; ci < colors.length; ci++) {
          const sCol = ci % colsPerRow;
          const sRow = Math.floor(ci / colsPerRow);
          const sx = PAD + sCol * (swatchSize + swatchGap + 40);
          const sy = swatchStartY + sRow * (swatchSize + 36);
          const c = colors[ci];

          if (swatchImgs[ci]) {
            ctx.drawImage(swatchImgs[ci]!, sx, sy, swatchSize, swatchSize);
          } else if (c.hex) {
            ctx.fillStyle = c.hex;
            ctx.fillRect(sx, sy, swatchSize, swatchSize);
          }
          ctx.strokeStyle = "#ccc";
          ctx.lineWidth = 1;
          ctx.strokeRect(sx, sy, swatchSize, swatchSize);

          ctx.textAlign = "center";
          ctx.fillStyle = "#1a1a1a";
          ctx.font = "bold 11px Helvetica, Arial, sans-serif";
          ctx.fillText(c.code || "", sx + swatchSize / 2, sy + swatchSize + 14);
          ctx.fillStyle = "#666";
          ctx.font = "11px Helvetica, Arial, sans-serif";
          ctx.fillText(c.name || "", sx + swatchSize / 2, sy + swatchSize + 28);
          ctx.textAlign = "left";
        }
      }

      const dataUrl = canvas.toDataURL("image/jpeg", 0.95);
      setGeneratedDataUrl(dataUrl);
      setGenerateStatus("success");
    } catch (err: unknown) {
      setGenerateError(err instanceof Error ? err.message : "Generation failed");
      setGenerateStatus("error");
    }
  }, [hasRequiredImages, requiredImages, catalogProducts, imagesPerPage, lineForPage, hidePrice]);

  const handleDownloadCatalog = useCallback(() => {
    if (!generatedDataUrl) return;
    const link = document.createElement("a");
    link.href = generatedDataUrl;
    link.download = "catalog-a4-page.jpg";
    link.click();
  }, [generatedDataUrl]);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 flex items-center justify-between border-b border-border/60 bg-white/80 px-6 py-4 backdrop-blur-md md:px-16">
        <Link href="/" className="font-serif text-xl tracking-wide text-charcoal md:text-2xl">
          Fashion AI
        </Link>
        <nav className="flex items-center gap-6">
          <Link href="/" className="text-sm tracking-widest uppercase text-muted transition-colors hover:text-charcoal">
            Gallery
          </Link>
          <Link href="/ecommerce-batch" className="text-sm tracking-widest uppercase text-muted transition-colors hover:text-charcoal">
            Batch Studio
          </Link>
          <Link href="/catalog-builder" className="text-sm font-medium tracking-widest uppercase text-charcoal">
            Catalog
          </Link>
          <Link href="/color-book-creator" className="text-sm tracking-widest uppercase text-muted transition-colors hover:text-charcoal">
            Color Book
          </Link>
          <Link href="/heif-to-jpeg" className="text-sm tracking-widest uppercase text-muted transition-colors hover:text-charcoal">
            HEIF → JPEG
          </Link>
          <Link href="/vega-io" className="text-sm tracking-widest uppercase text-muted transition-colors hover:text-charcoal">
            Vega.IO Style
          </Link>
          <a href="/presentation.html" className="text-sm tracking-widest uppercase text-muted transition-colors hover:text-charcoal">
            Presentation
          </a>
        </nav>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-10 md:px-8">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="mb-10">
          <h1 className="font-serif text-3xl tracking-tight text-charcoal md:text-4xl">
            Catalog Builder
          </h1>
          <p className="mt-2 text-muted">
            Upload CSV with product data (Page, Article, Size, Price, Color Book) and 4 product images.
            Select a Color Book (season) — saved in the system — to show swatches on the catalog page.
          </p>
        </motion.div>

        <div className="space-y-8">
          {/* Color Book (season) selector — static, saved in folder. Each season has multiple lines. */}
          <section className="rounded-2xl border border-border bg-white p-6 shadow-sm">
            <h2 className="mb-4 flex items-center gap-2 font-serif text-xl text-charcoal">
              <BookOpen size={20} />
              Color Book (season)
            </h2>
            <p className="mb-3 text-sm text-muted">
              Color books are saved per season (e.g. Fall Winter 2026). Each season has multiple lines (LINE 81, LINE 82, LINE 10…). In your CSV, the &quot;Color Book&quot; column selects which line applies to each page.
            </p>
            <select
              value={selectedColorBookId}
              onChange={(e) => setSelectedColorBookId(e.target.value)}
              className="w-full max-w-xs rounded-lg border border-border bg-white px-4 py-2.5 text-charcoal focus:border-charcoal focus:outline-none"
            >
              {colorBookIds.length === 0 && (
                <option value="">No color books found</option>
              )}
              {colorBookIds.map((id) => (
                <option key={id} value={id}>
                  {id.replace(/([A-Z])/g, " $1").trim()}
                </option>
              ))}
            </select>
            {colorBook?.lines && (
              <div className="mt-4">
                <p className="mb-2 text-xs font-medium text-muted">Lines in this season</p>
                <div className="flex flex-wrap gap-2">
                  {colorBook.lines.map((line) => (
                    <span
                      key={line.id}
                      className="rounded-md border border-border bg-offwhite px-3 py-1.5 text-sm text-charcoal"
                    >
                      {line.id} {line.name}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </section>

          {/* CSV upload */}
          <section className="rounded-2xl border border-border bg-white p-6 shadow-sm">
            <h2 className="mb-4 flex items-center gap-2 font-serif text-xl text-charcoal">
              <FileSpreadsheet size={20} />
              Product data (CSV)
            </h2>
            <p className="mb-3 text-sm text-muted">
              CSV columns: Page, Article, Size, Price, Color Book (or Line). Color Book = which line of color for that page (e.g. LINE 81, LINE 82, LINE 10). First 4 rows are used for the catalog grid.
            </p>
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-border bg-offwhite px-4 py-2.5 text-sm font-medium text-charcoal hover:bg-white">
              <Upload size={16} />
              Choose CSV
              <input type="file" accept=".csv,text/csv" onChange={handleCSV} className="hidden" />
            </label>
            {csvRows.length > 0 && (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[400px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="pb-2 pr-4 font-medium text-charcoal">Page</th>
                      <th className="pb-2 pr-4 font-medium text-charcoal">Article</th>
                      <th className="pb-2 pr-4 font-medium text-charcoal">Size</th>
                      <th className="pb-2 pr-4 font-medium text-charcoal">Price</th>
                      <th className="pb-2 font-medium text-charcoal">Color Book</th>
                    </tr>
                  </thead>
                  <tbody>
                    {csvRows.slice(0, 4).map((row, i) => (
                      <tr key={i} className="border-b border-border/60">
                        <td className="py-2 pr-4 text-muted">{row.page}</td>
                        <td className="py-2 pr-4 font-medium">{row.article}</td>
                        <td className="py-2 pr-4 text-muted">{row.size}</td>
                        <td className="py-2 pr-4">{row.price}</td>
                        <td className="py-2 text-muted">{row.colorBook}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* Product images */}
          <section className="rounded-2xl border border-border bg-white p-6 shadow-sm">
            <div className="mb-4 flex flex-wrap items-center gap-4">
              <h2 className="font-serif text-xl text-charcoal">Product images</h2>
              <label className="flex items-center gap-2 text-sm text-charcoal">
                <input
                  type="checkbox"
                  checked={hidePrice}
                  onChange={(e) => setHidePrice(e.target.checked)}
                  className="rounded border-border"
                />
                <span>Generate without price</span>
              </label>
              <label className="flex items-center gap-2 text-sm text-charcoal">
                <span className="text-muted">Images per page:</span>
                <select
                  value={imagesPerPage}
                  onChange={(e) => setImagesPerPage(Number(e.target.value) as 1 | 2 | 4)}
                  className="rounded-lg border border-border bg-white px-3 py-1.5 text-charcoal focus:border-charcoal focus:outline-none"
                >
                  <option value={1}>1</option>
                  <option value={2}>2</option>
                  <option value={4}>4</option>
                </select>
              </label>
            </div>
            <p className="mb-4 text-sm text-muted">
              Upload {imagesPerPage} image{imagesPerPage > 1 ? "s" : ""} for this catalog page. Use slot{imagesPerPage > 1 ? "s" : ""} 1{imagesPerPage >= 2 ? "–" + imagesPerPage : ""}.
            </p>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              {[0, 1, 2, 3].map((i) => (
                <label
                  key={i}
                  className="flex min-h-[140px] cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-border bg-offwhite transition-colors hover:border-charcoal/30"
                >
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => setProductImage(i, e.target.files?.[0] ?? null)}
                  />
                  {previewUrls[i] ? (
                    <div className="relative h-full w-full p-2">
                      <img src={previewUrls[i]!} alt={`Product ${i + 1}`} className="max-h-28 w-full object-contain" />
                      <span className="mt-1 block text-center text-xs text-muted">Slot {i + 1}</span>
                    </div>
                  ) : (
                    <>
                      <Upload size={24} className="text-muted" />
                      <span className="mt-2 text-xs text-muted">
                      Slot {i + 1}{i >= imagesPerPage ? " (optional)" : ""}
                    </span>
                    </>
                  )}
                </label>
              ))}
            </div>
            {hasRequiredImages && (
              <div className="mt-6 flex flex-wrap items-center gap-4">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleGenerate}
                  disabled={generateStatus === "loading"}
                  className="flex items-center gap-2 rounded-lg bg-charcoal px-5 py-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {generateStatus === "loading" ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : (
                    <Sparkles size={18} />
                  )}
                  {generateStatus === "loading" ? "Generating A4 page…" : "Generate A4 catalog page"}
                </motion.button>
                <p className="text-xs text-muted">
                  Composes your {imagesPerPage} photo{imagesPerPage > 1 ? "s" : ""} into one A4-size catalog page with color swatches.
                </p>
              </div>
            )}
            {generateStatus === "error" && generateError && (
              <div className="mt-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                <XCircle size={18} className="mt-0.5 shrink-0" />
                <span>{generateError}</span>
              </div>
            )}
            {generateStatus === "success" && generatedDataUrl && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-6 flex flex-col gap-3 rounded-xl border border-border bg-offwhite p-4"
              >
                <p className="text-sm font-medium text-charcoal">Generated A4 catalog page</p>
                <div className="overflow-hidden rounded-lg border border-border">
                  <img
                    src={generatedDataUrl}
                    alt="Catalog A4 page"
                    className="w-full object-contain"
                  />
                </div>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleDownloadCatalog}
                  className="flex items-center justify-center gap-2 rounded-lg border border-border bg-white py-2.5 text-sm font-medium text-charcoal hover:bg-offwhite"
                >
                  <Download size={16} />
                  Download A4 catalog page
                </motion.button>
              </motion.div>
            )}
          </section>

          {/* Catalog preview */}
          {hasData && (
            <motion.section
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl border border-border bg-white p-6 shadow-sm"
            >
              <h2 className="mb-4 font-serif text-xl text-charcoal">Catalog page preview</h2>
              <div className="rounded-xl border border-border bg-white p-6 md:p-8">
                <div className="mb-6 text-center">
                  <p className="font-serif text-lg font-medium text-charcoal">RENATO ANGI</p>
                  <p className="text-sm text-muted">Catalog — {colorBook?.name ?? selectedColorBookId}</p>
                </div>
                {catalogProducts.some((p) => p.colorBook) && (
                  <p className="mb-4 text-xs text-muted">
                    Line for this page (from first row): <strong>{catalogProducts[0]?.colorBook ?? "—"}</strong>
                  </p>
                )}
                <div className="grid grid-cols-2 gap-6 md:gap-8">
                  {[0, 1, 2, 3].map((i) => (
                    <div key={i} className="flex flex-col">
                      <div className="aspect-square overflow-hidden rounded-lg border border-border bg-offwhite">
                        {previewUrls[i] ? (
                          <img src={previewUrls[i]!} alt="" className="h-full w-full object-contain" />
                        ) : (
                          <div className="flex h-full items-center justify-center text-muted">No image</div>
                        )}
                      </div>
                      <div className="mt-3 space-y-1 text-sm">
                        <p className="font-medium text-charcoal">
                          Article {catalogProducts[i]?.article ?? "—"}
                        </p>
                        <p className="text-muted">{catalogProducts[i]?.size ?? "—"}</p>
                        {!hidePrice && (
                          <p className="font-medium text-charcoal">{catalogProducts[i]?.price ?? "—"}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                {lineForPage && (
                  <div className="mt-8 border-t border-border pt-6">
                    <p className="mb-3 font-medium text-charcoal">
                      {lineForPage.id} {lineForPage.name}
                    </p>
                    <div className="grid grid-cols-5 gap-3 md:grid-cols-10">
                      {lineForPage.colors.map((c) => (
                        <div key={c.code} className="flex flex-col items-center">
                          <div
                            className="h-12 w-full overflow-hidden rounded border border-border bg-offwhite"
                            style={c.imageBase64 ? undefined : { backgroundColor: c.hex ?? "#eee" }}
                          >
                            {c.imageBase64 ? (
                              <img
                                src={`data:image/png;base64,${c.imageBase64}`}
                                alt={c.name}
                                className="h-full w-full object-cover"
                              />
                            ) : null}
                          </div>
                          <p className="mt-1 text-xs font-medium text-charcoal">{c.code}</p>
                          <p className="text-xs text-muted">{c.name}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {colorBook && catalogProducts[0]?.colorBook && !lineForPage && (
                  <div className="mt-8 border-t border-border pt-6 text-sm text-amber-700">
                    No line &quot;{catalogProducts[0].colorBook}&quot; in this season. Available: {colorBook.lines?.map((l) => l.id).join(", ") ?? "—"}
                  </div>
                )}
              </div>
            </motion.section>
          )}
        </div>
      </main>
    </div>
  );
}
