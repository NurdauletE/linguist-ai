"use client";

import { useCallback, useMemo, useState, useRef, useEffect } from "react";
import { Mic, Languages, Send, Pencil, Check, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Avatar, AvatarChatIcon } from "@/components/Avatar";
import { ThinkingIndicator } from "@/components/ThinkingIndicator";
import { TestComponent } from "@/components/TestComponent";
import { LevelSelector, type CEFRLevel } from "@/components/LevelSelector";
import { useVoice } from "@/hooks/useVoice";
import type { AvatarState, DialogueMessage } from "@/types/dialogue";
import type { ChatResponseBody } from "@/types/chat-api";

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function getFallbackReply(userText: string): string {
  const said = userText.trim() || "(nothing heard)";
  return `I heard you! You said: "${said}". Let's practice!`;
}

async function punctuateText(text: string): Promise<string> {
  if (!text.trim()) return text;
  try {
    const res = await fetch("/api/punctuate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) return text;
    const data = (await res.json()) as { text?: string };
    return typeof data.text === "string" ? data.text : text;
  } catch {
    return text;
  }
}

async function sendChat(message: string, level: CEFRLevel): Promise<ChatResponseBody> {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, level }),
  });
  if (!res.ok) {
    const d = (await res.json()) as { error?: string };
    throw new Error(d.error ?? res.statusText);
  }
  return res.json() as Promise<ChatResponseBody>;
}

