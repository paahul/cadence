import { toFile } from "openai/uploads";
import { ANALYSIS_MODEL, getAnthropic } from "./anthropic";
import { extractAudioMetrics, type AudioMetrics } from "./audio-metrics";
import { getOpenAI } from "./openai";
import { buildAnalysisPrompt } from "./rubric/prompt";
import { analysisSchema, type AnalysisResult } from "./rubric/schema";
import { RECORDINGS_BUCKET, getSupabaseAdmin } from "./supabase/admin";

export type AnalysisPipelineResult = {
  transcript: string;
  audioMetrics: AudioMetrics;
  dimensions: AnalysisResult["dimensions"];
  model: string;
};

function filenameForPath(path: string): string {
  return path.split("/").pop() ?? "recording.webm";
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

/**
 * Run the analysis pipeline end-to-end for a given storage path:
 *   download → Whisper (verbose_json) → audio metrics → Claude → validate.
 *
 * Used by both the synchronous fallback in /api/analyze and the Inngest
 * worker function. Throws on any failure with a useful error message.
 */
export async function runAnalysisPipeline(args: {
  storagePath: string;
}): Promise<AnalysisPipelineResult> {
  const { storagePath } = args;

  // 1. Download audio
  const { data: audioBlob, error: downloadError } = await getSupabaseAdmin()
    .storage.from(RECORDINGS_BUCKET)
    .download(storagePath);
  if (downloadError || !audioBlob) {
    throw new Error(
      `Could not download audio: ${downloadError?.message ?? "unknown error"}`,
    );
  }

  // 2. Transcribe with Whisper (verbose_json for word timestamps + segment logprobs)
  const file = await toFile(audioBlob, filenameForPath(storagePath));
  const whisperResult = await getOpenAI().audio.transcriptions.create({
    file,
    model: "whisper-1",
    response_format: "verbose_json",
    timestamp_granularities: ["word"],
  });
  const transcript = whisperResult.text?.trim() ?? "";
  if (!transcript) {
    throw new Error(
      "Transcript was empty — recording may be silent or too short",
    );
  }
  const verbose = whisperResult as unknown as {
    duration?: number;
    words?: { word: string; start: number; end: number }[];
    segments?: {
      start: number;
      end: number;
      text: string;
      avg_logprob: number;
    }[];
  };
  const audioMetrics = extractAudioMetrics({
    words: verbose.words ?? [],
    segments: verbose.segments ?? [],
    durationSeconds: verbose.duration ?? 0,
  });

  // 3. Claude rubric
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
  const rawText =
    firstBlock && firstBlock.type === "text" ? firstBlock.text : "";

  // 4. Parse + validate JSON
  const cleaned = extractJsonObject(rawText);
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error("Analyzer returned non-JSON output");
  }

  const validated = analysisSchema.safeParse(parsed);
  if (!validated.success) {
    throw new Error(
      `Analyzer JSON did not match expected schema: ${JSON.stringify(validated.error.flatten())}`,
    );
  }

  return {
    transcript,
    audioMetrics,
    dimensions: validated.data.dimensions,
    model: ANALYSIS_MODEL,
  };
}
