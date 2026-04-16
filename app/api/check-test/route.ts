import { readFileSync, existsSync } from "fs";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import type { CheckTestRequestBody, CheckTestResponseBody } from "@/types/chat-api";
import type { TestData, TestResult } from "@/types/dialogue";

function loadEnvLocal(): void {
  const root = process.cwd();
  const envPath = path.join(root, ".env.local");
  if (!existsSync(envPath)) return;
  try {
    const content = readFileSync(envPath, "utf8");
    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq <= 0) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'")))
        value = value.slice(1, -1);
      if (process.env[key] == null) process.env[key] = value;
    }
  } catch {
    // ignore
  }
}

loadEnvLocal();

const CHECK_TEST_PROMPT = `You are an English tutor analyzing a student's test answers. Provide detailed, constructive feedback.

Analyze the student's answers against the correct answers and provide:
1. Overall score (percentage of correct answers)
2. General feedback (encouraging, constructive, 2-3 sentences)
3. Detailed feedback for each question/answer:
   - Whether the answer is correct
   - What the student answered
   - What the correct answer is
   - Brief explanation (1-2 sentences) in English

Be supportive and educational. Focus on helping the student learn, not just grading.

Respond with a JSON object:
{
  "score": number (0-100),
  "totalQuestions": number,
  "correctAnswers": number,
  "feedback": string (general feedback, 2-3 sentences),
  "detailedFeedback": [
    {
      "questionIndex": number,
      "isCorrect": boolean,
      "userAnswer": string,
      "correctAnswer": string,
      "explanation": string
    }
  ]
}`;

export async function POST(request: NextRequest) {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "DEEPSEEK_API_KEY is not configured" },
      { status: 500 }
    );
  }

  let body: CheckTestRequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const { test, answers, topic } = body;
  if (!test || !answers) {
    return NextResponse.json(
      { error: "Missing test or answers" },
      { status: 400 }
    );
  }

  const openai = new OpenAI({
    apiKey,
    baseURL: "https://api.deepseek.com",
  });

  try {
    // Build context for the AI
    let context = `Topic: ${topic}\n\nTest Type: ${test.type}\n\n`;

    if (test.type === "multiple_choice") {
      context += "TEST STRUCTURE (Multiple Choice):\n";
      test.questions.forEach((q, i) => {
        context += `Question ${i + 1}: ${q.question}\n`;
        q.options.forEach((opt, j) => {
          const status = j === q.correctAnswer ? "[CORRECT ANSWER]" : "";
          context += `   Option ${j}: ${opt} ${status}\n`;
        });
        context += "\n";
      });

      context += "STUDENT ANSWERS (0-based indices):\n";
      test.questions.forEach((q, i) => {
        const studentIndex = answers.multipleChoice?.[i];
        const studentAnswerText = studentIndex !== undefined ? q.options[studentIndex] : "(no answer)";
        context += `Question ${i + 1}: Student chose Option ${studentIndex} ("${studentAnswerText}")\n`;
      });
    } else if (test.type === "open_ended") {
      context += `TEST TEXT:\n${test.text}\n\n`;
      context += `BLANKS (CORRECT ANSWERS):\n`;
      test.blanks.forEach((blank, i) => {
        context += `Blank ${i + 1} (Position index ${blank.position}): Expected "${blank.correctAnswer}"`;
        if (blank.hint) context += ` (Hint: ${blank.hint})`;
        context += `\n`;
      });
      context += `\nSTUDENT ANSWERS:\n`;
      test.blanks.forEach((_, i) => {
        const studentAns = answers.openEnded?.[i] || "(no answer)";
        context += `Blank ${i + 1}: "${studentAns}"\n`;
      });
    } else if (test.type === "written") {
      context += "TEST QUESTIONS (WRITTEN):\n";
      test.questions.forEach((q, i) => {
        context += `Question ${i + 1}: ${q}\n`;
      });
      context += `\nSTUDENT ANSWERS:\n`;
      test.questions.forEach((_, i) => {
        const studentAns = answers.written?.[i] || "(no answer)";
        context += `Answer ${i + 1}: ${studentAns}\n`;
      });
    }

    const completion = await openai.chat.completions.create({
      model: "deepseek-chat",
      messages: [
        { role: "system", content: CHECK_TEST_PROMPT },
        { role: "user", content: context },
      ],
      temperature: 0.1, // Lower temperature for more accurate checking
    });

    const content = completion.choices[0]?.message?.content?.trim() ?? "";
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("Invalid response format");
    }

    const parsed = JSON.parse(jsonMatch[0]) as TestResult;
    
    // Validate and return
    const result: CheckTestResponseBody = {
      result: {
        score: typeof parsed.score === "number" ? parsed.score : 0,
        totalQuestions: typeof parsed.totalQuestions === "number" ? parsed.totalQuestions : 0,
        correctAnswers: typeof parsed.correctAnswers === "number" ? parsed.correctAnswers : 0,
        feedback: typeof parsed.feedback === "string" ? parsed.feedback : "Analysis completed.",
        detailedFeedback: Array.isArray(parsed.detailedFeedback) ? parsed.detailedFeedback : [],
      },
    };

    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Test checking failed" },
      { status: 502 }
    );
  }
}
