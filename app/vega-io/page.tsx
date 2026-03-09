"use client";

import { useCallback, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Upload, Sparkles, Loader2, Download, X, FolderDown } from "lucide-react";
import Link from "next/link";
import JSZip from "jszip";
import { generateImage, type GenerateResult } from "@/lib/generateApi";
import { VEGAIO_SAM_PROMPT, VEGAIO_PIXEL_ART_PROMPT } from "@/lib/prompts";

const DELAY_BETWEEN_REQUESTS_MS = 2500;

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

type OptionId = "sam" | "pixel-art";

interface OptionConfig {
  id: OptionId;
  title: string;
  description: string;
  prompt: string;
}

const OPTIONS: OptionConfig[] = [
  {
    id: "sam",
    title: "Vega.IO SAM",
    description: "Warm, cozy pixel art featuring SAM the mole (green flower helmet, blue goggles) interacting with your product in a cheerful nature scene.",
    prompt: VEGAIO_SAM_PROMPT,
  },
  {
    id: "pixel-art",
    title: "Vega.IO Pixel Art",
    description: "Polished 16-bit pixel art in vega.io's warm palette — soft greens, sunny blues, cream backgrounds. Retro-game charm with nature and vintage tech details.",
    prompt: VEGAIO_PIXEL_ART_PROMPT,
  },
];

interface FileWithPreview {
  file: File;
  id: string;
  previewUrl: string;
}

function baseName(path: string): string {
  return path.replace(/\.[^.]+$/, "") || path;
}

