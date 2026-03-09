"use client";

import { useCallback, useState } from "react";
import { motion } from "framer-motion";
import { Sparkles, ClipboardCopy, Check, Download } from "lucide-react";
import DropZone from "./DropZone";
import MultiDropZone, { createEmptySlots, type FileSlot } from "./MultiDropZone";
import StatusBar, { Status } from "./StatusBar";
import { generateImage, generateImageMulti, generateCatalogCompose, GenerateResult } from "@/lib/generateApi";

interface StudioModuleProps {
  title: string;
  prompt: string;
  index: number;
  maxFiles?: number;
  useCompose?: boolean;
  /** When true, each uploaded file gets its own generation (e.g. 5 photos → 5 results) */
  oneResultPerFile?: boolean;
}

export default function StudioModule({ title, prompt, index, maxFiles = 1, useCompose = false, oneResultPerFile = false }: StudioModuleProps) {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [multiSlots, setMultiSlots] = useState<FileSlot[]>(() =>
    createEmptySlots(maxFiles > 1 ? maxFiles : 4),
  );
  const [copied, setCopied] = useState(false);

  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [result, setResult] = useState<GenerateResult | null>(null);
  const [batchResults, setBatchResults] = useState<GenerateResult[]>([]);
  const [batchProgress, setBatchProgress] = useState<{ current: number; total: number } | null>(null);

  const isMulti = maxFiles > 1;
  const multiFiles = multiSlots.map((s) => s.file).filter((f): f is File => f !== null);
  const canGenerate = isMulti
    ? oneResultPerFile
      ? multiFiles.length >= 1 && multiFiles.length <= maxFiles
      : multiFiles.length === maxFiles
    : !!file;

  const handleFileSelect = useCallback((f: File | null) => {
    setFile(f);
    if (f) {
      const url = URL.createObjectURL(f);
      setPreviewUrl(url);
    } else {
      setPreviewUrl(null);
    }
    setStatus("idle");
    setError(null);
    setResult(null);
    setBatchResults([]);
  }, []);

  const handleSlotsChange = useCallback((slots: FileSlot[]) => {
    setMultiSlots(slots);
    setStatus("idle");
    setError(null);
    setResult(null);
    setBatchResults([]);
  }, []);

  const handleGenerate = useCallback(async () => {
    if (!canGenerate) return;

    setStatus("loading");
    setError(null);
    setResult(null);
    setBatchResults([]);
    setStartTime(Date.now());

    try {
      if (oneResultPerFile && multiFiles.length > 0) {
        setBatchProgress({ current: 0, total: multiFiles.length });
        const results: GenerateResult[] = [];
        for (let i = 0; i < multiFiles.length; i++) {
          setBatchProgress({ current: i + 1, total: multiFiles.length });
          const data = await generateImage(multiFiles[i], prompt);
          results.push(data);
          setBatchResults([...results]);
        }
        setBatchProgress(null);
        setStatus("success");
      } else {
        setBatchProgress(null);
        const data = useCompose
          ? await generateCatalogCompose(multiFiles)
          : isMulti
            ? await generateImageMulti(multiFiles, prompt)
            : await generateImage(file!, prompt);
        setResult(data);
        setStatus("success");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Generation failed";
      setError(msg);
      setStatus("error");
      setBatchProgress(null);
    } finally {
      setStartTime(null);
    }
  }, [canGenerate, isMulti, useCompose, oneResultPerFile, multiFiles, file, prompt]);

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [prompt]);

  const handleDownload = useCallback(() => {
    if (!result) return;
    const ext = result.mimeType.includes("jpeg") ? "jpg" : "png";
    const baseName = file?.name?.replace(/\.[^.]+$/, "") || `fashion-ai-${title.toLowerCase().replace(/\s+/g, "-")}`;
    const link = document.createElement("a");
    link.href = `data:${result.mimeType};base64,${result.image}`;
    link.download = `${baseName}.${ext}`;
    link.click();
  }, [result, title, file]);

  const resultDataUrl = result
    ? `data:${result.mimeType};base64,${result.image}`
    : null;
  const hasBatchResults = batchResults.length > 0;

  const handleDownloadOne = useCallback(
    (r: GenerateResult, idx: number) => {
      const ext = r.mimeType.includes("jpeg") ? "jpg" : "png";
      const originalName = multiFiles[idx]?.name;
      const baseName = originalName ? originalName.replace(/\.[^.]+$/, "") : `result-${idx + 1}`;
      const link = document.createElement("a");
      link.href = `data:${r.mimeType};base64,${r.image}`;
      link.download = `${baseName}.${ext}`;
      link.click();
    },
    [multiFiles],
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.7, delay: index * 0.15, ease: "easeOut" }}
      className="flex flex-col gap-5 rounded-2xl border border-border bg-white p-6 shadow-[0_2px_20px_rgba(0,0,0,0.04)] md:p-8"
    >
      <h3 className="font-serif text-xl tracking-tight text-charcoal md:text-2xl">
        {title}
      </h3>

      {isMulti ? (
        <MultiDropZone slots={multiSlots} onSlotsChange={handleSlotsChange} />
      ) : (
        <DropZone onFileSelect={handleFileSelect} file={file} previewUrl={previewUrl} />
      )}

      <div className="flex gap-3">
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleGenerate}
          disabled={!canGenerate || status === "loading"}
          className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-charcoal py-3 text-sm font-medium tracking-wide text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-30"
        >
          <Sparkles size={16} />
          {status === "loading" ? "Generating..." : "Generate"}
        </motion.button>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleCopy}
          className="flex items-center justify-center gap-2 rounded-lg border border-border px-4 py-3 text-sm font-medium tracking-wide text-charcoal transition-colors hover:bg-offwhite"
        >
          {copied ? <Check size={16} /> : <ClipboardCopy size={16} />}
          {copied ? "Copied!" : "Copy Prompt"}
        </motion.button>
      </div>

      <StatusBar status={status} error={error} startTime={startTime} batchProgress={batchProgress} />

      {hasBatchResults && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
          className="flex flex-col gap-4"
        >
          <p className="text-sm font-medium text-charcoal">Generated images</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {batchResults.map((r, idx) => (
              <div key={idx} className="flex flex-col gap-2 rounded-xl border border-border overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`data:${r.mimeType};base64,${r.image}`}
                  alt={`Result ${idx + 1}`}
                  className="w-full object-contain bg-offwhite"
                />
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleDownloadOne(r, idx)}
                  className="mx-2 mb-2 flex items-center justify-center gap-2 rounded-lg border border-border py-2 text-xs font-medium text-charcoal transition-colors hover:bg-offwhite"
                >
                  <Download size={14} />
                  Download {idx + 1}
                </motion.button>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {resultDataUrl && !hasBatchResults && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
          className="flex flex-col gap-3"
        >
          <div className="overflow-hidden rounded-xl border border-border">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={resultDataUrl}
              alt="Generated result"
              className="w-full object-contain"
            />
          </div>
          {result?.text && (
            <p className="text-xs leading-relaxed text-muted">{result.text}</p>
          )}
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleDownload}
            className="flex items-center justify-center gap-2 rounded-lg border border-border py-2.5 text-sm font-medium tracking-wide text-charcoal transition-colors hover:bg-offwhite"
          >
            <Download size={16} />
            Download Image
          </motion.button>
        </motion.div>
      )}
    </motion.div>
  );
}
