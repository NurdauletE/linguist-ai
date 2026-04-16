import { readFileSync, existsSync } from "fs";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

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

const PUNCTUATE_PROMPT = `Add proper punctuation (periods, commas, question marks, exclamation marks) to the following raw speech transcript. Do not change any words or capitalization. Return ONLY the punctuated text, nothing else.`;

export async function POST(request: NextRequest) {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "DEEPSEEK_API_KEY is not configured" },
      { status: 500 }
    );
  }

  let body: { text?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const text = typeof body.text === "string" ? body.text.trim() : "";
  if (!text) {
    return NextResponse.json(
      { error: "Missing or empty 'text' field" },
      { status: 400 }
    );
  }

  const openai = new OpenAI({
    apiKey,
    baseURL: "https://api.deepseek.com",
  });

  try {
    const completion = await openai.chat.completions.create({
      model: "deepseek-chat",
      messages: [
        { role: "system", content: PUNCTUATE_PROMPT },
        { role: "user", content: text },
      ],
      temperature: 0.1,
    });

    const result =
      completion.choices[0]?.message?.content?.trim() ?? text;
    return NextResponse.json({ text: result });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Punctuation failed" },
      { status: 502 }
    );
  }
}
