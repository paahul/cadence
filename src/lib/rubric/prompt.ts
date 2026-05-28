import type { AudioMetrics } from "../audio-metrics";
import { DIMENSIONS } from "./dimensions";

const SHARED_GUIDANCE = `## Important guidance (applies to every dimension)

- Score based on the **transcript** and (where applicable) the **audio metrics** below. Do not penalize for accent, grammar, or non-native fluency — only for what each dimension actually measures.
- Speech is naturally less precise and more meandering than writing. A **4** is achievable in good conversational speech; a **5** is rare and reserved for genuinely sharp work.
- If the transcript is very short (under ~30 words), say so in your reasoning and lean toward a middle score (3) unless there's clear evidence either way.
- Examples must be **verbatim quotes** from the transcript or the low-confidence segments list — do not paraphrase, do not invent. Every "quote" field must appear word-for-word in the source.
- For each example, the "issue" field should briefly explain what's off and (where useful) suggest a sharper alternative.
- Include 2–3 examples per dimension for scores of 1–4. For a score of 5, return an empty examples array for that dimension.
- The dimensions are *independent* — a speaker can be very Clear but Paced poorly, or very Confident but mumble certain words. Score each on its own merits, not as a halo.`;

function dimensionSection(index: number) {
  const d = DIMENSIONS[index];
  return `## Dimension ${index + 1}: ${d.name}

**Question:** ${d.question}

${d.rubricText}`;
}

const OUTPUT_FORMAT = `## Output format

Return **strict JSON only** — no markdown fences, no preamble, no trailing commentary. The JSON must match this exact shape:

\`\`\`
{
  "dimensions": {
    "clarity":              { "score": <1-5>, "reasoning": "<2-3 sentences>", "examples": [ { "quote": "...", "issue": "..." } ] },
    "conciseness":          { "score": <1-5>, "reasoning": "<2-3 sentences>", "examples": [ { "quote": "...", "issue": "..." } ] },
    "confidence":           { "score": <1-5>, "reasoning": "<2-3 sentences>", "examples": [ { "quote": "...", "issue": "..." } ] },
    "wordPrecision":        { "score": <1-5>, "reasoning": "<2-3 sentences>", "examples": [ { "quote": "...", "issue": "..." } ] },
    "pace":                 { "score": <1-5>, "reasoning": "<2-3 sentences>", "examples": [ { "quote": "...", "issue": "..." } ] },
    "pronunciationClarity": { "score": <1-5>, "reasoning": "<2-3 sentences>", "examples": [ { "quote": "...", "issue": "..." } ] }
  }
}
\`\`\`

All six dimension keys are required. Use exactly the keys shown above (camelCase for wordPrecision and pronunciationClarity).`;

function formatAudioMetrics(metrics: AudioMetrics): string {
  const uncertainList =
    metrics.uncertainSegments.length > 0
      ? metrics.uncertainSegments
          .map(
            (s) =>
              `  - "${s.text}" (Whisper avg_logprob ${s.avgLogprob.toFixed(2)})`,
          )
          .join("\n")
      : "  (none — pronunciation was clear throughout)";

  return `## Audio metrics for this recording

Use these for the **Pace** and **Pronunciation Clarity** dimensions.

- **Words per minute (WPM):** ${metrics.wpm} — natural conversational English range is roughly 150–180 WPM.
- **Word count:** ${metrics.wordCount} words over ${metrics.durationSeconds.toFixed(1)} seconds of audio.
- **Pauses (≥ 0.4s gaps):** ${metrics.pauses.count} pauses total. Of those, ${metrics.pauses.overOneSecondCount} were ≥ 1 second. Longest single pause: ${metrics.pauses.longestSeconds}s. Total pause time: ${metrics.pauses.totalPauseSeconds}s.
- **Low-confidence segments** (likely mumbled, rushed, or unclear in the audio — use these as Pronunciation Clarity evidence):
${uncertainList}
`;
}

export type AnalysisPromptInput = {
  transcript: string;
  audioMetrics?: AudioMetrics;
};

export function buildAnalysisPrompt(input: AnalysisPromptInput): string {
  const { transcript, audioMetrics } = input;
  const dimensionSections = DIMENSIONS.map((_, i) =>
    dimensionSection(i),
  ).join("\n\n");
  const audioSection = audioMetrics ? formatAudioMetrics(audioMetrics) : "";

  return `You are an expert speaking coach evaluating a transcript of someone's spoken communication. Your tone is direct, specific, and respectful — you give the kind of feedback a senior leader would want from a coach.

Score the speaker on six dimensions using the rubrics below. The transcript is given at the end, along with audio metrics that you should use specifically for the Pace and Pronunciation Clarity dimensions.

${dimensionSections}

${SHARED_GUIDANCE}

${OUTPUT_FORMAT}

${audioSection}
## Transcript

${transcript.trim()}`;
}
