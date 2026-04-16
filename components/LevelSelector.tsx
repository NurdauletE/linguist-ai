"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export type CEFRLevel = "A1" | "A2" | "B1" | "B2" | "C1" | "C2";

interface LevelSelectorProps {
  currentLevel: CEFRLevel;
  onLevelChange: (level: CEFRLevel) => void;
  disabled?: boolean;
}

const levels: { id: CEFRLevel; label: string; description: string }[] = [
  { id: "A1", label: "Beginner / Starter", description: "Basic phrases and simple sentences" },
  { id: "A2", label: "Elementary", description: "Routine tasks and basic information" },
  { id: "B1", label: "Intermediate", description: "Main points on familiar matters" },
  { id: "B2", label: "Upper-Intermediate", description: "Complex text and technical discussion" },
  { id: "C1", label: "Advanced", description: "Fluent, spontaneous expression" },
  { id: "C2", label: "Proficiency", description: "Ease in virtually everything heard or read" },
];

export function LevelSelector({ currentLevel, onLevelChange, disabled }: LevelSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative z-20" ref={containerRef}>
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`group flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5 backdrop-blur-md transition-all duration-300 hover:bg-white/10 ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer shadow-lg"}`}
      >
        <div className="flex flex-col items-start transition-transform group-hover:scale-[1.02]">
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-indigo-300/80">
            Language Level
          </span>
          <span className="text-sm font-semibold text-white tracking-wide">
            {levels.find((l) => l.id === currentLevel)?.label} ({currentLevel})
          </span>
        </div>
        <ChevronDown
          className={`h-4 w-4 text-indigo-300 transition-transform duration-300 ${isOpen ? "rotate-180" : ""}`}
        />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ type: "spring", damping: 20, stiffness: 300 }}
            className="absolute top-full left-1/2 mt-4 w-64 -translate-x-1/2 overflow-hidden rounded-2xl border border-white/20 bg-indigo-900/40 p-1.5 shadow-2xl backdrop-blur-xl"
          >
            <div className="flex flex-col gap-1">
              {levels.map((level) => (
                <button
                  key={level.id}
                  onClick={() => {
                    onLevelChange(level.id);
                    setIsOpen(false);
                  }}
                  className={`flex w-full flex-col items-start rounded-xl px-3 py-2 text-left transition-all duration-200 ${
                    currentLevel === level.id
                      ? "bg-indigo-500/40 text-white shadow-inner"
                      : "text-indigo-100 hover:bg-white/10"
                  }`}
                >
                  <div className="flex w-full items-center justify-between">
                    <span className="text-xs font-bold tracking-wider">{level.label}</span>
                    <span className={`text-[10px] font-black ${currentLevel === level.id ? "text-indigo-200" : "text-indigo-400"}`}>
                      {level.id}
                    </span>
                  </div>
                  <span className={`text-[10px] opacity-60 leading-tight ${currentLevel === level.id ? "text-indigo-100" : "text-indigo-200"}`}>
                    {level.description}
                  </span>
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
