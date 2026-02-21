"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Mail,
  Phone,
  Share2,
  Download,
  Check,
  MapPin,
  Globe,
  QrCode,
  X,
} from "lucide-react";

const CONTACT = {
  name: "Mor Hayat",
  title: "CEO",
  company: "Fashion AI",
  email: "hayatmor@gmail.com",
  phone: "+972-542600177",
  phoneClean: "+972542600177",
  website: "https://fashionai.studio",
  location: "Tel Aviv, Israel",
};

const VCARD = `BEGIN:VCARD
VERSION:3.0
FN:${CONTACT.name}
ORG:${CONTACT.company}
TITLE:${CONTACT.title}
TEL;TYPE=CELL:${CONTACT.phoneClean}
EMAIL:${CONTACT.email}
URL:${CONTACT.website}
ADR;TYPE=WORK:;;${CONTACT.location};;;;
END:VCARD`;

function QrCodeImage() {
  const cardUrl = typeof window !== "undefined" ? window.location.href : CONTACT.website;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&color=C9A96E&bgcolor=0a0a0a&data=${encodeURIComponent(cardUrl)}`;
  return (
    <img
      src={qrUrl}
      alt="QR Code — contact card"
      width={180}
      height={180}
      className="rounded-xl"
    />
  );
}

export default function BusinessCard() {
  const [saved, setSaved] = useState(false);
  const [shared, setShared] = useState(false);
  const [showQr, setShowQr] = useState(false);

  const handleSave = useCallback(() => {
    const blob = new Blob([VCARD], { type: "text/vcard;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "Mor_Hayat_FashionAI.vcf";
    a.click();
    URL.revokeObjectURL(url);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }, []);

  const handleShare = useCallback(async () => {
    const shareData = {
      title: `${CONTACT.name} — ${CONTACT.title} at ${CONTACT.company}`,
      text: `Connect with ${CONTACT.name}, ${CONTACT.title} at ${CONTACT.company}`,
      url: window.location.href,
    };
    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(window.location.href);
        setShared(true);
        setTimeout(() => setShared(false), 2000);
      }
    } catch {
      await navigator.clipboard.writeText(window.location.href);
      setShared(true);
      setTimeout(() => setShared(false), 2000);
    }
  }, []);

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4 sm:p-8 relative overflow-hidden">
      {/* Ambient light */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute top-[-20%] left-[50%] translate-x-[-50%] w-[600px] h-[600px] rounded-full bg-[#C9A96E] opacity-[0.04] blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[400px] h-[400px] rounded-full bg-[#C9A96E] opacity-[0.03] blur-[100px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        className="relative w-full max-w-[420px]"
      >
        {/* Card */}
        <div className="rounded-3xl border border-[#1e1e1e] bg-[#111111] overflow-hidden shadow-2xl shadow-black/40">
          {/* Gold accent bar */}
          <div className="h-1 w-full bg-gradient-to-r from-transparent via-[#C9A96E] to-transparent" />

          {/* Avatar + Identity */}
          <div className="pt-10 pb-6 px-8 text-center">
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.2, duration: 0.5 }}
              className="mx-auto mb-5 w-24 h-24 rounded-full bg-gradient-to-br from-[#C9A96E] to-[#9A7B4F] flex items-center justify-center text-[#0a0a0a] text-3xl font-serif font-bold tracking-tight"
            >
              MH
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.5 }}
              className="text-2xl sm:text-3xl font-serif font-semibold text-white tracking-tight"
            >
              {CONTACT.name}
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.5 }}
              className="mt-1.5 text-[#C9A96E] font-medium text-sm tracking-wide"
            >
              {CONTACT.title}
            </motion.p>

            <motion.p
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.45, duration: 0.5 }}
              className="mt-0.5 text-[#888] text-sm"
            >
              {CONTACT.company}
            </motion.p>
          </div>

          {/* Divider */}
          <div className="mx-8 h-px bg-[#1e1e1e]" />

          {/* Contact links */}
          <div className="px-6 py-5 space-y-1">
            <ContactRow
              icon={<Mail size={18} />}
              label={CONTACT.email}
              href={`mailto:${CONTACT.email}`}
              delay={0.5}
            />
            <ContactRow
              icon={<Phone size={18} />}
              label={CONTACT.phone}
              href={`https://wa.me/${CONTACT.phoneClean.replace(/[^0-9]/g, "")}`}
              delay={0.55}
            />
            <ContactRow
              icon={<MapPin size={18} />}
              label={CONTACT.location}
              href={`https://maps.google.com/?q=${encodeURIComponent(CONTACT.location)}`}
              delay={0.65}
              external
            />
          </div>

          {/* Divider */}
          <div className="mx-8 h-px bg-[#1e1e1e]" />

          {/* QR section */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.7, duration: 0.5 }}
            className="px-6 py-5 text-center"
          >
            <button
              onClick={() => setShowQr((v) => !v)}
              className="inline-flex items-center gap-2 text-xs text-[#888] hover:text-[#C9A96E] transition-colors cursor-pointer"
            >
              <QrCode size={14} />
              {showQr ? "Hide QR Code" : "Show QR Code"}
            </button>

            <AnimatePresence>
              {showQr && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                  className="overflow-hidden"
                >
                  <div className="pt-4 pb-2 flex flex-col items-center">
                    <div className="p-3 bg-[#0a0a0a] rounded-2xl border border-[#1e1e1e]">
                      <QrCodeImage />
                    </div>
                    <p className="mt-3 text-[10px] text-[#555] tracking-wider uppercase">
                      Scan to save contact
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          {/* Divider */}
          <div className="mx-8 h-px bg-[#1e1e1e]" />

          {/* Action buttons */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.75, duration: 0.5 }}
            className="px-6 py-5 flex gap-3"
          >
            <button
              onClick={handleSave}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-[#C9A96E] to-[#B8944E] text-[#0a0a0a] text-sm font-semibold hover:brightness-110 active:scale-[0.98] transition-all cursor-pointer"
            >
              {saved ? <Check size={16} /> : <Download size={16} />}
              {saved ? "Saved!" : "Save Contact"}
            </button>
            <button
              onClick={handleShare}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border border-[#2a2a2a] bg-[#161616] text-[#ccc] text-sm font-medium hover:border-[#C9A96E] hover:text-[#C9A96E] active:scale-[0.98] transition-all cursor-pointer"
            >
              {shared ? <Check size={16} /> : <Share2 size={16} />}
              {shared ? "Copied!" : "Share"}
            </button>
          </motion.div>

          {/* Footer */}
          <div className="px-8 pb-6 pt-1 text-center">
            <div className="h-px bg-[#1e1e1e] mb-4" />
            <a
              href="/"
              className="inline-flex items-center gap-1.5 text-[10px] text-[#444] hover:text-[#C9A96E] transition-colors tracking-widest uppercase"
            >
              <Globe size={10} />
              Fashion AI
            </a>
          </div>
        </div>
      </motion.div>

      {/* QR overlay for mobile share */}
      <AnimatePresence>
        {showQr && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-6 sm:hidden"
            onClick={() => setShowQr(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-[#111] rounded-2xl border border-[#1e1e1e] p-6 text-center"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => setShowQr(false)}
                className="absolute top-4 right-4 text-[#555] hover:text-white"
              >
                <X size={20} />
              </button>
              <div className="p-3 bg-[#0a0a0a] rounded-2xl border border-[#1e1e1e] inline-block">
                <QrCodeImage />
              </div>
              <p className="mt-3 text-xs text-[#888]">
                Scan to save contact
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ContactRow({
  icon,
  label,
  href,
  delay,
  external,
}: {
  icon: React.ReactNode;
  label: string;
  href: string;
  delay: number;
  external?: boolean;
}) {
  return (
    <motion.a
      href={href}
      target={external ? "_blank" : undefined}
      rel={external ? "noopener noreferrer" : undefined}
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay, duration: 0.4, ease: "easeOut" }}
      className="flex items-center gap-4 px-3 py-3 rounded-xl hover:bg-[#1a1a1a] transition-colors group"
    >
      <span className="w-9 h-9 flex items-center justify-center rounded-full bg-[#1a1a1a] border border-[#222] text-[#C9A96E] group-hover:border-[#C9A96E] transition-colors flex-shrink-0">
        {icon}
      </span>
      <span className="text-sm text-[#ccc] group-hover:text-white transition-colors truncate">
        {label}
      </span>
    </motion.a>
  );
}
