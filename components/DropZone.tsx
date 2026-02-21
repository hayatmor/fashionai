"use client";

import { useCallback, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Upload, X } from "lucide-react";

interface DropZoneProps {
  onFileSelect: (file: File | null) => void;
  file: File | null;
  previewUrl: string | null;
}

export default function DropZone({ onFileSelect, file, previewUrl }: DropZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    (f: File | null) => {
      onFileSelect(f);
    },
    [onFileSelect],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const f = e.dataTransfer.files?.[0];
      if (f?.type.startsWith("image/")) handleFile(f);
    },
    [handleFile],
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files?.[0] ?? null;
      handleFile(f);
    },
    [handleFile],
  );

  const clearFile = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      handleFile(null);
      if (inputRef.current) inputRef.current.value = "";
    },
    [handleFile],
  );

  return (
    <motion.div
      onClick={() => !file && inputRef.current?.click()}
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
      animate={{
        borderColor: isDragging ? "#1a1a1a" : "#e5e5e5",
        scale: isDragging ? 1.01 : 1,
      }}
      transition={{ duration: 0.2 }}
      className={`relative flex min-h-[220px] cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed transition-colors ${
        file ? "border-charcoal/30 bg-offwhite" : "border-border bg-white hover:border-charcoal/30"
      }`}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={handleChange}
        className="hidden"
      />

      {previewUrl ? (
        <div className="relative flex w-full items-center justify-center p-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewUrl}
            alt="Preview"
            className="max-h-48 rounded-lg object-contain"
          />
          <button
            onClick={clearFile}
            className="absolute top-3 right-3 flex h-7 w-7 items-center justify-center rounded-full bg-charcoal/80 text-white transition-colors hover:bg-charcoal"
          >
            <X size={14} />
          </button>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3 px-6 py-8 text-center">
          <Upload size={28} className="text-muted/60" strokeWidth={1.5} />
          <p className="text-sm text-muted">
            Drag &amp; drop your image here, or{" "}
            <span className="text-charcoal underline underline-offset-2">browse</span>
          </p>
        </div>
      )}
    </motion.div>
  );
}
