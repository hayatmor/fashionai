"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Upload, X, BookOpen, Loader2, CheckCircle2, XCircle, ImagePlus, Trash2 } from "lucide-react";
import Link from "next/link";

/** Parse "Col.03-Beige" or "Col.03-Beige.jpg" -> { code: "Col.03", name: "Beige" } */
function parseSwatchFilename(name: string): { code: string; name: string } {
  const base = name.replace(/\.[^.]+$/, "").trim();
  const dash = base.indexOf("-");
  if (dash <= 0) return { code: base || "Col.00", name: base || "Swatch" };
  return {
    code: base.slice(0, dash).trim(),
    name: base.slice(dash + 1).trim().replace(/-/g, " ") || "Swatch",
  };
}

interface SwatchFile {
  file: File;
  id: string;
  previewUrl: string;
  code: string;
  name: string;
}

/** Drawn swatch region (percent 0–100 of image dimensions) */
interface BoardRect {
  id: string;
  xPct: number;
  yPct: number;
  wPct: number;
  hPct: number;
  code: string;
  name: string;
}

const MAX_CROP_PX = 400;
const PREVIEW_THUMB_SIZE = 120;

/** Crop rect from board file to a data URL for preview (smaller size). */
async function getRectPreviewDataUrl(
  boardFile: File | null,
  r: BoardRect,
  maxSize: number = PREVIEW_THUMB_SIZE
): Promise<string | null> {
  if (!boardFile) return null;
  const imgEl = new Image();
  await new Promise<void>((resolve, reject) => {
    imgEl.onload = () => resolve();
    imgEl.onerror = reject;
    imgEl.src = URL.createObjectURL(boardFile);
  });
  const nw = imgEl.naturalWidth;
  const nh = imgEl.naturalHeight;
  const sx = (r.xPct / 100) * nw;
  const sy = (r.yPct / 100) * nh;
  const sw = (r.wPct / 100) * nw;
  const sh = (r.hPct / 100) * nh;
  let dw = sw;
  let dh = sh;
  if (Math.max(sw, sh) > maxSize) {
    const scale = maxSize / Math.max(sw, sh);
    dw = Math.round(sw * scale);
    dh = Math.round(sh * scale);
  }
  const canvas = document.createElement("canvas");
  canvas.width = dw;
  canvas.height = dh;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    URL.revokeObjectURL(imgEl.src);
    return null;
  }
  ctx.drawImage(imgEl, sx, sy, sw, sh, 0, 0, dw, dh);
  URL.revokeObjectURL(imgEl.src);
  return canvas.toDataURL("image/jpeg", 0.85);
}

