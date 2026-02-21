"use client";

import { motion } from "framer-motion";

export default function Header() {
  return (
    <motion.header
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, ease: "easeOut" }}
      className="sticky top-0 z-50 flex items-center justify-between border-b border-border/60 bg-white/80 px-8 py-5 backdrop-blur-md md:px-16"
    >
      <a href="/" className="font-serif text-2xl tracking-wide text-charcoal">
        Fashion AI
      </a>
      <nav className="flex items-center gap-8">
        <a
          href="#studios"
          className="text-sm tracking-widest uppercase text-muted transition-colors hover:text-charcoal"
        >
          Gallery
        </a>
        <a
          href="/presentation.html"
          className="text-sm tracking-widest uppercase text-muted transition-colors hover:text-charcoal"
        >
          Presentation
        </a>
      </nav>
    </motion.header>
  );
}
