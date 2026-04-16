"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { TestData, TestAnswers, TestResult } from "@/types/dialogue";
import type { CheckTestResponseBody } from "@/types/chat-api";

interface TestComponentProps {
  test: TestData;
  testId: string;
  topic: string;
}

export function TestComponent({ test, testId, topic }: TestComponentProps) {
  const [answers, setAnswers] = useState<TestAnswers>({
    testId,
    multipleChoice: test.type === "multiple_choice" ? [] : undefined,
    openEnded: test.type === "open_ended" ? [] : undefined,
    written: test.type === "written" ? [] : undefined,
  });
  const [result, setResult] = useState<TestResult | null>(null);
  const [checking, setChecking] = useState(false);

  const handleCheckTest = useCallback(async () => {
    setChecking(true);
    try {
      const res = await fetch("/api/check-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ test, answers, topic }),
      });

      if (!res.ok) {
        throw new Error("Failed to check test");
      }

      const data = (await res.json()) as CheckTestResponseBody;
      setResult(data.result);
    } catch (err) {
      console.error("Error checking test:", err);
      alert("Ошибка при проверке теста. Попробуйте снова.");
    } finally {
      setChecking(false);
    }
  }, [test, answers, topic]);

  if (test.type === "multiple_choice") {
    return (
      <div className="mt-4 rounded-xl border border-indigo-200 bg-indigo-50/50 p-4">
        <h3 className="mb-4 text-lg font-semibold text-indigo-900">
          Multiple Choice Test
        </h3>
        <div className="space-y-4">
          {test.questions.map((q, qIndex) => (
            <div key={qIndex} className="rounded-lg border border-indigo-200 bg-white p-4">
              <p className="mb-3 font-medium text-slate-800">
                {qIndex + 1}. {q.question}
              </p>
              <div className="space-y-2">
                {q.options.map((option, optIndex) => (
                  <label
                    key={optIndex}
                    className="flex cursor-pointer items-start gap-2 rounded-md p-2 hover:bg-indigo-50"
                  >
                    <input
                      type="radio"
                      name={`question-${qIndex}`}
                      checked={answers.multipleChoice?.[qIndex] === optIndex}
                      onChange={() => {
                        const newAnswers = [...(answers.multipleChoice || [])];
                        newAnswers[qIndex] = optIndex;
                        setAnswers({ ...answers, multipleChoice: newAnswers });
                      }}
                      className="mt-1"
                    />
                    <span className="text-sm text-slate-700">{option}</span>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
        {!result && (
          <button
            onClick={handleCheckTest}
            disabled={checking || (answers.multipleChoice?.filter(val => val !== undefined).length ?? 0) < test.questions.length}
            className="mt-4 w-full rounded-lg bg-indigo-600 px-4 py-2 font-medium text-white transition hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {checking ? "Проверка..." : "Проверка"}
          </button>
        )}
        {result && <TestResult result={result} />}
      </div>
    );
  }

  if (test.type === "open_ended") {
    // Parse text with blanks - support both [___] and {___} formats
    const blankRegex = /(\[___\]|\{___\})/g;
    const textParts: Array<{ type: "text" | "blank"; content: string; blankIndex?: number }> = [];
    let lastIndex = 0;
    let blankIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = blankRegex.exec(test.text)) !== null) {
      if (match.index > lastIndex) {
        textParts.push({ type: "text", content: test.text.slice(lastIndex, match.index) });
      }
      textParts.push({ type: "blank", content: match[0], blankIndex: blankIndex++ });
      lastIndex = match.index + match[0].length;
    }
    if (lastIndex < test.text.length) {
      textParts.push({ type: "text", content: test.text.slice(lastIndex) });
    }
    
    return (
      <div className="mt-4 rounded-xl border border-indigo-200 bg-indigo-50/50 p-4">
        <h3 className="mb-4 text-lg font-semibold text-indigo-900">
          Open Ended Test
        </h3>
        <div className="rounded-lg border border-indigo-200 bg-white p-4">
          <div className="space-y-2 text-sm text-slate-800 leading-relaxed">
            {textParts.map((part, partIndex) => {
              if (part.type === "blank" && part.blankIndex !== undefined) {
                return (
                  <input
                    key={partIndex}
                    type="text"
                    value={answers.openEnded?.[part.blankIndex] || ""}
                    onChange={(e) => {
                      const newAnswers = [...(answers.openEnded || [])];
                      newAnswers[part.blankIndex!] = e.target.value;
                      setAnswers({ ...answers, openEnded: newAnswers });
                    }}
                    placeholder="___"
                    className="mx-1 inline-block min-w-[100px] rounded border border-indigo-300 px-2 py-1 text-center focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                );
              }
              return <span key={partIndex}>{part.content}</span>;
            })}
          </div>
        </div>
        {!result && (
          <button
            onClick={handleCheckTest}
            disabled={checking || (answers.openEnded?.filter(val => val !== undefined && val.trim() !== "").length ?? 0) < test.blanks.length}
            className="mt-4 w-full rounded-lg bg-indigo-600 px-4 py-2 font-medium text-white transition hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {checking ? "Проверка..." : "Проверка"}
          </button>
        )}
        {result && <TestResult result={result} />}
      </div>
    );
  }

  if (test.type === "written") {
    return (
      <div className="mt-4 rounded-xl border border-indigo-200 bg-indigo-50/50 p-4">
        <h3 className="mb-4 text-lg font-semibold text-indigo-900">
          Written Test
        </h3>
        <div className="space-y-4">
          {test.questions.map((question, qIndex) => (
            <div key={qIndex} className="rounded-lg border border-indigo-200 bg-white p-4">
              <p className="mb-3 font-medium text-slate-800">
                {qIndex + 1}. {question}
              </p>
              <textarea
                value={answers.written?.[qIndex] || ""}
                onChange={(e) => {
                  const newAnswers = [...(answers.written || [])];
                  newAnswers[qIndex] = e.target.value;
                  setAnswers({ ...answers, written: newAnswers });
                }}
                placeholder="Your answer..."
                className="w-full min-h-[100px] rounded border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          ))}
        </div>
        {!result && (
          <button
            onClick={handleCheckTest}
            disabled={checking || (answers.written?.filter(val => val !== undefined && val.trim() !== "").length ?? 0) < test.questions.length}
            className="mt-4 w-full rounded-lg bg-indigo-600 px-4 py-2 font-medium text-white transition hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {checking ? "Проверка..." : "Проверка"}
          </button>
        )}
        {result && <TestResult result={result} />}
      </div>
    );
  }

  return null;
}

function TestResult({ result }: { result: TestResult }) {
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mt-4 rounded-lg border border-indigo-300 bg-white p-4"
      >
        <div className="mb-4">
          <div className="mb-2 flex items-center justify-between">
            <h4 className="text-lg font-semibold text-indigo-900">Результат анализа</h4>
            <div className="text-2xl font-bold text-indigo-600">
              {result.score}%
            </div>
          </div>
          <div className="text-sm text-slate-600">
            Правильных ответов: {result.correctAnswers} из {result.totalQuestions}
          </div>
        </div>

        <div className="mb-4 rounded-lg bg-indigo-50 p-3">
          <p className="text-sm text-slate-800">{result.feedback}</p>
        </div>

        {result.detailedFeedback.length > 0 && (
          <div className="space-y-3">
            <h5 className="font-semibold text-slate-800">Детальный анализ:</h5>
            {result.detailedFeedback.map((detail, index) => (
              <div
                key={index}
                className={`rounded-lg border p-3 ${
                  detail.isCorrect
                    ? "border-green-300 bg-green-50"
                    : "border-red-300 bg-red-50"
                }`}
              >
                <div className="mb-2 flex items-center gap-2">
                  <span className="font-medium text-slate-800">
                    Вопрос {detail.questionIndex + 1}:
                  </span>
                  {detail.isCorrect ? (
                    <span className="text-sm font-medium text-green-700">✓ Правильно</span>
                  ) : (
                    <span className="text-sm font-medium text-red-700">✗ Неправильно</span>
                  )}
                </div>
                <div className="space-y-1 text-sm">
                  <div>
                    <span className="font-medium text-slate-600">Ваш ответ: </span>
                    <span className="text-slate-800">{detail.userAnswer}</span>
                  </div>
                  {!detail.isCorrect && (
                    <div>
                      <span className="font-medium text-slate-600">Правильный ответ: </span>
                      <span className="text-slate-800">{detail.correctAnswer}</span>
                    </div>
                  )}
                  <div className="mt-2 text-slate-700">{detail.explanation}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