/** Thumbnail that shows the exact crop for one rect so user can verify selection. */
function RectPreviewThumb({ boardFile, rect }: { boardFile: File | null; rect: BoardRect }) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setDataUrl(null);
    getRectPreviewDataUrl(boardFile, rect)
      .then((url) => {
        if (!cancelled) {
          setDataUrl(url);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [boardFile, rect.id, rect.xPct, rect.yPct, rect.wPct, rect.hPct]);
  return (
    <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg border-2 border-border bg-muted/30">
      {loading ? (
        <div className="flex h-full w-full items-center justify-center text-xs text-muted">…</div>
      ) : dataUrl ? (
        <img src={dataUrl} alt="" className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-xs text-muted">—</div>
      )}
    </div>
  );
}

export default function ColorBookCreatorPage() {
  const [mode, setMode] = useState<"files" | "board">("files");

  const [swatches, setSwatches] = useState<SwatchFile[]>([]);
  const [lineId, setLineId] = useState("");
  const [lineName, setLineName] = useState("");
  const [seasonId, setSeasonId] = useState("");
  const [newSeasonName, setNewSeasonName] = useState("");
  const [seasonOptions, setSeasonOptions] = useState<string[]>([]);
  const [useNewSeason, setUseNewSeason] = useState(false);
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [savedSeasonId, setSavedSeasonId] = useState<string | null>(null);
  const [savedLineId, setSavedLineId] = useState<string | null>(null);
  const [previewLine, setPreviewLine] = useState<{ id: string; name: string; colors: { code: string; name: string; imageBase64?: string; hex?: string }[] } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Board-photo mode state
  const [boardFile, setBoardFile] = useState<File | null>(null);
  const [boardPreviewUrl, setBoardPreviewUrl] = useState<string | null>(null);
  const [boardImageReady, setBoardImageReady] = useState(false);
  const [boardRects, setBoardRects] = useState<BoardRect[]>([]);
  const [selectedRectId, setSelectedRectId] = useState<string | null>(null);
  const [drawing, setDrawing] = useState<{ startX: number; startY: number; currentX: number; currentY: number } | null>(null);
  const boardContainerRef = useRef<HTMLDivElement>(null);
  const boardImageRef = useRef<HTMLImageElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    fetch("/api/color-books/manifest")
      .then((r) => r.json())
      .then((ids: string[]) => setSeasonOptions(ids || []))
      .catch(() => setSeasonOptions([]));
  }, []);

  useEffect(() => {
    if (status !== "success" || !savedSeasonId || !savedLineId) return;
    fetch(`/api/color-books/${savedSeasonId}`)
      .then((r) => r.json())
      .then((season: { lines?: Array<{ id: string; name: string; colors: { code: string; name: string; imageBase64?: string; hex?: string }[] }> }) => {
        const line = season?.lines?.find((l: { id: string }) => l.id === savedLineId);
        if (line) setPreviewLine({ id: line.id, name: line.name, colors: line.colors || [] });
      })
      .catch(() => setPreviewLine(null));
  }, [status, savedSeasonId, savedLineId]);

  useEffect(() => {
    return () => {
      if (boardPreviewUrl) URL.revokeObjectURL(boardPreviewUrl);
    };
  }, [boardPreviewUrl]);

  const addFiles = useCallback((newFiles: FileList | File[]) => {
    const list = Array.from(newFiles).filter((f) => f.type.startsWith("image/"));
    setSwatches((prev) => {
      const next = [...prev];
      list.forEach((file) => {
        const { code, name } = parseSwatchFilename(file.name);
        next.push({
          file,
          id: `${file.name}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          previewUrl: URL.createObjectURL(file),
          code,
          name,
        });
      });
      return next;
    });
    setStatus("idle");
    setError(null);
  }, []);

  const removeSwatch = useCallback((id: string) => {
    setSwatches((prev) => {
      const item = prev.find((s) => s.id === id);
      if (item) URL.revokeObjectURL(item.previewUrl);
      return prev.filter((s) => s.id !== id);
    });
    setStatus("idle");
  }, []);

  const fileToBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        resolve(dataUrl.split(",")[1] ?? "");
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const handleBoardFile = useCallback((file: File | null) => {
    if (boardPreviewUrl) URL.revokeObjectURL(boardPreviewUrl);
    setBoardPreviewUrl(null);
    setBoardFile(file);
    setBoardImageReady(false);
    setBoardRects([]);
    setSelectedRectId(null);
    setDrawing(null);
    if (file) setBoardPreviewUrl(URL.createObjectURL(file));
    setStatus("idle");
    setError(null);
  }, [boardPreviewUrl]);

  /** Convert image-local coords (0..width, 0..height) to percentages of image size. */
  const getDisplayToPercent = useCallback(() => {
    const img = boardImageRef.current;
    if (!img) return () => ({ xPct: 0, yPct: 0, wPct: 0, hPct: 0 });
    const rect = img.getBoundingClientRect();
    const dw = rect.width;
    const dh = rect.height;
    if (dw <= 0 || dh <= 0) return () => ({ xPct: 0, yPct: 0, wPct: 0, hPct: 0 });
    return (localX: number, localY: number, localW: number, localH: number) => ({
      xPct: (localX / dw) * 100,
      yPct: (localY / dh) * 100,
      wPct: (localW / dw) * 100,
      hPct: (localH / dh) * 100,
    });
  }, [boardPreviewUrl]);

  const getPercentToDisplay = useCallback(() => {
    const img = boardImageRef.current;
    if (!img) return (pct: number, isX: boolean) => 0;
    const rect = img.getBoundingClientRect();
    return (pct: number, isX: boolean) => (pct / 100) * (isX ? rect.width : rect.height);
  }, [boardPreviewUrl]);

  const hitTest = useCallback(
    (clientX: number, clientY: number): BoardRect | undefined => {
      const img = boardImageRef.current;
      if (!img) return undefined;
      const rect = img.getBoundingClientRect();
      const x = clientX - rect.left;
      const y = clientY - rect.top;
      for (let i = boardRects.length - 1; i >= 0; i--) {
        const r = boardRects[i];
        const rx = (r.xPct / 100) * rect.width;
        const ry = (r.yPct / 100) * rect.height;
        const rw = (r.wPct / 100) * rect.width;
        const rh = (r.hPct / 100) * rect.height;
        if (x >= rx && x <= rx + rw && y >= ry && y <= ry + rh) return r;
      }
      return undefined;
    },
    [boardRects]
  );

  const handleBoardMouseDown = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!boardPreviewUrl || !boardContainerRef.current) return;
      const img = boardImageRef.current;
      if (!img) return;
      const rect = img.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const hit = hitTest(e.clientX, e.clientY);
      if (hit) {
        setSelectedRectId(hit.id);
        setDrawing(null);
        return;
      }
      setSelectedRectId(null);
      setDrawing({ startX: x, startY: y, currentX: x, currentY: y });
    },
    [boardPreviewUrl, hitTest]
  );

  const handleBoardMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!drawing) return;
      const img = boardImageRef.current;
      if (!img) return;
      const rect = img.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      setDrawing((d) => (d ? { ...d, currentX: x, currentY: y } : null));
    },
    [drawing]
  );

  const handleBoardMouseUp = useCallback(() => {
    if (!drawing) return;
    const img = boardImageRef.current;
    if (!img) return;
    const rect = img.getBoundingClientRect();
    let x1 = drawing.startX;
    let y1 = drawing.startY;
    let x2 = drawing.currentX;
    let y2 = drawing.currentY;
    if (x1 > x2) [x1, x2] = [x2, x1];
    if (y1 > y2) [y1, y2] = [y2, y1];
    const w = x2 - x1;
    const h = y2 - y1;
    if (w < 10 || h < 10) {
      setDrawing(null);
      return;
    }
    const toPercent = getDisplayToPercent();
    const { xPct, yPct, wPct, hPct } = toPercent(x1, y1, w, h);
    const id = `rect-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setBoardRects((prev) => [...prev, { id, xPct, yPct, wPct, hPct, code: "", name: "" }]);
    setSelectedRectId(id);
    setDrawing(null);
  }, [drawing, getDisplayToPercent]);

  const updateRect = useCallback((id: string, patch: Partial<Pick<BoardRect, "code" | "name">>) => {
    setBoardRects((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }, []);

  const removeRect = useCallback((id: string) => {
    setBoardRects((prev) => prev.filter((r) => r.id !== id));
    if (selectedRectId === id) setSelectedRectId(null);
  }, [selectedRectId]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Delete" && selectedRectId) {
        removeRect(selectedRectId);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedRectId, removeRect]);

  // Redraw canvas when rects or drawing change; re-run when image has loaded so overlay is sized correctly
  useEffect(() => {
    const canvas = canvasRef.current;
    const img = boardImageRef.current;
    if (!canvas || !img || !boardPreviewUrl) return;
    const rect = img.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    canvas.style.background = "transparent";
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, rect.width, rect.height);
    boardRects.forEach((r) => {
      const x = (r.xPct / 100) * rect.width;
      const y = (r.yPct / 100) * rect.height;
      const w = (r.wPct / 100) * rect.width;
      const h = (r.hPct / 100) * rect.height;
      ctx.strokeStyle = r.id === selectedRectId ? "#1a1a1a" : "rgba(0,0,0,0.5)";
      ctx.lineWidth = r.id === selectedRectId ? 3 : 1.5;
      ctx.strokeRect(x, y, w, h);
      ctx.fillStyle = "rgba(255,255,255,0.15)";
      ctx.fillRect(x, y, w, h);
    });
    if (drawing) {
      const x = Math.min(drawing.startX, drawing.currentX);
      const y = Math.min(drawing.startY, drawing.currentY);
      const w = Math.abs(drawing.currentX - drawing.startX);
      const h = Math.abs(drawing.currentY - drawing.startY);
      ctx.strokeStyle = "#1a1a1a";
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.strokeRect(x, y, w, h);
      ctx.setLineDash([]);
    }
  }, [boardRects, selectedRectId, drawing, boardPreviewUrl, boardImageReady]);

  const cropRectToBase64 = useCallback(
    async (r: BoardRect): Promise<string> => {
      if (!boardFile) return "";
      const imgEl = new Image();
      await new Promise<void>((resolve, reject) => {
        imgEl.onload = () => resolve();
        imgEl.onerror = reject;
        imgEl.src = URL.createObjectURL(boardFile);
      });
      const nw = imgEl.naturalWidth;
      const nh = imgEl.naturalHeight;
      const sx = (r.xPct / 100) * nw;
      const sy = (r.yPct / 100) * nh;
      const sw = (r.wPct / 100) * nw;
      const sh = (r.hPct / 100) * nh;
      let dw = sw;
      let dh = sh;
      if (Math.max(sw, sh) > MAX_CROP_PX) {
        const scale = MAX_CROP_PX / Math.max(sw, sh);
        dw = Math.round(sw * scale);
        dh = Math.round(sh * scale);
      }
      const canvas = document.createElement("canvas");
      canvas.width = dw;
      canvas.height = dh;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(imgEl, sx, sy, sw, sh, 0, 0, dw, dh);
      URL.revokeObjectURL(imgEl.src);
      return canvas.toDataURL("image/jpeg", 0.9).split(",")[1] ?? "";
    },
    [boardFile]
  );

  const handleSaveFromBoard = useCallback(async () => {
    const sid = useNewSeason ? newSeasonName.trim().replace(/\s+/g, "") || "NewSeason" : seasonId;
    if (!sid) {
      setError("Select a season or enter a new season name.");
      setStatus("error");
      return;
    }
    if (!lineId.trim()) {
      setError("Enter Line ID (e.g. LINE 01).");
      setStatus("error");
      return;
    }
    if (!lineName.trim()) {
      setError("Enter Line name (e.g. VITELLO DOLLARO).");
      setStatus("error");
      return;
    }
    const labeled = boardRects.filter((r) => r.code.trim() && r.name.trim());
    if (labeled.length === 0) {
      setError("Draw at least one swatch area and set code + name for each.");
      setStatus("error");
      return;
    }

    setStatus("loading");
    setError(null);
    try {
      const colors = await Promise.all(
        labeled.map(async (r) => ({
          code: r.code.trim(),
          name: r.name.trim(),
          imageBase64: await cropRectToBase64(r),
        }))
      );
      const res = await fetch("/api/color-books/create-line", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          seasonId: sid,
          seasonName: useNewSeason ? newSeasonName.trim() : undefined,
          lineId: lineId.trim(),
          lineName: lineName.trim(),
          colors,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save");
      setSavedSeasonId(sid);
      setSavedLineId(lineId.trim());
      setPreviewLine(null);
      setStatus("success");
      if (useNewSeason && seasonOptions.indexOf(sid) === -1) {
        setSeasonOptions((prev) => [...prev, sid].sort());
        setSeasonId(sid);
        setUseNewSeason(false);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save");
      setStatus("error");
    }
  }, [
    useNewSeason,
    newSeasonName,
    seasonId,
    seasonOptions,
    lineId,
    lineName,
    boardRects,
    cropRectToBase64,
  ]);

  const handleSave = useCallback(async () => {
    if (mode === "board") {
      await handleSaveFromBoard();
      return;
    }
    const sid = useNewSeason ? newSeasonName.trim().replace(/\s+/g, "") || "NewSeason" : seasonId;
    if (!sid) {
      setError("Select a season or enter a new season name.");
      setStatus("error");
      return;
    }
    if (!lineId.trim()) {
      setError("Enter Line ID (e.g. LINE 81).");
      setStatus("error");
      return;
    }
    if (!lineName.trim()) {
      setError("Enter Line name (e.g. Collection Winter Fall 2026).");
      setStatus("error");
      return;
    }
    if (swatches.length === 0) {
      setError("Upload at least one swatch photo (name files like Col.03-Beige.jpg).");
      setStatus("error");
      return;
    }

    setStatus("loading");
    setError(null);
    try {
      const colors = await Promise.all(
        swatches.map(async (s) => ({
          code: s.code,
          name: s.name,
          imageBase64: await fileToBase64(s.file),
        }))
      );
      const res = await fetch("/api/color-books/create-line", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          seasonId: sid,
          seasonName: useNewSeason ? newSeasonName.trim() : undefined,
          lineId: lineId.trim(),
          lineName: lineName.trim(),
          colors,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save");
      setSavedSeasonId(sid);
      setSavedLineId(lineId.trim());
      setPreviewLine(null);
      setStatus("success");
      if (useNewSeason && seasonOptions.indexOf(sid) === -1) {
        setSeasonOptions((prev) => [...prev, sid].sort());
        setSeasonId(sid);
        setUseNewSeason(false);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save");
      setStatus("error");
    }
  }, [
    mode,
    handleSaveFromBoard,
    useNewSeason,
    newSeasonName,
    seasonId,
    seasonOptions,
    lineId,
    lineName,
    swatches,
    fileToBase64,
  ]);

  const canSaveFiles = lineId.trim() && lineName.trim() && swatches.length > 0;
  const labeledRects = boardRects.filter((r) => r.code.trim() && r.name.trim());
  const canSaveBoard = lineId.trim() && lineName.trim() && labeledRects.length > 0;

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
          <Link href="/catalog-builder" className="text-sm tracking-widest uppercase text-muted transition-colors hover:text-charcoal">
            Catalog
          </Link>
          <Link href="/color-book-creator" className="text-sm font-medium tracking-widest uppercase text-charcoal">
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

      <main className="mx-auto max-w-4xl px-6 py-10 md:px-8">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="mb-10">
          <h1 className="font-serif text-3xl tracking-tight text-charcoal md:text-4xl">
            Create Color Book Line
          </h1>
          <p className="mt-2 text-muted">
            Create a line (e.g. LINE 01) for the catalog. Choose how to add swatches: multiple files or one board photo.
          </p>
        </motion.div>

        <div className="mb-8 flex rounded-xl border border-border bg-white p-1">
          <button
            type="button"
            onClick={() => setMode("files")}
            className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium transition-colors ${
              mode === "files" ? "bg-charcoal text-white" : "text-muted hover:bg-offwhite"
            }`}
          >
            <Upload size={18} />
            Multiple swatch files
          </button>
          <button
            type="button"
            onClick={() => setMode("board")}
            className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium transition-colors ${
              mode === "board" ? "bg-charcoal text-white" : "text-muted hover:bg-offwhite"
            }`}
          >
            <ImagePlus size={18} />
            From one board photo
          </button>
        </div>

        <div className="space-y-8">
          <section className="rounded-2xl border border-border bg-white p-6 shadow-sm">
            <h2 className="mb-4 flex items-center gap-2 font-serif text-xl text-charcoal">
              <BookOpen size={20} />
              Line & season
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-charcoal">Line ID</label>
                <input
                  type="text"
                  value={lineId}
                  onChange={(e) => setLineId(e.target.value)}
                  placeholder="e.g. LINE 01 or LINE 81"
                  className="w-full rounded-lg border border-border px-4 py-2.5 text-charcoal focus:border-charcoal focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-charcoal">Line name</label>
                <input
                  type="text"
                  value={lineName}
                  onChange={(e) => setLineName(e.target.value)}
                  placeholder="e.g. VITELLO DOLLARO or FRANCIA LEATHER"
                  className="w-full rounded-lg border border-border px-4 py-2.5 text-charcoal focus:border-charcoal focus:outline-none"
                />
              </div>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-4">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  checked={!useNewSeason}
                  onChange={() => setUseNewSeason(false)}
                  className="rounded-full border-border"
                />
                <span className="text-sm text-charcoal">Existing season</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  checked={useNewSeason}
                  onChange={() => setUseNewSeason(true)}
                  className="rounded-full border-border"
                />
                <span className="text-sm text-charcoal">New season</span>
              </label>
            </div>
            {useNewSeason ? (
              <div className="mt-3">
                <input
                  type="text"
                  value={newSeasonName}
                  onChange={(e) => setNewSeasonName(e.target.value)}
                  placeholder="e.g. Fall Winter 2026"
                  className="w-full max-w-xs rounded-lg border border-border px-4 py-2.5 text-charcoal focus:border-charcoal focus:outline-none"
                />
              </div>
            ) : (
              <div className="mt-3">
                <select
                  value={seasonId}
                  onChange={(e) => setSeasonId(e.target.value)}
                  className="w-full max-w-xs rounded-lg border border-border bg-white px-4 py-2.5 text-charcoal focus:border-charcoal focus:outline-none"
                >
                  <option value="">Select season</option>
                  {seasonOptions.map((id) => (
                    <option key={id} value={id}>
                      {id.replace(/([A-Z])/g, " $1").trim()}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </section>

          {mode === "files" && (
            <section className="rounded-2xl border border-border bg-white p-6 shadow-sm">
              <h2 className="mb-4 font-serif text-xl text-charcoal">Swatch photos</h2>
              <p className="mb-4 text-sm text-muted">
                Name files like <strong>Col.03-Beige.jpg</strong> or <strong>Col.90-Black.png</strong>. The part before the dash is the code, after is the color name.
              </p>
              <div
                onClick={() => inputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add("border-charcoal", "bg-offwhite"); }}
                onDragLeave={(e) => { e.currentTarget.classList.remove("border-charcoal", "bg-offwhite"); }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.currentTarget.classList.remove("border-charcoal", "bg-offwhite");
                  if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
                }}
                className="mb-4 cursor-pointer rounded-xl border-2 border-dashed border-border bg-white p-6 text-center transition-colors hover:border-charcoal/30 hover:bg-offwhite"
              >
                <input
                  ref={inputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => e.target.files?.length && addFiles(e.target.files)}
                />
                <Upload className="mx-auto mb-2 text-muted" size={28} strokeWidth={1.5} />
                <p className="text-sm font-medium text-charcoal">Drop images or click to select</p>
              </div>
              {swatches.length > 0 && (
                <div className="grid grid-cols-4 gap-3 sm:grid-cols-6">
                  {swatches.map((s) => (
                    <div key={s.id} className="relative rounded-lg border border-border bg-offwhite p-2">
                      <img src={s.previewUrl} alt={s.name} className="aspect-square w-full rounded object-cover" />
                      <p className="mt-1 truncate text-center text-xs font-medium text-charcoal">{s.code}</p>
                      <p className="truncate text-center text-xs text-muted">{s.name}</p>
                      <button
                        type="button"
                        onClick={() => removeSwatch(s.id)}
                        className="absolute top-1 right-1 flex h-5 w-5 items-center justify-center rounded-full bg-charcoal/80 text-white hover:bg-charcoal"
                      >
                        <X size={10} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {mode === "board" && (
            <>
              <section className="rounded-2xl border border-border bg-white p-6 shadow-sm">
                <h2 className="mb-4 font-serif text-xl text-charcoal">Board photo</h2>
                <p className="mb-4 text-sm text-muted">
                  Upload one image of your swatch board (e.g. LINEA 01). Then draw a rectangle around each swatch and set code + name.
                </p>
                {!boardPreviewUrl ? (
                  <div
                    onClick={() => document.getElementById("board-file-input")?.click()}
                    onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add("border-charcoal", "bg-offwhite"); }}
                    onDragLeave={(e) => { e.currentTarget.classList.remove("border-charcoal", "bg-offwhite"); }}
                    onDrop={(e) => {
                      e.preventDefault();
                      e.currentTarget.classList.remove("border-charcoal", "bg-offwhite");
                      const file = e.dataTransfer.files?.[0];
                      if (file?.type.startsWith("image/")) handleBoardFile(file);
                    }}
                    className="cursor-pointer rounded-xl border-2 border-dashed border-border bg-white p-8 text-center transition-colors hover:border-charcoal/30 hover:bg-offwhite"
                  >
                    <input
                      id="board-file-input"
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => handleBoardFile(e.target.files?.[0] ?? null)}
                    />
                    <ImagePlus className="mx-auto mb-2 text-muted" size={32} strokeWidth={1.5} />
                    <p className="text-sm font-medium text-charcoal">Click or drop one board image</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-muted">Draw rectangles around each swatch. Click a rect to select, Delete to remove.</p>
                      <button
                        type="button"
                        onClick={() => handleBoardFile(null)}
                        className="text-sm text-muted underline hover:text-charcoal"
                      >
                        Change image
                      </button>
                    </div>
                    <div
                      ref={boardContainerRef}
                      className="relative inline-block max-w-full overflow-auto rounded-lg border border-border bg-black/5"
                      onMouseDown={handleBoardMouseDown}
                      onMouseMove={handleBoardMouseMove}
                      onMouseUp={handleBoardMouseUp}
                      onMouseLeave={() => setDrawing(null)}
                    >
                      <img
                        ref={boardImageRef}
                        src={boardPreviewUrl}
                        alt="Board"
                        className="block max-h-[70vh] w-auto object-contain"
                        draggable={false}
                        style={{ pointerEvents: "none", userSelect: "none" }}
                        onLoad={() => setBoardImageReady(true)}
                      />
                      <canvas
                        ref={canvasRef}
                        className="absolute left-0 top-0 pointer-events-none"
                        style={{ pointerEvents: "none", background: "transparent" }}
                      />
                    </div>
                  </div>
                )}
              </section>

              {boardRects.length > 0 && (
                <section className="rounded-2xl border border-border bg-white p-6 shadow-sm">
                  <h2 className="mb-4 font-serif text-xl text-charcoal">Label swatches</h2>
                  <p className="mb-4 text-sm text-muted">
                    Set code (e.g. Col.01 or 01) and name (e.g. White) for each area. The preview shows exactly what will be saved — if it’s wrong, remove the row and draw a new rectangle.
                  </p>
                  <div className="space-y-3">
                    {boardRects.map((r, idx) => (
                      <div
                        key={r.id}
                        className={`flex flex-wrap items-center gap-3 rounded-lg border p-3 ${
                          r.id === selectedRectId ? "border-charcoal bg-offwhite" : "border-border bg-white"
                        }`}
                      >
                        <RectPreviewThumb boardFile={boardFile} rect={r} />
                        <span className="w-6 text-sm text-muted">{idx + 1}</span>
                        <input
                          type="text"
                          value={r.code}
                          onChange={(e) => updateRect(r.id, { code: e.target.value })}
                          placeholder="Code (e.g. Col.01)"
                          className="w-28 rounded border border-border px-3 py-1.5 text-sm text-charcoal focus:border-charcoal focus:outline-none"
                        />
                        <input
                          type="text"
                          value={r.name}
                          onChange={(e) => updateRect(r.id, { name: e.target.value })}
                          placeholder="Name (e.g. White)"
                          className="min-w-[120px] flex-1 rounded border border-border px-3 py-1.5 text-sm text-charcoal focus:border-charcoal focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => removeRect(r.id)}
                          className="rounded p-1.5 text-muted hover:bg-red-50 hover:text-red-700"
                          title="Remove"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                  <p className="mt-3 text-xs text-muted">
                    {labeledRects.length} of {boardRects.length} labeled — need code and name for each to save.
                  </p>
                </section>
              )}
            </>
          )}

          <div className="flex flex-wrap items-center gap-4">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleSave}
              disabled={
                status === "loading" ||
                !lineId.trim() ||
                !lineName.trim() ||
                (mode === "files" ? !swatches.length : !labeledRects.length)
              }
              className="flex items-center gap-2 rounded-lg bg-charcoal px-5 py-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              {status === "loading" ? <Loader2 size={18} className="animate-spin" /> : <BookOpen size={18} />}
              {status === "loading" ? "Saving…" : "Create & save line"}
            </motion.button>
            {status === "success" && (
              <span className="flex items-center gap-2 text-sm text-green-700">
                <CheckCircle2 size={18} />
                Saved to <code className="rounded bg-offwhite px-1.5 py-0.5 text-xs">data/color-books/{savedSeasonId}.json</code>. Use it in <Link href="/catalog-builder" className="underline">Catalog</Link> when CSV has this line.
              </span>
            )}
          </div>

          {status === "success" && previewLine && (
            <section className="rounded-2xl border border-border bg-white p-6 shadow-sm">
              <h2 className="mb-2 font-serif text-xl text-charcoal">Preview — is this the right color book?</h2>
              <p className="mb-4 text-sm text-muted">
                <strong>{previewLine.id}</strong> · {previewLine.name}
              </p>
              <div className="flex flex-wrap gap-4">
                {previewLine.colors.map((c, i) => (
                  <div key={i} className="flex flex-col items-center gap-1">
                    <div className="h-14 w-14 overflow-hidden rounded-lg border border-border shadow-sm">
                      {c.imageBase64 ? (
                        <img
                          src={`data:image/jpeg;base64,${c.imageBase64}`}
                          alt={c.name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div
                          className="h-full w-full"
                          style={{ backgroundColor: c.hex || "#ccc" }}
                        />
                      )}
                    </div>
                    <span className="text-xs font-medium text-charcoal">{c.code}</span>
                    <span className="text-xs text-muted">{c.name}</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {status === "error" && error && (
            <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              <XCircle size={18} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
