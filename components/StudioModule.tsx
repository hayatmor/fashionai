"use client";

import { useCallback, useState } from "react";
import { motion } from "framer-motion";
import { Sparkles, ClipboardCopy, Check, Download } from "lucide-react";
import DropZone from "./DropZone";
import StatusBar, { Status } from "./StatusBar";
import { generateImage, GenerateResult } from "@/lib/generateApi";

interface StudioModuleProps {
  title: string;
  prompt: string;
  index: number;
}

export default function StudioModule({ title, prompt, index }: StudioModuleProps) {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [result, setResult] = useState<GenerateResult | null>(null);

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
  }, []);

  const handleGenerate = useCallback(async () => {
    if (!file) return;

    setStatus("loading");
    setError(null);
    setResult(null);
    setStartTime(Date.now());

    try {
      const data = await generateImage(file, prompt);
      setResult(data);
      setStatus("success");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Generation failed";
      setError(msg);
      setStatus("error");
    } finally {
      setStartTime(null);
    }
  }, [file, prompt]);

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [prompt]);

  const handleDownload = useCallback(() => {
    if (!result) return;
    const ext = result.mimeType.includes("jpeg") ? "jpg" : "png";
    const link = document.createElement("a");
    link.href = `data:${result.mimeType};base64,${result.image}`;
    link.download = `fashion-ai-${title.toLowerCase().replace(/\s+/g, "-")}.${ext}`;
    link.click();
  }, [result, title]);

  const resultDataUrl = result
    ? `data:${result.mimeType};base64,${result.image}`
    : null;

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

      <DropZone onFileSelect={handleFileSelect} file={file} previewUrl={previewUrl} />

      <div className="flex gap-3">
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleGenerate}
          disabled={!file || status === "loading"}
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

      <StatusBar status={status} error={error} startTime={startTime} />

      {resultDataUrl && (
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
