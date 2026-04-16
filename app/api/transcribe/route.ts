import { readFileSync, existsSync } from "fs";
import path from "path";
import { NextRequest, NextResponse } from "next/server";

/** Загружает переменные из .env.local в process.env (приоритет у уже заданных). */
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
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (process.env[key] == null) {
        process.env[key] = value;
      }
    }
  } catch {
    // ignore read errors
  }
}

loadEnvLocal();

const WHISPER_MODEL = "whisper-1";

export async function POST(request: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY is not configured" },
      { status: 500 }
    );
  }

  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("multipart/form-data")) {
    return NextResponse.json(
      { error: "Expected multipart/form-data with audio file" },
      { status: 400 }
    );
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "Failed to parse form data" },
      { status: 400 }
    );
  }

  const file = formData.get("file");
  if (!file || typeof file === "string") {
    return NextResponse.json(
      { error: "Missing audio 'file' field" },
      { status: 400 }
    );
  }

  const languageValue = formData.get("language");
  const language =
    typeof languageValue === "string" && languageValue.trim()
      ? languageValue.trim()
      : undefined;

  const upstreamForm = new FormData();
  upstreamForm.append("file", file);
  upstreamForm.append("model", WHISPER_MODEL);
  if (language) {
    upstreamForm.append("language", language);
  }

  try {
    const response = await fetch(
      "https://api.openai.com/v1/audio/transcriptions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
        body: upstreamForm,
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        {
          error: "Whisper API error",
          details: errorText.slice(0, 1000),
        },
        { status: 502 }
      );
    }

    const data = (await response.json()) as { text?: string };
    const text = typeof data.text === "string" ? data.text.trim() : "";

    if (!text) {
      return NextResponse.json(
        { error: "Whisper API returned empty text" },
        { status: 502 }
      );
    }

    return NextResponse.json({ text });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to call Whisper API";
    return NextResponse.json(
      { error: message },
      { status: 502 }
    );
  }
}

