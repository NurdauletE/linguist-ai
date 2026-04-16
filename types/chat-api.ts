import type { TestData, TestAnswers, TestResult } from "./dialogue";

/** Тело запроса к POST /api/chat */
export interface ChatRequestBody {
  /** Текст пользователя (речь или сообщение) */
  message: string;
}

/** Тело запроса к POST /api/check-test */
export interface CheckTestRequestBody {
  /** Данные теста */
  test: TestData;
  /** Ответы пользователя */
  answers: TestAnswers;
  /** Тема теста */
  topic: string;
}

/** Ответ ИИ по контракту .cursorrules (Linguist AI) */
export interface ChatResponseBody {
  /** Исправление ошибки, если была */
  correction: string | null;
  /** Краткое объяснение правила */
  explanation: string | null;
  /** Текст ответа учителя */
  reply_text: string;
  /** Предложение следующей темы для разговора */
  suggested_next_topic: string;
  /** Тест, если пользователь запросил тест */
  test?: TestData | null;
}

/** Ответ на проверку теста */
export interface CheckTestResponseBody {
  result: TestResult;
}
