import { NextResponse } from "next/server";
import { toFile } from "openai/uploads";
import { ANALYSIS_MODEL, getAnthropic } from "@/lib/anthropic";
import { extractAudioMetrics } from "@/lib/audio-metrics";
import { insertSessionWithResults } from "@/lib/db";
import { getOpenAI } from "@/lib/openai";
import { buildAnalysisPrompt } from "@/lib/rubric/prompt";
import { analysisSchema } from "@/lib/rubric/schema";
import { RECORDINGS_BUCKET, getSupabaseAdmin } from "@/lib/supabase/admin";
import { getSupabaseServer } from "@/lib/supabase/server";

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

type AnalyzeRequest = {
  storagePath?: string;
  mimeType?: string;
  durationMs?: number;
};

export async function POST(request: Request) {
  const serverSupabase = await getSupabaseServer();
  const {
    data: { user },
  } = await serverSupabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  let body: AnalyzeRequest;
  try {
    body = (await request.json()) as AnalyzeRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.storagePath) {
    return NextResponse.json({ error: "Missing storagePath" }, { status: 400 });
  }
  const storagePath = body.storagePath;
  const mimeType = body.mimeType ?? "audio/webm";
  const durationMs =
    typeof body.durationMs === "number" ? body.durationMs : null;

  // Guard: storage path must belong to this user (defense-in-depth — the signed
  // upload URL we issued earlier already had the path baked in).
  if (!storagePath.startsWith(`users/${user.id}/`)) {
    return NextResponse.json(
      { error: "Storage path does not belong to this user" },
      { status: 403 },
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

  // 2. Transcribe with Whisper — verbose_json so we get per-word timestamps
  //    and per-segment confidence (used for Pace + Pronunciation Clarity).
  let transcript: string;
  let audioMetrics: ReturnType<typeof extractAudioMetrics> | undefined;
  try {
    const file = await toFile(audioBlob, filenameForPath(storagePath));
    const result = await getOpenAI().audio.transcriptions.create({
      file,
      model: "whisper-1",
      response_format: "verbose_json",
      timestamp_granularities: ["word"],
    });
    transcript = result.text?.trim() ?? "";
    const verbose = result as unknown as {
      duration?: number;
      words?: { word: string; start: number; end: number }[];
      segments?: {
        start: number;
        end: number;
        text: string;
        avg_logprob: number;
      }[];
    };
    audioMetrics = extractAudioMetrics({
      words: verbose.words ?? [],
      segments: verbose.segments ?? [],
      durationSeconds: verbose.duration ?? 0,
    });
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

  // 3. Run the six-dimension rubric via Claude (transcript + audio metrics).
  let rawAnalysisText: string;
  try {
    const response = await getAnthropic().messages.create({
      model: ANALYSIS_MODEL,
      max_tokens: 3000,
      messages: [
        {
          role: "user",
          content: buildAnalysisPrompt({ transcript, audioMetrics }),
        },
      ],
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
      { error: "Analyzer returned non-JSON output", raw: rawAnalysisText },
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

  // 5. Persist with this user's id
  try {
    const session = await insertSessionWithResults({
      userId: user.id,
      storagePath,
      mimeType,
      durationMs,
      transcript,
      dimensions: validated.data.dimensions,
      model: ANALYSIS_MODEL,
    });
    return NextResponse.json({ sessionId: session.id });
  } catch (err) {
    const message = err instanceof Error ? err.message : "DB insert failed";
    return NextResponse.json(
      {
        error: `Could not save session: ${message}`,
        transcript,
        analysis: validated.data,
      },
      { status: 500 },
    );
  }
}
