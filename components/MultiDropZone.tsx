"use client";

import { useCallback, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Upload, X } from "lucide-react";

const CATALOG_SLOT_LABELS = [
  "Photo 1 (top-left)",
  "Photo 2 (top-right)",
  "Photo 3 (bottom-left)",
  "Photo 4 (bottom-right)",
];

export interface FileSlot {
  file: File | null;
  previewUrl: string | null;
}

interface MultiDropZoneProps {
  slots: FileSlot[];
  onSlotsChange: (slots: FileSlot[]) => void;
  /** Optional labels; defaults to "Photo 1", "Photo 2", ... or catalog labels for 4 slots */
  slotLabels?: string[];
}

/** Create N empty slots. Use 4 for catalog, 5 for batch e-commerce, etc. */
export function createEmptySlots(n: number = 4): FileSlot[] {
  return Array.from({ length: n }, () => ({ file: null, previewUrl: null }));
}

/** Create 4 slots for catalog grid (top-left, top-right, etc.) */
export function createCatalogSlots(): [FileSlot, FileSlot, FileSlot, FileSlot] {
  return createEmptySlots(4) as [FileSlot, FileSlot, FileSlot, FileSlot];
}

export default function MultiDropZone({ slots, onSlotsChange, slotLabels }: MultiDropZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [dragOverSlot, setDragOverSlot] = useState<number | null>(null);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const updateSlot = useCallback(
    (index: number, file: File | null) => {
      const next = slots.map((s) => ({ ...s }));
      if (file) {
        const url = URL.createObjectURL(file);
        next[index] = { file, previewUrl: url };
      } else {
        if (next[index].previewUrl) URL.revokeObjectURL(next[index].previewUrl);
        next[index] = { file: null, previewUrl: null };
      }
      onSlotsChange(next);
    },
    [slots, onSlotsChange],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent, index: number) => {
      e.preventDefault();
      setDragOverSlot(null);
      setIsDragging(false);
      const f = e.dataTransfer.files?.[0];
      if (f?.type.startsWith("image/")) updateSlot(index, f);
    },
    [updateSlot],
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>, index: number) => {
      const f = e.target.files?.[0] ?? null;
      updateSlot(index, f);
      const input = inputRefs.current[index];
      if (input) input.value = "";
    },
    [updateSlot],
  );

  const clearSlot = useCallback(
    (e: React.MouseEvent, index: number) => {
      e.stopPropagation();
      updateSlot(index, null);
      const input = inputRefs.current[index];
      if (input) input.value = "";
    },
    [updateSlot],
  );

  const allFilled = slots.every((s) => s.file !== null);
  const labels = slotLabels ?? (slots.length === 4 ? CATALOG_SLOT_LABELS : slots.map((_, i) => `Photo ${i + 1}`));

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted">
        {slots.length === 4
          ? "Upload 4 product photos for the catalog grid (top-left, top-right, bottom-left, bottom-right)."
          : `Upload ${slots.length} product photos. Each will get its own generated result.`}
      </p>
      <div className={`grid gap-3 ${slots.length <= 4 ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-3"}`}>
        {slots.map((slot, index) => (
          <motion.div
            key={index}
            onClick={() => !slots[index].file && inputRefs.current[index]?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
              setDragOverSlot(index);
            }}
            onDragLeave={() => setDragOverSlot((i) => (i === index ? null : i))}
            onDrop={(e) => handleDrop(e, index)}
            animate={{
              borderColor: dragOverSlot === index ? "#1a1a1a" : "#e5e5e5",
              scale: dragOverSlot === index ? 1.02 : 1,
            }}
            transition={{ duration: 0.2 }}
            className={`relative flex min-h-[140px] cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed transition-colors ${
              slots[index].file
                ? "border-charcoal/30 bg-offwhite"
                : "border-border bg-white hover:border-charcoal/30"
            }`}
          >
            <input
              ref={(el) => {
                inputRefs.current[index] = el;
              }}
              type="file"
              accept="image/*"
              onChange={(e) => handleChange(e, index)}
              className="hidden"
            />

            {slots[index].previewUrl ? (
              <div className="relative flex h-full w-full items-center justify-center p-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={slots[index].previewUrl!}
                  alt={labels[index]}
                  className="max-h-28 rounded-lg object-contain"
                />
                <button
                  onClick={(e) => clearSlot(e, index)}
                  className="absolute top-2 right-2 flex h-6 w-6 items-center justify-center rounded-full bg-charcoal/80 text-white transition-colors hover:bg-charcoal"
                >
                  <X size={12} />
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 px-4 py-6 text-center">
                <Upload size={20} className="text-muted/60" strokeWidth={1.5} />
                <p className="text-xs text-muted">{labels[index]}</p>
              </div>
            )}
          </motion.div>
        ))}
      </div>
      {!allFilled && (
        <p className="text-xs text-muted">
          {slots.length - slots.filter((s) => s.file).length} photo(s) remaining
        </p>
      )}
    </div>
  );
}
