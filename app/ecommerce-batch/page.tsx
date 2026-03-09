"use client";

import { useCallback, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Upload, X, Sparkles, Download, Loader2, CheckCircle2, XCircle, FolderDown } from "lucide-react";
import Link from "next/link";
import JSZip from "jszip";
import { generateImage, type GenerateResult } from "@/lib/generateApi";
import { ECOMMERCE_3_PROMPT, PURE_WHITE_BACKGROUND_PROMPT } from "@/lib/prompts";

const BATCH_OPTIONS = [
  { id: "ecommerce3" as const, label: "E-Commerce Studio 3", prompt: ECOMMERCE_3_PROMPT },
  { id: "pureWhite" as const, label: "100% Pure White Background", prompt: PURE_WHITE_BACKGROUND_PROMPT },
] as const;

/** Delay between API calls to avoid rate limits (ms) */
const DELAY_BETWEEN_REQUESTS_MS = 2500;

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

interface FileWithPreview {
  file: File;
  id: string;
  previewUrl: string;
}

export default function EcommerceBatchPage() {
  const [batchMode, setBatchMode] = useState<"ecommerce3" | "pureWhite">("ecommerce3");
  const [files, setFiles] = useState<FileWithPreview[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
  const [results, setResults] = useState<{ file: File; result: GenerateResult }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [startTime, setStartTime] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const addFiles = useCallback((newFiles: FileList | File[]) => {
    const list = Array.from(newFiles).filter((f) => f.type.startsWith("image/"));
    setFiles((prev) => {
      const next = [...prev];
      list.forEach((file) => {
        next.push({
          file,
          id: `${file.name}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          previewUrl: URL.createObjectURL(file),
        });
      });
      return next;
    });
    setStatus("idle");
    setError(null);
    setResults([]);
  }, []);

  const removeFile = useCallback((id: string) => {
    setFiles((prev) => {
      const item = prev.find((f) => f.id === id);
      if (item) URL.revokeObjectURL(item.previewUrl);
      return prev.filter((f) => f.id !== id);
    });
    setStatus("idle");
    setError(null);
    setResults([]);
  }, []);

  const clearAll = useCallback(() => {
    files.forEach((f) => URL.revokeObjectURL(f.previewUrl));
    setFiles([]);
    setStatus("idle");
    setError(null);
    setResults([]);
    setProgress(null);
  }, [files]);

  const handleGenerate = useCallback(async () => {
    if (files.length === 0) return;
    setStatus("loading");
    setError(null);
    setResults([]);
    setProgress({ current: 0, total: files.length });
    setStartTime(Date.now());

    const out: { file: File; result: GenerateResult }[] = [];
    try {
      for (let i = 0; i < files.length; i++) {
        setProgress({ current: i + 1, total: files.length });
        const { file } = files[i];
        const prompt = BATCH_OPTIONS.find((o) => o.id === batchMode)?.prompt ?? ECOMMERCE_3_PROMPT;
        const result = await generateImage(file, prompt);
        out.push({ file, result });
        setResults([...out]);
        if (i < files.length - 1) await delay(DELAY_BETWEEN_REQUESTS_MS);
      }
      setStatus("success");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Generation failed";
      setError(msg);
      setStatus("error");
    } finally {
      setProgress(null);
    }
  }, [files, batchMode]);

  const handleDownload = useCallback((result: GenerateResult, originalFile: File) => {
    const ext = result.mimeType.includes("jpeg") ? "jpg" : "png";
    const baseName = originalFile.name.replace(/\.[^.]+$/, "") || "result";
    const link = document.createElement("a");
    link.href = `data:${result.mimeType};base64,${result.image}`;
    link.download = `${baseName}.${ext}`;
    link.click();
  }, []);

  const [zipping, setZipping] = useState(false);

  const handleDownloadAll = useCallback(async () => {
    if (results.length === 0) return;
    setZipping(true);
    try {
      const zip = new JSZip();
      for (const { file, result } of results) {
        const ext = result.mimeType.includes("jpeg") ? "jpg" : "png";
        const baseName = file.name.replace(/\.[^.]+$/, "") || "result";
        const binary = atob(result.image);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        zip.file(`${baseName}.${ext}`, bytes);
      }
      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "ecommerce-batch-results.zip";
      link.click();
      URL.revokeObjectURL(url);
    } finally {
      setZipping(false);
    }
  }, [results]);

  const canGenerate = files.length > 0 && status !== "loading";

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 flex items-center justify-between border-b border-border/60 bg-white/80 px-6 py-4 backdrop-blur-md md:px-16">
        <Link href="/" className="font-serif text-xl tracking-wide text-charcoal md:text-2xl">
          Fashion AI
        </Link>
        <nav className="flex items-center gap-6">
          <Link
            href="/"
            className="text-sm tracking-widest uppercase text-muted transition-colors hover:text-charcoal"
          >
            Gallery
          </Link>
          <Link
            href="/ecommerce-batch"
            className="text-sm font-medium tracking-widest uppercase text-charcoal"
          >
            Batch Studio
          </Link>
          <Link href="/catalog-builder" className="text-sm tracking-widest uppercase text-muted transition-colors hover:text-charcoal">
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
        </nav>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-10 md:px-8">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-10"
        >
          <h1 className="font-serif text-3xl tracking-tight text-charcoal md:text-4xl">
            E-Commerce Batch Studio
          </h1>
          <p className="mt-2 text-muted">
            Upload as many product photos as you need. Choose a style below; each image gets one result.
            Results keep the original file names. Requests are spaced to avoid API limits.
          </p>
        </motion.div>

        <div className="mb-6 rounded-xl border border-border bg-white p-4">
          <p className="mb-3 text-sm font-medium text-charcoal">Batch style</p>
          <div className="flex flex-wrap gap-3">
            {BATCH_OPTIONS.map((opt) => (
              <label
                key={opt.id}
                className={`flex cursor-pointer items-center gap-2 rounded-lg border px-4 py-2.5 text-sm transition-colors ${
                  batchMode === opt.id ? "border-charcoal bg-charcoal text-white" : "border-border bg-white text-charcoal hover:bg-offwhite"
                }`}
              >
                <input
                  type="radio"
                  name="batchMode"
                  value={opt.id}
                  checked={batchMode === opt.id}
                  onChange={() => setBatchMode(opt.id)}
                  className="sr-only"
                />
                {opt.label}
              </label>
            ))}
          </div>
        </div>

        <div
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            e.currentTarget.classList.add("border-charcoal", "bg-offwhite");
          }}
          onDragLeave={(e) => {
            e.currentTarget.classList.remove("border-charcoal", "bg-offwhite");
          }}
          onDrop={(e) => {
            e.preventDefault();
            e.currentTarget.classList.remove("border-charcoal", "bg-offwhite");
            if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
          }}
          className="mb-8 cursor-pointer rounded-xl border-2 border-dashed border-border bg-white p-8 text-center transition-colors hover:border-charcoal/30 hover:bg-offwhite"
        >
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => e.target.files?.length && addFiles(e.target.files)}
          />
          <Upload className="mx-auto mb-3 text-muted" size={32} strokeWidth={1.5} />
          <p className="text-sm font-medium text-charcoal">
            Drop images here or click to select multiple
          </p>
          <p className="mt-1 text-xs text-muted">No limit. Each image is processed one by one.</p>
        </div>

        {files.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mb-8"
          >
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-medium text-charcoal">
                {files.length} photo{files.length !== 1 ? "s" : ""} selected
              </p>
              <button
                type="button"
                onClick={clearAll}
                className="text-xs text-muted underline hover:text-charcoal"
              >
                Clear all
              </button>
            </div>
            <div className="grid max-h-48 grid-cols-4 gap-2 overflow-y-auto rounded-lg border border-border bg-offwhite p-3 sm:grid-cols-6 md:grid-cols-8">
              {files.map(({ file, id, previewUrl }) => (
                <div
                  key={id}
                  className="relative flex flex-col items-center rounded-lg border border-border bg-white p-2"
                >
                  <img
                    src={previewUrl}
                    alt={file.name}
                    className="h-16 w-full object-contain"
                  />
                  <p className="mt-1 truncate w-full text-center text-xs text-muted" title={file.name}>
                    {file.name}
                  </p>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeFile(id);
                    }}
                    className="absolute top-1 right-1 flex h-5 w-5 items-center justify-center rounded-full bg-charcoal/80 text-white hover:bg-charcoal"
                  >
                    <X size={10} />
                  </button>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {files.length > 0 && (
          <div className="mb-8 flex flex-wrap items-center gap-3">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleGenerate}
              disabled={!canGenerate}
              className="flex items-center gap-2 rounded-lg bg-charcoal px-5 py-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              {status === "loading" ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <Sparkles size={18} />
              )}
              {status === "loading" && progress
                ? `Processing ${progress.current} of ${progress.total}…`
                : "Generate all"}
            </motion.button>
            {status === "loading" && progress && (
              <span className="text-xs text-muted">
                ~{Math.ceil((progress.total - progress.current) * (DELAY_BETWEEN_REQUESTS_MS / 1000))}s left
                (delay between requests to protect API)
              </span>
            )}
          </div>
        )}

        {status === "loading" && progress && (
          <div className="mb-6 rounded-lg border border-charcoal/10 bg-offwhite px-4 py-3">
            <div className="mb-2 flex justify-between text-sm text-charcoal">
              <span>Processing…</span>
              <span>
                {progress.current} / {progress.total}
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-charcoal/10">
              <motion.div
                className="h-full rounded-full bg-charcoal/60"
                initial={{ width: "0%" }}
                animate={{ width: `${(progress.current / progress.total) * 100}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>
          </div>
        )}

        {status === "error" && error && (
          <div className="mb-6 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            <XCircle size={18} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {status === "success" && results.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-12"
          >
            <div className="mb-4 flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2 text-green-800">
                <CheckCircle2 size={20} />
                <span className="font-medium">Done — {results.length} image{results.length !== 1 ? "s" : ""} ready.</span>
              </div>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleDownloadAll}
                disabled={zipping}
                className="flex items-center gap-2 rounded-lg bg-charcoal px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50"
              >
                {zipping ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <FolderDown size={16} />
                )}
                {zipping ? "Zipping…" : "Download All (.zip)"}
              </motion.button>
            </div>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
              {results.map(({ file, result }, idx) => (
                <div
                  key={file.name + idx}
                  className="flex flex-col overflow-hidden rounded-xl border border-border bg-white"
                >
                  <img
                    src={`data:${result.mimeType};base64,${result.image}`}
                    alt={file.name}
                    className="aspect-square w-full object-contain bg-offwhite"
                  />
                  <div className="flex flex-col gap-2 p-3">
                    <p className="truncate text-xs text-muted" title={file.name}>
                      {file.name}
                    </p>
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => handleDownload(result, file)}
                      className="flex items-center justify-center gap-2 rounded-lg border border-border py-2 text-xs font-medium text-charcoal hover:bg-offwhite"
                    >
                      <Download size={14} />
                      Download
                    </motion.button>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </main>
    </div>
  );
}
