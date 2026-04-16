"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  SpeechRecognitionEvent,
  SpeechRecognitionInstance,
} from "@/types/speech";

/** Язык синтеза ответов ИИ (репетитор говорит по-английски) */
const SPEECH_LANG = "en-US";

/**
 * Длинные тексты браузер иногда «обрубает» посередине.
 * Разбиваем ответ на небольшие фрагменты и озвучиваем их по очереди.
 */
function splitTextIntoChunks(text: string, maxLength = 180): string[] {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) return [];

  const sentences: string[] = [];
  let current = "";

  for (const ch of normalized) {
    current += ch;
    if (/[.!?]/.test(ch)) {
      sentences.push(current);
      current = "";
    }
  }
  if (current.trim()) {
    sentences.push(current);
  }

  const chunks: string[] = [];

  for (const sentence of sentences) {
    if (sentence.length <= maxLength) {
      chunks.push(sentence.trim());
      continue;
    }

    const words = sentence.split(/\s+/);
    let chunk = "";

    for (const word of words) {
      const next = chunk ? `${chunk} ${word}` : word;
      if (next.length > maxLength && chunk) {
        chunks.push(chunk.trim());
        chunk = word;
      } else {
        chunk = next;
      }
    }

    if (chunk.trim()) {
      chunks.push(chunk.trim());
    }
  }

  return chunks.filter(Boolean);
}

/** Бесплатный STT в браузере: Web Speech API (Chrome/Edge). Поддержка RU и EN. */
export const RECOGNITION_LANGS = {
  ru: "ru-RU",
  en: "en-US",
  both: "ru-RU, en-US",
} as const;

export type RecognitionLangKey = keyof typeof RECOGNITION_LANGS;

export interface UseVoiceOptions {
  /** Язык распознавания: один язык точнее, "both" — оба (RU+EN) */
  recognitionLang?: keyof typeof RECOGNITION_LANGS;
}

export interface UseVoiceReturn {
  transcript: string;
  interimTranscript: string;
  isListening: boolean;
  isSpeaking: boolean;
  error: string | null;
  /** Текущий выбранный язык распознавания (для подсветки кнопки) */
  recognitionLang: RecognitionLangKey;
  startListening: () => void;
  stopListening: (onStopped?: (text: string) => void) => void;
  speak: (text: string) => void;
  resetTranscript: () => void;
  setRecognitionLang: (key: RecognitionLangKey) => void;
}

export function useVoice(options: UseVoiceOptions = {}): UseVoiceReturn {
  const { recognitionLang: initialLang = "both" } = options;
  const [recognitionLangKey, setRecognitionLangKey] =
    useState<RecognitionLangKey>(initialLang);
  const langString = RECOGNITION_LANGS[recognitionLangKey];

  const [transcript, setTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const synthRef = useRef<SpeechSynthesis | null>(null);
  const userRequestedStopRef = useRef(false);
  const transcriptRef = useRef("");
  const onStoppedRef = useRef<((text: string) => void) | null>(null);

  useEffect(() => {
    transcriptRef.current = transcript;
  }, [transcript]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const Recognition =
      window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!Recognition) {
      setError(
        "Распознавание речи не поддерживается в этом браузере. Используйте Chrome или Edge."
      );
      return;
    }
    recognitionRef.current = new Recognition();
    recognitionRef.current.continuous = true;
    recognitionRef.current.interimResults = true;
    recognitionRef.current.lang = langString;

    recognitionRef.current.onresult = (event: SpeechRecognitionEvent) => {
      let finalPart = "";
      let interimPart = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const text = result[0]?.transcript ?? "";
        if (result.isFinal) {
          finalPart += text;
          interimPart = "";
        } else {
          interimPart = text;
        }
      }
      if (finalPart) {
        setTranscript((prev) => {
          const next = (prev ? `${prev} ${finalPart}` : finalPart).trim();
          transcriptRef.current = next;
          return next;
        });
      }
      setInterimTranscript(interimPart);
    };

    recognitionRef.current.onend = () => {
      if (userRequestedStopRef.current) {
        userRequestedStopRef.current = false;
        setIsListening(false);
        const cb = onStoppedRef.current;
        onStoppedRef.current = null;
        cb?.(transcriptRef.current);
        return;
      }
      const rec = recognitionRef.current;
      if (rec) {
        setTimeout(() => {
          try {
            rec.start();
          } catch {
            setIsListening(false);
          }
        }, 50);
      } else {
        setIsListening(false);
      }
    };

    recognitionRef.current.onerror = (e: Event & { error?: string }) => {
      if (e.error !== "aborted") {
        setError(e.error ?? "Ошибка распознавания речи");
      }
    };

    synthRef.current = window.speechSynthesis;
    return () => {
      recognitionRef.current?.abort();
      synthRef.current?.cancel();
    };
  }, [langString]);

  const startListening = useCallback(() => {
    userRequestedStopRef.current = false;
    onStoppedRef.current = null;
    setError(null);
    setTranscript("");
    setInterimTranscript("");
    transcriptRef.current = "";
    try {
      recognitionRef.current?.start();
      setIsListening(true);
    } catch {
      setError("Не удалось включить микрофон");
    }
  }, []);

  const stopListening = useCallback((onStopped?: (text: string) => void) => {
    userRequestedStopRef.current = true;
    onStoppedRef.current = onStopped ?? null;
    setInterimTranscript("");
    recognitionRef.current?.stop();
    setIsListening(false);
  }, []);

  const speak = useCallback((text: string) => {
    const synth = synthRef.current;
    if (!synth) return;

    const chunks = splitTextIntoChunks(text);
    if (!chunks.length) return;

    // Останавливаем любую предыдущую озвучку и начинаем новую очередь
    synth.cancel();
    setIsSpeaking(true);

    let completed = 0;
    let hasError = false;

    chunks.forEach((chunk, index) => {
      const utterance = new SpeechSynthesisUtterance(chunk);
      utterance.lang = SPEECH_LANG;
      utterance.rate = 1.0;

      utterance.onend = () => {
        completed += 1;
        if (completed === chunks.length) {
          setIsSpeaking(false);
        }
      };

      utterance.onerror = () => {
        if (!hasError) {
          hasError = true;
          setIsSpeaking(false);
        }
      };

      synth.speak(utterance);
    });
  }, []);

  const resetTranscript = useCallback(() => setTranscript(""), []);
  const setRecognitionLang = useCallback((key: RecognitionLangKey) => {
    setRecognitionLangKey(key);
  }, []);

  return {
    transcript,
    interimTranscript,
    isListening,
    isSpeaking,
    error,
    recognitionLang: recognitionLangKey,
    startListening,
    stopListening,
    speak,
    resetTranscript,
    setRecognitionLang,
  };
}