export default function HomePage() {
  const {
    transcript,
    interimTranscript,
    isListening,
    isSpeaking,
    error,
    recognitionLang,
    startListening,
    stopListening,
    speak,
    resetTranscript,
    setRecognitionLang,
  } = useVoice({ recognitionLang: "both" });

  const liveTranscript = [transcript, interimTranscript].filter(Boolean).join(" ");

  const [messages, setMessages] = useState<DialogueMessage[]>([]);
  const [cefrLevel, setCefrLevel] = useState<CEFRLevel>("B1");
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [translations, setTranslations] = useState<Record<string, string>>({});
  const [translatingId, setTranslatingId] = useState<string | null>(null);
  const [textInput, setTextInput] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const testTopicsRef = useRef<Record<string, string>>({});
  
  // Selection translation popup state
  const [selectionPopup, setSelectionPopup] = useState<{
    text: string;
    translation: string | null;
    position: { x: number; y: number };
    visible: boolean;
    loading: boolean;
  } | null>(null);
  const selectionTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const avatarState: AvatarState = useMemo(() => {
    if (isListening) return "listening";
    if (isSpeaking) return "speaking";
    if (chatLoading) return "thinking";
    return "idle";
  }, [isListening, isSpeaking, chatLoading]);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const processAndSendMessage = useCallback(
    async (rawText: string, fromSpeech: boolean) => {
      let textToSend = rawText.trim() || (fromSpeech ? "(no speech detected)" : "");
      if (fromSpeech && textToSend !== "(no speech detected)") {
        textToSend = await punctuateText(textToSend);
      }
      if (!textToSend || textToSend === "(no speech detected)") return null;

      setChatError(null);
      setChatLoading(true);

      try {
        const data = await sendChat(textToSend, cefrLevel);
        const aiMsg: DialogueMessage = {
          id: generateId(),
          role: "assistant",
          text: data.reply_text,
          correction: data.correction ?? null,
          explanation: data.explanation ?? null,
          test: data.test ?? null,
          createdAt: new Date(),
        };
        // Store topic for test if test is present
        if (data.test) {
          testTopicsRef.current[aiMsg.id] = textToSend;
        }
        speak(data.reply_text);
        return { textToSend, aiMsg };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Chat request failed";
        setChatError(msg);
        const fallback = getFallbackReply(rawText);
        const aiMsg: DialogueMessage = {
          id: generateId(),
          role: "assistant",
          text: fallback,
          correction: null,
          explanation: null,
          createdAt: new Date(),
        };
        speak(fallback);
        return { textToSend, aiMsg };
      } finally {
        setChatLoading(false);
      }
    },
    [speak]
  );

  const handleMicClick = useCallback(() => {
    if (isListening) {
      stopListening(async (userTextRaw) => {
        const userText = (userTextRaw ?? "").trim();
        resetTranscript();

        const userMsg: DialogueMessage = {
          id: generateId(),
          role: "user",
          text: userText || "(no speech detected)",
          createdAt: new Date(),
        };
        setMessages((prev) => [...prev, userMsg]);

        const result = await processAndSendMessage(userText || "", true);
        if (result) {
          setMessages((prev) => [...prev, result.aiMsg]);
        } else if (userText) {
          setMessages((prev) => prev.slice(0, -1));
        }
      });
    } else {
      startListening();
    }
  }, [isListening, stopListening, startListening, resetTranscript, processAndSendMessage]);

  const handleSendText = useCallback(() => {
    const trimmed = textInput.trim();
    if (!trimmed || chatLoading) return;

    setTextInput("");
    const userMsg: DialogueMessage = {
      id: generateId(),
      role: "user",
      text: trimmed,
      createdAt: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);

    processAndSendMessage(trimmed, false).then((result) => {
      if (result) setMessages((prev) => [...prev, result.aiMsg]);
    });
  }, [textInput, chatLoading, processAndSendMessage]);

  const handleEditStart = useCallback((msg: DialogueMessage) => {
    if (msg.role !== "user") return;
    setEditingId(msg.id);
    setEditValue(msg.text);
  }, []);

  const handleEditSave = useCallback(
    async (msgId: string) => {
      const newText = editValue.trim();
      if (!newText) {
        setEditingId(null);
        setEditValue("");
        return;
      }

      setEditingId(null);
      setEditValue("");
      setMessages((prev) => {
        const updated = prev.map((m) => (m.id === msgId ? { ...m, text: newText } : m));
        const idx = prev.findIndex((m) => m.id === msgId);
        const nextIdx = idx + 1;
        const followingAi = prev[nextIdx]?.role === "assistant" ? prev[nextIdx] : null;
        return followingAi ? updated.filter((m) => m.id !== followingAi.id) : updated;
      });
      setChatLoading(true);
      setChatError(null);

      try {
        const data = await sendChat(newText, cefrLevel);
        const aiMsg: DialogueMessage = {
          id: generateId(),
          role: "assistant",
          text: data.reply_text,
          correction: data.correction ?? null,
          explanation: data.explanation ?? null,
          test: data.test ?? null,
          createdAt: new Date(),
        };
        setMessages((prev) => [...prev, aiMsg]);
        speak(data.reply_text);
      } catch (err: unknown) {
        setChatError(err instanceof Error ? err.message : "Chat request failed");
      } finally {
        setChatLoading(false);
      }
    },
    [editValue, speak]
  );

  const handleEditCancel = useCallback(() => {
    setEditingId(null);
    setEditValue("");
  }, []);

  const handleTranslate = useCallback((messageId: string, text: string) => {
    if (translations[messageId]) return;
    setTranslatingId(messageId);
    fetch("/api/translate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    })
      .then((res) => {
        if (!res.ok) return res.json().then((d) => Promise.reject(new Error((d as { error?: string }).error ?? res.statusText)));
        return res.json() as Promise<{ translation: string }>;
      })
      .then((data) => {
        setTranslations((prev) => ({ ...prev, [messageId]: data.translation }));
      })
      .catch(() => {
        setTranslations((prev) => ({ ...prev, [messageId]: "Не удалось перевести." }));
      })
      .finally(() => setTranslatingId(null));
  }, [translations]);

  // Handle text selection for translation
  useEffect(() => {
    const handleMouseUp = () => {
      const selection = window.getSelection();
      const selectedText = selection?.toString().trim();

      // Clear previous timeout
      if (selectionTimeoutRef.current) {
        clearTimeout(selectionTimeoutRef.current);
      }

      if (!selectedText || selectedText.length === 0) {
        setSelectionPopup(null);
        return;
      }

      // Get selection position
      const range = selection?.getRangeAt(0);
      if (!range) {
        setSelectionPopup(null);
        return;
      }

      const rect = range.getBoundingClientRect();
      const scrollY = window.scrollY || window.pageYOffset;
      const scrollX = window.scrollX || window.pageXOffset;

      // Position popup above selection
      const popupX = rect.left + scrollX + rect.width / 2;
      const popupY = rect.top + scrollY - 10;

      // Show popup immediately with loading state
      setSelectionPopup({
        text: selectedText,
        translation: null,
        position: { x: popupX, y: popupY },
        visible: true,
        loading: true,
      });

      // Translate after a short delay (debounce)
      selectionTimeoutRef.current = setTimeout(async () => {
        try {
          const res = await fetch("/api/translate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: selectedText }),
          });

          if (!res.ok) {
            throw new Error("Translation failed");
          }

          const data = (await res.json()) as { translation: string };
          setSelectionPopup((prev) =>
            prev
              ? {
                  ...prev,
                  translation: data.translation,
                  loading: false,
                }
              : null
          );
        } catch {
          setSelectionPopup((prev) =>
            prev
              ? {
                  ...prev,
                  translation: "Не удалось перевести",
                  loading: false,
                }
              : null
          );
        }
      }, 300);
    };

    // Close popup when clicking outside or when selection is cleared
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Element;
      if (!target.closest(".selection-popup")) {
        const selection = window.getSelection();
        if (!selection || selection.toString().trim() === "") {
          setSelectionPopup(null);
        }
      }
    };

    // Close popup when selection changes
    const handleSelectionChange = () => {
      const selection = window.getSelection();
      if (!selection || selection.toString().trim() === "") {
        if (selectionTimeoutRef.current) {
          clearTimeout(selectionTimeoutRef.current);
        }
        setSelectionPopup(null);
      }
    };

    document.addEventListener("mouseup", handleMouseUp);
    document.addEventListener("click", handleClickOutside);
    document.addEventListener("selectionchange", handleSelectionChange);

    return () => {
      document.removeEventListener("mouseup", handleMouseUp);
      document.removeEventListener("click", handleClickOutside);
      document.removeEventListener("selectionchange", handleSelectionChange);
      if (selectionTimeoutRef.current) {
        clearTimeout(selectionTimeoutRef.current);
      }
    };
  }, []);

  return (
    <main className="grid h-screen grid-cols-5 overflow-hidden bg-[var(--background)] text-slate-800">
      {/* Sidebar with Glassmorphism and Blur Spots */}
      <aside className="col-span-2 relative flex h-full flex-col sidebar-glass px-4 py-8 shadow-2xl overflow-hidden">
        {/* Background Blur Spots */}
        <div className="blur-spot top-[10%] left-[-10%] bg-indigo-500" />
        <div className="blur-spot bottom-[20%] right-[-10%] bg-purple-500" />
        
        <h1 className="relative z-10 shrink-0 text-center text-xl font-bold text-white tracking-widest opacity-90">
          LINGUIST AI
        </h1>

        <div className="flex flex-1 flex-col items-center justify-center gap-6 pt-10">
          <LevelSelector 
            currentLevel={cefrLevel} 
            onLevelChange={setCefrLevel} 
            disabled={chatLoading || isListening}
          />
          <Avatar state={avatarState} className="shrink-0" />

          <p className="text-xs text-indigo-300/80">Язык распознавания</p>
          <div className="relative z-10 flex gap-2 flex-wrap justify-center bg-white/5 p-1 rounded-xl backdrop-blur-sm">
            {(["ru", "en", "both"] as const).map((key) => {
              const isActive = recognitionLang === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => !isListening && setRecognitionLang(key)}
                  disabled={isListening}
                  className={`rounded-lg px-4 py-2 text-xs font-semibold transition-all duration-300 ${
                    isListening
                      ? "cursor-not-allowed opacity-30 text-indigo-400"
                      : isActive
                        ? "bg-indigo-500 text-white shadow-lg shadow-indigo-500/30 scale-105"
                        : "text-indigo-200 hover:bg-white/10"
                  }`}
                  aria-pressed={isActive}
                >
                  {key === "ru" ? "Русский" : key === "en" ? "English" : "Оба"}
                </button>
              );
            })}
          </div>

          <motion.button
            type="button"
            onClick={handleMicClick}
            className={`relative z-10 flex h-14 w-14 items-center justify-center rounded-full bg-indigo-600 text-indigo-100 shadow-2xl transition-all duration-300 hover:bg-indigo-500 hover:scale-105 active:scale-95 ${isListening ? "animate-pulse-glow bg-red-500" : ""}`}
            aria-label={isListening ? "Stop listening" : "Start listening"}
          >
            <Mic className={`h-6 w-6 ${isListening ? "animate-pulse" : ""}`} strokeWidth={2.5} />
          </motion.button>

          <AnimatePresence mode="wait">
            {chatLoading && (
              <motion.div
                key="thinking"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.2 }}
              >
                <ThinkingIndicator />
              </motion.div>
            )}
          </AnimatePresence>

          {isListening && (
            <motion.div
              className="w-full relative z-10 min-h-[2.5rem] rounded-xl border border-white/10 bg-white/5 py-2 px-3 backdrop-blur-md shadow-inner text-center"
              role="status"
              aria-live="polite"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <p className="text-[10px] font-bold uppercase tracking-widest text-indigo-300">
                Listening...
              </p>
              <p className="mt-1 text-sm text-white font-medium">
                {liveTranscript || (
                    <span className="opacity-50">Speak now...</span>
                )}
              </p>
            </motion.div>
          )}

          {(error || chatError) && (
            <p className="relative z-10 max-w-full text-center text-xs font-semibold text-amber-400" role="alert">
              {error ?? chatError}
            </p>
          )}
        </div>
      </aside>

      <div className="col-span-3 flex min-h-0 flex-col overflow-hidden bg-[var(--background)] relative">
        {/* Selection translation popup */}
        <AnimatePresence>
          {selectionPopup?.visible && (
            <motion.div
              className="selection-popup fixed z-50 max-w-xs rounded-xl border border-slate-200 bg-white/90 backdrop-blur-md px-4 py-3 shadow-2xl pointer-events-none"
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 5 }}
              transition={{ duration: 0.2 }}
              style={{
                left: `${selectionPopup.position.x}px`,
                top: `${selectionPopup.position.y}px`,
                transform: "translate(-50%, -100%)",
                marginTop: "-12px",
              }}
              onMouseDown={(e) => e.preventDefault()}
            >
              {selectionPopup.loading ? (
                <div className="text-xs text-slate-600 font-medium">Translating...</div>
              ) : selectionPopup.translation ? (
                <div className="space-y-1">
                  <div className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider">Translation:</div>
                  <div className="text-sm text-slate-800 leading-snug">{selectionPopup.translation}</div>
                </div>
              ) : (
                <div className="text-xs text-red-500 font-medium">Translation error</div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        <section
          className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-8 py-8 scroll-smooth overscroll-contain"
          aria-label="Dialogue"
        >
          {messages.length === 0 ? (
            <div className="flex h-full items-center justify-center text-slate-500">
              <p className="max-w-sm text-center text-sm leading-relaxed">
                Нажмите микрофон или введите сообщение внизу. Linguist AI ответит и проверит грамматику.
              </p>
            </div>
          ) : (
            <div className="mx-auto max-w-2xl space-y-4">
              <AnimatePresence mode="popLayout">
                {messages.map((msg) => (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className={`flex gap-2 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    {msg.role === "assistant" && (
                      <AvatarChatIcon className="mt-1" />
                    )}
                    <div className={`flex max-w-[85%] gap-2 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
                      <div
                        className={`rounded-[24px] px-6 py-4 shadow-xl shadow-slate-200/50 backdrop-blur-sm ${
                          msg.role === "user"
                            ? "bg-indigo-600 text-right text-indigo-50"
                            : "glass-card text-left text-slate-800"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className={`text-xs font-medium ${msg.role === "user" ? "text-indigo-200" : "text-slate-500"}`}>
                            {msg.role === "user" ? "You" : "Linguist AI"}
                          </span>
                          {msg.role === "user" && !editingId && (
                            <button
                              type="button"
                              onClick={() => handleEditStart(msg)}
                              className="p-1 rounded hover:bg-indigo-500/50 text-indigo-200"
                              aria-label="Редактировать"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>

                        {editingId === msg.id ? (
                          <div className="mt-2 space-y-2">
                            <textarea
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              className="w-full min-h-[60px] rounded-lg border border-indigo-400/50 bg-indigo-900/30 px-3 py-2 text-sm text-indigo-50 placeholder-indigo-300/50 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                              placeholder="Редактировать сообщение..."
                              autoFocus
                            />
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => handleEditSave(msg.id)}
                                className="inline-flex items-center gap-1 rounded-lg bg-indigo-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-400"
                              >
                                <Check className="h-3.5 w-3.5" /> Сохранить
                              </button>
                              <button
                                type="button"
                                onClick={handleEditCancel}
                                className="inline-flex items-center gap-1 rounded-lg bg-slate-600 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-500"
                              >
                                <X className="h-3.5 w-3.5" /> Отмена
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="mt-1 text-sm whitespace-pre-line">
                              {msg.text.split(/(\*\*.*?\*\*)/).map((part, i) => {
                                if (part.startsWith("**") && part.endsWith("**")) {
                                  return <strong key={i} className="font-bold text-indigo-400">{part.slice(2, -2)}</strong>;
                                }
                                return part;
                              })}
                            </div>
                            {msg.correction != null && msg.correction !== "" && (
                              <p className="mt-2 text-xs font-medium text-amber-700 whitespace-pre-line">
                                Correction: {msg.correction}
                              </p>
                            )}
                            {msg.explanation != null && msg.explanation !== "" && (
                              <p className="mt-1 text-xs text-slate-500 whitespace-pre-line">
                                {msg.explanation}
                              </p>
                            )}
                            {msg.test && (
                              <TestComponent
                                test={msg.test}
                                testId={msg.id}
                                topic={testTopicsRef.current[msg.id] || "English"}
                              />
                            )}
                            {msg.role === "assistant" && (
                              <div className="mt-2 pt-2 border-t border-slate-200">
                                <button
                                  type="button"
                                  onClick={() => handleTranslate(msg.id, msg.text)}
                                  disabled={translatingId === msg.id}
                                  className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-700 disabled:opacity-50"
                                >
                                  <Languages className="h-3.5 w-3.5" />
                                  {translatingId === msg.id ? "Перевод…" : "Перевести"}
                                </button>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                      {msg.role === "assistant" && translations[msg.id] && (
                        <div className="shrink-0 w-48 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-left">
                          <p className="text-xs font-medium text-slate-500">Перевод:</p>
                          <p className="mt-0.5 text-sm text-slate-700">{translations[msg.id]}</p>
                        </div>
                      )}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
              <div ref={messagesEndRef} />
            </div>
          )}
        </section>

        {/* Text input area — Scrimba-style */}
        {/* Floating Input Area */}
        <footer className="shrink-0 px-8 pb-8 pt-2">
          <div className="mx-auto max-w-2xl flex gap-3 floating-input rounded-[24px] bg-white p-2 border border-slate-200/50">
            <textarea
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSendText();
                }
              }}
              placeholder="Type a message..."
              className="flex-1 min-h-[44px] max-h-32 resize-none rounded-2xl border-none bg-transparent px-4 py-3 text-sm text-slate-800 placeholder-slate-400 focus:outline-none"
              rows={1}
              disabled={chatLoading}
            />
            <motion.button
              type="button"
              onClick={handleSendText}
              disabled={!textInput.trim() || chatLoading}
              className="shrink-0 flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-200 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              aria-label="Отправить"
            >
              <Send className="h-5 w-5" strokeWidth={2} />
            </motion.button>
          </div>
        </footer>
      </div>
    </main>
  );
}
