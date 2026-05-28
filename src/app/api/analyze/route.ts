import { NextResponse } from "next/server";
import { toFile } from "openai/uploads";
import { ANALYSIS_MODEL, getAnthropic } from "@/lib/anthropic";
import { getOpenAI } from "@/lib/openai";
import { buildAnalysisPrompt } from "@/lib/rubric/prompt";
import { analysisSchema } from "@/lib/rubric/schema";
import { RECORDINGS_BUCKET, getSupabaseAdmin } from "@/lib/supabase";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

function filenameForPath(path: string): string {
  const segments = path.split("/");
  const last = segments[segments.length - 1] ?? "recording.webm";
  return last;
}

function extractJsonObject(text: string): string {
  const trimmed = text.trim();
  if (trimmed.startsWith("{")) return trimmed;
  const fenced = trimmed.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
  if (fenced?.[1]) return fenced[1];
  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    return trimmed.slice(firstBrace, lastBrace + 1);
  }
  return trimmed;
}

export async function POST(request: Request) {
  let storagePath: string;
  try {
    const body = (await request.json()) as { storagePath?: string };
    if (!body.storagePath) {
      return NextResponse.json(
        { error: "Missing storagePath" },
        { status: 400 },
      );
    }
    storagePath = body.storagePath;
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 },
    );
  }

  // 1. Download the audio from Supabase Storage
  const { data: audioBlob, error: downloadError } = await getSupabaseAdmin()
    .storage.from(RECORDINGS_BUCKET)
    .download(storagePath);

  if (downloadError || !audioBlob) {
    return NextResponse.json(
      {
        error: `Could not download audio: ${downloadError?.message ?? "unknown error"}`,
      },
      { status: 500 },
    );
  }

  // 2. Transcribe with Whisper
  let transcript: string;
  try {
    const file = await toFile(audioBlob, filenameForPath(storagePath));
    const result = await getOpenAI().audio.transcriptions.create({
      file,
      model: "whisper-1",
    });
    transcript = result.text?.trim() ?? "";
  } catch (err) {
    const message = err instanceof Error ? err.message : "Whisper failed";
    return NextResponse.json(
      { error: `Transcription failed: ${message}` },
      { status: 502 },
    );
  }

  if (!transcript) {
    return NextResponse.json(
      { error: "Transcript was empty — recording may be silent or too short" },
      { status: 422 },
    );
  }

  // 3. Run the four-dimension rubric via Claude
  let rawAnalysisText: string;
  try {
    const response = await getAnthropic().messages.create({
      model: ANALYSIS_MODEL,
      max_tokens: 2048,
      messages: [{ role: "user", content: buildAnalysisPrompt(transcript) }],
    });
    const firstBlock = response.content[0];
    rawAnalysisText =
      firstBlock && firstBlock.type === "text" ? firstBlock.text : "";
  } catch (err) {
    const message = err instanceof Error ? err.message : "Claude failed";
    return NextResponse.json(
      { error: `Analysis failed: ${message}` },
      { status: 502 },
    );
  }

  // 4. Parse + validate
  const cleaned = extractJsonObject(rawAnalysisText);
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    return NextResponse.json(
      {
        error: "Analyzer returned non-JSON output",
        raw: rawAnalysisText,
      },
      { status: 502 },
    );
  }

  const validated = analysisSchema.safeParse(parsed);
  if (!validated.success) {
    return NextResponse.json(
      {
        error: "Analyzer JSON did not match expected schema",
        details: validated.error.flatten(),
        raw: rawAnalysisText,
      },
      { status: 502 },
    );
  }

  return NextResponse.json({
    transcript,
    analysis: validated.data,
  });
}
