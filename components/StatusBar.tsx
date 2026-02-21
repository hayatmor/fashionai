"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, CheckCircle2, XCircle, Clock } from "lucide-react";

export type Status = "idle" | "loading" | "success" | "error";

interface StatusBarProps {
  status: Status;
  error?: string | null;
  startTime?: number | null;
}

function ElapsedTimer({ startTime }: { startTime: number }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [startTime]);

  const minutes = Math.floor(elapsed / 60);
  const seconds = elapsed % 60;
  const display = minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;

  return (
    <span className="flex items-center gap-1 text-xs tabular-nums text-muted">
      <Clock size={12} />
      {display}
    </span>
  );
}

export default function StatusBar({ status, error, startTime }: StatusBarProps) {
  if (status === "idle") return null;

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={status}
        initial={{ opacity: 0, height: 0 }}
        animate={{ opacity: 1, height: "auto" }}
        exit={{ opacity: 0, height: 0 }}
        transition={{ duration: 0.3 }}
        className="overflow-hidden"
      >
        {status === "loading" && (
          <div className="flex flex-col gap-2 rounded-lg border border-charcoal/10 bg-offwhite px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-charcoal">
                <Loader2 size={16} className="animate-spin" />
                <span>Generating with Nano Banana...</span>
              </div>
              {startTime && <ElapsedTimer startTime={startTime} />}
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-charcoal/10">
              <motion.div
                className="h-full rounded-full bg-charcoal/60"
                initial={{ width: "0%" }}
                animate={{ width: "85%" }}
                transition={{ duration: 30, ease: "easeOut" }}
              />
            </div>
            <p className="text-xs text-muted">
              This typically takes 15-40 seconds...
            </p>
          </div>
        )}

        {status === "success" && (
          <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
            <CheckCircle2 size={16} />
            <span>Image generated successfully!</span>
          </div>
        )}

        {status === "error" && (
          <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            <XCircle size={16} className="mt-0.5 shrink-0" />
            <span>{error || "An unexpected error occurred. Please try again."}</span>
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
