import { ANALYSIS_MODEL, getAnthropic } from "./anthropic";
import type { FullSession } from "./db";
import { DIMENSIONS, type Dimension } from "./rubric/dimensions";
import type { AnalysisResult, DimensionResult } from "./rubric/schema";

export type DigestWindow = {
  start: Date;
  end: Date;
  label: string;
};

export function pickDigestWindow(now: Date): DigestWindow {
  const dayOfWeek = now.getUTCDay();
  const lookbackDays = dayOfWeek === 1 ? 3 : 1;

  const end = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
      0,
      0,
      0,
      0,
    ),
  );
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - lookbackDays);

  const label =
    lookbackDays === 1 ? "yesterday" : "the weekend (Fri–Sun)";

  return { start, end, label };
}

export type DimensionAverage = {
  dim: Dimension;
  average: number;
  sessionScores: number[];
};

export function computeDimensionAverages(
  sessions: FullSession[],
): DimensionAverage[] {
  return DIMENSIONS.map((dim) => {
    const key = dim.id as keyof AnalysisResult["dimensions"];
    const scores = sessions
      .map((s) => s.analysis?.dimensions[key]?.score)
      .filter((v): v is number => typeof v === "number");
    const average =
      scores.length > 0
        ? scores.reduce((a, b) => a + b, 0) / scores.length
        : 0;
    return { dim, average, sessionScores: scores };
  });
}

export type DigestStats = {
  sessionCount: number;
  totalDurationMs: number;
  best: DimensionAverage;
  focus: DimensionAverage;
  focusExample: { quote: string; issue: string } | null;
  averages: DimensionAverage[];
};

export function summarizeSessions(sessions: FullSession[]): DigestStats | null {
  if (sessions.length === 0) return null;

  const averages = computeDimensionAverages(sessions).filter(
    (a) => a.sessionScores.length > 0,
  );
  if (averages.length === 0) return null;

  const best = [...averages].sort((a, b) => b.average - a.average)[0];
  const focus = [...averages].sort((a, b) => a.average - b.average)[0];

  let focusExample: { quote: string; issue: string } | null = null;
  const focusKey = focus.dim.id as keyof AnalysisResult["dimensions"];
  const sessionsByFocusScore = [...sessions]
    .filter((s) => s.analysis?.dimensions[focusKey])
    .sort((a, b) => {
      const aScore = a.analysis?.dimensions[focusKey]?.score ?? 5;
      const bScore = b.analysis?.dimensions[focusKey]?.score ?? 5;
      return aScore - bScore;
    });
  for (const s of sessionsByFocusScore) {
    const firstExample = s.analysis?.dimensions[focusKey]?.examples[0];
    if (firstExample) {
      focusExample = firstExample;
      break;
    }
  }

  const totalDurationMs = sessions.reduce(
    (acc, s) => acc + (s.session.duration_ms ?? 0),
    0,
  );

  return {
    sessionCount: sessions.length,
    totalDurationMs,
    best,
    focus,
    focusExample,
    averages,
  };
}

export type Synthesis = {
  synthesis: string;
  actionStep: string;
};

/**
 * Ask Claude for a coaching synthesis + one concrete action step.
 * Returns null on parse failure (caller falls back to a templated line).
 */
export async function generateSynthesis(
  sessions: FullSession[],
  stats: DigestStats,
  windowLabel: string,
): Promise<Synthesis | null> {
  const perSession = sessions
    .map((s, i) => {
      const dims = s.analysis?.dimensions;
      if (!dims) return null;
      const lines = DIMENSIONS.map((dim) => {
        const r = dims[
          dim.id as keyof AnalysisResult["dimensions"]
        ] as DimensionResult | undefined;
        if (!r) return null;
        return `  - ${dim.name}: ${r.score}/5 — ${r.reasoning}`;
      })
        .filter(Boolean)
        .join("\n");
      return `Session ${i + 1}:\n${lines}`;
    })
    .filter(Boolean)
    .join("\n\n");

  const prompt = `You are a personal speaking coach writing a short daily note that will appear at the top of your client's morning digest email.

Their data from ${windowLabel}:
- ${stats.sessionCount} session${stats.sessionCount === 1 ? "" : "s"} totaling ${Math.round(stats.totalDurationMs / 60000)} minute${Math.round(stats.totalDurationMs / 60000) === 1 ? "" : "s"}.
- Strongest dimension: ${stats.best.dim.name} (${stats.best.average.toFixed(1)} avg)
- Weakest dimension: ${stats.focus.dim.name} (${stats.focus.average.toFixed(1)} avg)

Per-session breakdown:
${perSession}

Produce two outputs:

1. A **synthesis paragraph** (50–80 words) that names what they did well (their strongest dimension, tied to a specific observation) and the recurring pattern in their weakest dimension. Direct, conversational, respectful — like a smart coach. Refer to them as "you". No numbers in the paragraph; no greeting; no sign-off. Do NOT include the action step in this paragraph.

2. A **concrete action step** they can try today (15–30 words, one sentence or two short ones). Must be a specific behavior they can do — not a vague goal. Imperative voice. Should be doable before their next recording. Do NOT restate the dimension name in the action step.

Return **strict JSON only** matching:

\`\`\`
{
  "synthesis": "<paragraph>",
  "actionStep": "<one specific behavioral instruction>"
}
\`\`\`

No markdown fences, no preamble, no trailing commentary. Just the JSON.`;

  try {
    const response = await getAnthropic().messages.create({
      model: ANALYSIS_MODEL,
      max_tokens: 500,
      messages: [{ role: "user", content: prompt }],
    });
    const first = response.content[0];
    if (!first || first.type !== "text") return null;

    const text = first.text.trim();
    const jsonStart = text.indexOf("{");
    const jsonEnd = text.lastIndexOf("}");
    if (jsonStart === -1 || jsonEnd <= jsonStart) return null;

    const parsed = JSON.parse(text.slice(jsonStart, jsonEnd + 1)) as {
      synthesis?: unknown;
      actionStep?: unknown;
    };
    if (
      typeof parsed.synthesis !== "string" ||
      typeof parsed.actionStep !== "string"
    ) {
      return null;
    }
    return {
      synthesis: parsed.synthesis.trim(),
      actionStep: parsed.actionStep.trim(),
    };
  } catch {
    return null;
  }
}
