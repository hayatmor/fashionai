"use client";

import { useCallback, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Upload, X, Loader2, CheckCircle2, XCircle, Download, FolderDown } from "lucide-react";
import Link from "next/link";
import JSZip from "jszip";

const HEIF_TYPES = ["image/heic", "image/heif", "image/heic-sequence", "image/heif-sequence"];
const HEIF_EXT = /\.(heic|heif|HEIC|HEIF)$/i;

function isHeifFile(file: File): boolean {
  return HEIF_TYPES.includes(file.type) || HEIF_EXT.test(file.name);
}

function baseName(path: string): string {
  return path.replace(/\.[^.]+$/, "") || path;
}

interface FileEntry {
  file: File;
  id: string;
}

interface ConvertResult {
  file: File;
  blob: Blob;
  name: string;
}

export default function HeifToJpegPage() {
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
  const [results, setResults] = useState<ConvertResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const addFiles = useCallback((newFiles: FileList | File[]) => {
    const list = Array.from(newFiles).filter(isHeifFile);
    const skipped = Array.from(newFiles).length - list.length;
    if (skipped > 0) {
      setError(skipped === 1 ? "1 file skipped (not HEIF/HEIC)." : `${skipped} files skipped (not HEIF/HEIC).`);
    } else {
      setError(null);
    }
    setFiles((prev) => [
      ...prev,
      ...list.map((file) => ({
        file,
        id: `${file.name}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      })),
    ]);
    setStatus("idle");
    setResults([]);
  }, []);

  const removeFile = useCallback((id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
    setStatus("idle");
    setError(null);
    setResults([]);
  }, []);

  const clearAll = useCallback(() => {
    setFiles([]);
    setStatus("idle");
    setError(null);
    setResults([]);
    setProgress(null);
  }, []);

  const convert = useCallback(async () => {
    if (files.length === 0) return;
    setStatus("loading");
    setError(null);
    setResults([]);
    setProgress({ current: 0, total: files.length });

    const heic2any = (await import("heic2any")).default;
    const out: ConvertResult[] = [];

    try {
      for (let i = 0; i < files.length; i++) {
        setProgress({ current: i + 1, total: files.length });
        const { file } = files[i];
        const blob = file.slice(0, file.size, file.type);
        const result = await heic2any({
          blob,
          toType: "image/jpeg",
          quality: 1,
        });
        const jpegBlob = Array.isArray(result) ? result[0] : result;
        if (!jpegBlob || !(jpegBlob instanceof Blob)) {
          throw new Error(`Conversion failed: ${file.name}`);
        }
        const name = `${baseName(file.name)}.jpeg`;
        out.push({ file, blob: jpegBlob, name });
        setResults([...out]);
      }
      setStatus("success");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Conversion failed");
      setStatus("error");
    } finally {
      setProgress(null);
    }
  }, [files]);

  const downloadOne = useCallback((r: ConvertResult) => {
    const url = URL.createObjectURL(r.blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = r.name;
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  const downloadAll = useCallback(async () => {
    if (results.length === 0) return;
    const zip = new JSZip();
    for (const r of results) {
      zip.file(r.name, r.blob);
    }
    const blob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "heif-to-jpeg.zip";
    a.click();
    URL.revokeObjectURL(url);
  }, [results]);

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
          <Link href="/color-book-creator" className="text-sm tracking-widest uppercase text-muted transition-colors hover:text-charcoal">
            Color Book
          </Link>
          <Link href="/heif-to-jpeg" className="text-sm font-medium tracking-widest uppercase text-charcoal">
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
            HEIF → JPEG
          </h1>
          <p className="mt-2 text-muted">
            Convert HEIC/HEIF photos to JPEG at highest quality. Same filename, <code className="rounded bg-offwhite px-1">.jpeg</code> extension. Batch supported.
          </p>
        </motion.div>

        <section className="rounded-2xl border border-border bg-white p-6 shadow-sm">
          <h2 className="mb-4 font-serif text-xl text-charcoal">Upload HEIF/HEIC files</h2>
          <div
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add("border-charcoal", "bg-offwhite"); }}
            onDragLeave={(e) => { e.currentTarget.classList.remove("border-charcoal", "bg-offwhite"); }}
            onDrop={(e) => {
              e.preventDefault();
              e.currentTarget.classList.remove("border-charcoal", "bg-offwhite");
              if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
            }}
            className="cursor-pointer rounded-xl border-2 border-dashed border-border bg-white p-8 text-center transition-colors hover:border-charcoal/30 hover:bg-offwhite"
          >
            <input
              ref={inputRef}
              type="file"
              accept="image/heic,image/heif,.heic,.heif"
              multiple
              className="hidden"
              onChange={(e) => e.target.files?.length && addFiles(e.target.files)}
            />
            <Upload className="mx-auto mb-2 text-muted" size={32} strokeWidth={1.5} />
            <p className="text-sm font-medium text-charcoal">Drop HEIF/HEIC files or click to select</p>
            <p className="mt-1 text-xs text-muted">Output: same name with .jpeg, highest quality</p>
          </div>

          {files.length > 0 && (
            <>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <span className="text-sm text-muted">{files.length} file(s)</span>
                <button
                  type="button"
                  onClick={convert}
                  disabled={status === "loading"}
                  className="flex items-center gap-2 rounded-lg bg-charcoal px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                >
                  {status === "loading" ? <Loader2 size={18} className="animate-spin" /> : <Upload size={18} />}
                  {status === "loading" ? "Converting…" : "Convert to JPEG"}
                </button>
                <button
                  type="button"
                  onClick={clearAll}
                  className="rounded-lg border border-border px-4 py-2 text-sm text-muted hover:bg-offwhite"
                >
                  Clear all
                </button>
              </div>
              <ul className="mt-3 max-h-48 space-y-1 overflow-y-auto text-sm text-charcoal">
                {files.map(({ file, id }) => (
                  <li key={id} className="flex items-center justify-between gap-2 rounded bg-offwhite/50 px-3 py-1.5">
                    <span className="truncate">{file.name}</span>
                    <button
                      type="button"
                      onClick={() => removeFile(id)}
                      className="shrink-0 rounded p-1 text-muted hover:bg-red-50 hover:text-red-700"
                      title="Remove"
                    >
                      <X size={14} />
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}

          {progress && (
            <p className="mt-3 text-sm text-muted">
              Converting {progress.current} of {progress.total}…
            </p>
          )}

          {status === "success" && results.length > 0 && (
            <div className="mt-6 rounded-lg border border-border bg-offwhite/30 p-4">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <CheckCircle2 className="text-green-600" size={20} />
                <span className="text-sm font-medium text-charcoal">Done. Download as .jpeg (same name)</span>
                <button
                  type="button"
                  onClick={downloadAll}
                  className="flex items-center gap-2 rounded-lg bg-charcoal px-3 py-1.5 text-sm text-white hover:opacity-90"
                >
                  <FolderDown size={16} />
                  Download all (.zip)
                </button>
              </div>
              <ul className="space-y-2">
                {results.map((r, i) => (
                  <li key={i} className="flex items-center justify-between gap-2 text-sm">
                    <span className="truncate text-muted">{r.name}</span>
                    <button
                      type="button"
                      onClick={() => downloadOne(r)}
                      className="flex items-center gap-1 rounded border border-border px-2 py-1 text-charcoal hover:bg-white"
                    >
                      <Download size={14} />
                      Save
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {status === "error" && error && (
            <div className="mt-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              <XCircle size={18} className="shrink-0" />
              {error}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
