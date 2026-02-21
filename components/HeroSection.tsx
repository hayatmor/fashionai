"use client";

import { motion } from "framer-motion";

export default function HeroSection() {
  return (
    <section className="flex flex-col items-center justify-center px-6 py-32 text-center md:py-44">
      <motion.h1
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1, ease: "easeOut" }}
        className="max-w-3xl font-serif text-5xl leading-tight tracking-tight text-charcoal md:text-7xl md:leading-[1.1]"
      >
        Transform Your Vision into Fashion Reality
      </motion.h1>
      <motion.p
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1, delay: 0.3, ease: "easeOut" }}
        className="mt-8 max-w-lg text-lg leading-relaxed text-muted"
      >
        AI-powered creative studio for luxury product photography,
        social&nbsp;media content, and editorial&nbsp;shoots.
      </motion.p>
    </section>
  );
}
