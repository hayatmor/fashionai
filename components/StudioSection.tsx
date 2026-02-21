"use client";

import { motion } from "framer-motion";
import StudioModule from "./StudioModule";
import {
  ECOMMERCE_PROMPT,
  SOCIAL_CREATIVE_PROMPT,
  EDITORIAL_MODEL_PROMPT,
  LIFESTYLE_EDITORIAL_PROMPT,
  VENEZIA_PROMPT,
  MACRO_LOGO_PROMPT,
  HUGGING_BAG_PROMPT,
  CHAIR_MODEL_PROMPT,
  MALE_MODEL_PROMPT,
} from "@/lib/prompts";

const modules = [
  { title: "E-Commerce Studio", prompt: ECOMMERCE_PROMPT },
  { title: "Social Creative (1:1)", prompt: SOCIAL_CREATIVE_PROMPT },
  { title: "Editorial Model Shot", prompt: EDITORIAL_MODEL_PROMPT },
  { title: "Lifestyle Editorial", prompt: LIFESTYLE_EDITORIAL_PROMPT },
  { title: "Venezia", prompt: VENEZIA_PROMPT },
  { title: "Macro Logo Close-Up", prompt: MACRO_LOGO_PROMPT },
  { title: "Vibe — Hugging the Bag", prompt: HUGGING_BAG_PROMPT },
  { title: "Chair & Model", prompt: CHAIR_MODEL_PROMPT },
  { title: "Male Model Wearing Bag", prompt: MALE_MODEL_PROMPT },
];

export default function StudioSection() {
  return (
    <section id="studios" className="px-6 pb-32 md:px-16">
      <motion.h2
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.7 }}
        className="mb-14 text-center font-serif text-3xl tracking-tight text-charcoal md:text-4xl"
      >
        Creative Studios
      </motion.h2>
      <div className="mx-auto grid max-w-6xl gap-8 md:grid-cols-2 lg:grid-cols-3">
        {modules.map((mod, i) => (
          <StudioModule
            key={mod.title}
            title={mod.title}
            prompt={mod.prompt}
            index={i}
          />
        ))}
      </div>
    </section>
  );
}
