"use client";

import { motion } from "framer-motion";

export function ThinkingIndicator() {
  return (
    <motion.div
      className="flex items-center gap-1.5 rounded-full border border-indigo-700/50 bg-indigo-900/60 px-4 py-2 shadow-lg backdrop-blur-sm"
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      role="status"
      aria-live="polite"
    >
      <span className="text-sm font-medium text-indigo-200">Думаю</span>
      <span className="flex gap-1">
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            className="h-1.5 w-1.5 rounded-full bg-indigo-400"
            animate={{
              y: [0, -6, 0],
              opacity: [0.5, 1, 0.5],
            }}
            transition={{
              duration: 0.6,
              repeat: Infinity,
              delay: i * 0.15,
              ease: "easeInOut",
            }}
          />
        ))}
      </span>
    </motion.div>
  );
}
