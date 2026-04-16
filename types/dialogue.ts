/** Один сообщение в диалоге */
export interface DialogueMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  /** Исправление от ИИ (если было) */
  correction?: string | null;
  /** Краткое объяснение (если было исправление) */
  explanation?: string | null;
  /** Тест, если сообщение содержит тест */
  test?: TestData | null;
  createdAt: Date;
}

/** Тип теста */
export type TestType = "multiple_choice" | "open_ended" | "written";

/** Вопрос с вариантами ответов (для выборочного теста) */
export interface MultipleChoiceQuestion {
  question: string;
  options: string[]; // 4 варианта
  correctAnswer: number; // индекс правильного ответа (0-3)
}

/** Выборочный тест */
export interface MultipleChoiceTest {
  type: "multiple_choice";
  questions: MultipleChoiceQuestion[]; // 5 вопросов
}

/** Открытый тест (cloze test) */
export interface OpenEndedTest {
  type: "open_ended";
  text: string; // текст с пропусками, обозначенными как [___] или {___}
  blanks: Array<{
    position: number; // позиция пропуска в тексте
    correctAnswer: string; // правильный ответ
    hint?: string; // подсказка (опционально)
  }>;
}

/** Письменный тест */
export interface WrittenTest {
  type: "written";
  questions: string[]; // 3 вопроса
}

/** Данные теста */
export type TestData = MultipleChoiceTest | OpenEndedTest | WrittenTest;

/** Ответы пользователя на тест */
export interface TestAnswers {
  testId: string;
  multipleChoice?: number[]; // индексы выбранных ответов для каждого вопроса
  openEnded?: string[]; // ответы для каждого пропуска
  written?: string[]; // письменные ответы на вопросы
}

/** Результат анализа теста */
export interface TestResult {
  score: number; // процент правильных ответов (0-100)
  totalQuestions: number;
  correctAnswers: number;
  feedback: string; // общий фидбек от ИИ
  detailedFeedback: Array<{
    questionIndex: number;
    isCorrect: boolean;
    userAnswer: string;
    correctAnswer: string;
    explanation: string;
  }>;
}

/** Состояние аватара для визуала */
export type AvatarState = "idle" | "listening" | "speaking" | "thinking";
