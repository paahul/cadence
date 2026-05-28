import { DIMENSIONS } from "./dimensions";

const SHARED_GUIDANCE = `## Important guidance (applies to every dimension)

- Score based on what the **transcript** shows. Do not penalize for accent, grammar, or non-native fluency — only for what each dimension actually measures.
- Speech is naturally less precise and more meandering than writing. A **4** is achievable in good conversational speech; a **5** is rare and reserved for genuinely sharp work.
- If the transcript is very short (under ~30 words), say so in your reasoning and lean toward a middle score (3) unless there's clear evidence either way.
- Examples must be **verbatim quotes** from the transcript — do not paraphrase, do not invent. Every "quote" field must appear word-for-word in the transcript.
- For each example, the "issue" field should briefly explain what's off and (where useful) suggest a sharper alternative.
- Include 2–3 examples per dimension for scores of 1–4. For a score of 5, return an empty examples array for that dimension.
- The dimensions are *independent* — a speaker can be very Clear but not Confident, or very Confident but verbose. Score each on its own merits, not as a halo.`;

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
    "clarity":       { "score": <1-5>, "reasoning": "<2-3 sentences>", "examples": [ { "quote": "...", "issue": "..." } ] },
    "conciseness":   { "score": <1-5>, "reasoning": "<2-3 sentences>", "examples": [ { "quote": "...", "issue": "..." } ] },
    "confidence":    { "score": <1-5>, "reasoning": "<2-3 sentences>", "examples": [ { "quote": "...", "issue": "..." } ] },
    "wordPrecision": { "score": <1-5>, "reasoning": "<2-3 sentences>", "examples": [ { "quote": "...", "issue": "..." } ] }
  }
}
\`\`\`

All four dimension keys are required. Use exactly the keys shown above (camelCase for wordPrecision).`;

export function buildAnalysisPrompt(transcript: string): string {
  const dimensionSections = DIMENSIONS.map((_, i) =>
    dimensionSection(i),
  ).join("\n\n");

  return `You are an expert speaking coach evaluating a transcript of someone's spoken communication. Your tone is direct, specific, and respectful — you give the kind of feedback a senior leader would want from a coach.

Score the speaker on four dimensions using the rubrics below. The transcript is given at the end.

${dimensionSections}

${SHARED_GUIDANCE}

${OUTPUT_FORMAT}

## Transcript

${transcript.trim()}`;
}