export default function VegaIoPage() {
  const [selectedOption, setSelectedOption] = useState<OptionId>("sam");
  const [files, setFiles] = useState<FileWithPreview[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<GenerateResult | null>(null);
  const [results, setResults] = useState<{ file: File; result: GenerateResult }[]>([]);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
  const [zipping, setZipping] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const config = OPTIONS.find((o) => o.id === selectedOption) ?? OPTIONS[0];
  const prompt = config.prompt;
  const isBatch = files.length > 1;

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
    setResult(null);
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
    setResult(null);
    setResults([]);
  }, []);

  const clearAll = useCallback(() => {
    files.forEach((f) => URL.revokeObjectURL(f.previewUrl));
    setFiles([]);
    setStatus("idle");
    setError(null);
    setResult(null);
    setResults([]);
    setProgress(null);
  }, [files]);

  const handleGenerate = useCallback(async () => {
    setError(null);
    setResult(null);
    setResults([]);

    if (files.length === 0) {
      setError("Upload at least one image to redesign in Vega.IO style.");
      return;
    }

    if (files.length === 1) {
      setStatus("loading");
      try {
        const data = await generateImage(files[0].file, prompt);
        setResult(data);
        setStatus("success");
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Generation failed");
        setStatus("error");
      }
      return;
    }

    setStatus("loading");
    setProgress({ current: 0, total: files.length });
    const out: { file: File; result: GenerateResult }[] = [];
    try {
      for (let i = 0; i < files.length; i++) {
        setProgress({ current: i + 1, total: files.length });
        const data = await generateImage(files[i].file, prompt);
        out.push({ file: files[i].file, result: data });
        setResults([...out]);
        if (i < files.length - 1) await delay(DELAY_BETWEEN_REQUESTS_MS);
      }
      setStatus("success");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Generation failed");
      setStatus("error");
    } finally {
      setProgress(null);
    }
  }, [prompt, files]);

  const handleDownload = useCallback(() => {
    if (!result) return;
    const ext = result.mimeType.includes("jpeg") ? "jpg" : "png";
    const name = `vegaio-${selectedOption}.${ext}`;
    const link = document.createElement("a");
    link.href = `data:${result.mimeType};base64,${result.image}`;
    link.download = name;
    link.click();
  }, [result, selectedOption]);

  const handleDownloadOne = useCallback((res: GenerateResult, originalFile: File) => {
    const ext = res.mimeType.includes("jpeg") ? "jpg" : "png";
    const name = `${baseName(originalFile.name)}.${ext}`;
    const link = document.createElement("a");
    link.href = `data:${res.mimeType};base64,${res.image}`;
    link.download = name;
    link.click();
  }, []);

  const handleDownloadAll = useCallback(async () => {
    if (results.length === 0) return;
    setZipping(true);
    try {
      const zip = new JSZip();
      for (const { file, result: res } of results) {
        const ext = res.mimeType.includes("jpeg") ? "jpg" : "png";
        const name = `${baseName(file.name)}.${ext}`;
        const binary = atob(res.image);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        zip.file(name, bytes);
      }
      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "vegaio-batch-results.zip";
      link.click();
      URL.revokeObjectURL(url);
    } finally {
      setZipping(false);
    }
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
          <Link href="/heif-to-jpeg" className="text-sm tracking-widest uppercase text-muted transition-colors hover:text-charcoal">
            HEIF → JPEG
          </Link>
          <Link href="/vega-io" className="text-sm font-medium tracking-widest uppercase text-charcoal">
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
            Vega.IO Style
          </h1>
          <p className="mt-2 text-muted">
            Upload your image and redesign it in Vega.IO style — Sam (vector / flat) or Pixel Art (8-bit). Batch supported.
          </p>
        </motion.div>

        <div className="mb-8 flex flex-wrap gap-3 rounded-xl border border-border bg-white p-2">
          {OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => {
                setSelectedOption(opt.id);
                setStatus("idle");
                setError(null);
                setResult(null);
                setResults([]);
              }}
              className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${
                selectedOption === opt.id ? "bg-charcoal text-white" : "text-charcoal hover:bg-offwhite"
              }`}
            >
              {opt.title}
            </button>
          ))}
        </div>

        <section className="rounded-2xl border border-border bg-white p-6 shadow-sm">
          <h2 className="mb-1 font-serif text-xl text-charcoal">{config.title}</h2>
          <p className="mb-6 text-sm text-muted">{config.description}</p>

          <div className="mb-6">
            <p className="mb-2 text-sm font-medium text-charcoal">Your image(s)</p>
            <p className="mb-3 text-xs text-muted">
              Upload one or more images. Each will be redesigned in the selected Vega.IO style (same subject, new look).
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
              className="cursor-pointer rounded-xl border-2 border-dashed border-border bg-white p-6 text-center transition-colors hover:border-charcoal/30 hover:bg-offwhite"
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
              <p className="text-sm text-charcoal">Drop images or click to select (single or batch)</p>
            </div>

            {files.length > 0 && (
              <>
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-sm text-muted">{files.length} image(s)</span>
                  <button type="button" onClick={clearAll} className="text-xs text-muted underline hover:text-charcoal">
                    Clear all
                  </button>
                </div>
                <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto rounded-lg border border-border bg-offwhite/50 p-2">
                  {files.map(({ file, id }) => (
                    <li key={id} className="flex items-center justify-between gap-2 text-sm">
                      <span className="truncate text-charcoal">{file.name}</span>
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
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleGenerate}
              disabled={status === "loading" || files.length === 0}
              className="flex items-center gap-2 rounded-lg bg-charcoal px-5 py-3 text-sm font-medium text-white disabled:opacity-50"
            >
              {status === "loading" ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <Sparkles size={18} />
              )}
              {status === "loading" && progress
                ? `Processing ${progress.current} of ${progress.total}…`
                : isBatch
                  ? "Generate all"
                  : "Generate"}
            </motion.button>
            {status === "loading" && progress && (
              <span className="text-xs text-muted">
                ~{Math.ceil((progress.total - progress.current) * (DELAY_BETWEEN_REQUESTS_MS / 1000))}s left
              </span>
            )}
          </div>

          {status === "error" && error && (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              {error}
            </div>
          )}

          {status === "success" && result && !results.length && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mt-6 rounded-xl border border-border overflow-hidden"
            >
              <img
                src={`data:${result.mimeType};base64,${result.image}`}
                alt="Generated"
                className="w-full max-h-[70vh] object-contain bg-offwhite"
              />
              <div className="flex justify-end border-t border-border bg-white p-3">
                <button
                  type="button"
                  onClick={handleDownload}
                  className="flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium text-charcoal hover:bg-offwhite"
                >
                  <Download size={16} />
                  Download
                </button>
              </div>
            </motion.div>
          )}

          {status === "success" && results.length > 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mt-6 space-y-4"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium text-charcoal">Results (same name as input)</span>
                <button
                  type="button"
                  onClick={handleDownloadAll}
                  disabled={zipping}
                  className="flex items-center gap-2 rounded-lg bg-charcoal px-3 py-1.5 text-sm text-white hover:opacity-90 disabled:opacity-50"
                >
                  <FolderDown size={16} />
                  {zipping ? "Preparing…" : "Download all (.zip)"}
                </button>
              </div>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                {results.map(({ file, result: res }, idx) => (
                  <div key={file.name + idx} className="rounded-xl border border-border overflow-hidden bg-offwhite">
                    <img
                      src={`data:${res.mimeType};base64,${res.image}`}
                      alt={file.name}
                      className="w-full aspect-square object-contain"
                    />
                    <div className="flex items-center justify-between gap-2 border-t border-border bg-white p-2">
                      <p className="truncate text-xs text-muted" title={file.name}>{file.name}</p>
                      <button
                        type="button"
                        onClick={() => handleDownloadOne(res, file)}
                        className="shrink-0 rounded border border-border px-2 py-1 text-xs font-medium text-charcoal hover:bg-offwhite"
                      >
                        <Download size={12} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </section>
      </main>
    </div>
  );
}
