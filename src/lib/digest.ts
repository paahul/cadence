import { ANALYSIS_MODEL, getAnthropic } from "./anthropic";
import type { FullSession } from "./db";
import { DIMENSIONS, type Dimension } from "./rubric/dimensions";
import type { AnalysisResult, DimensionResult } from "./rubric/schema";

export type DigestWindow = {
  start: Date;
  end: Date;
  label: string; // human-readable label like "yesterday" or "Fri–Sun"
};

/**
 * Pick the lookback window for a digest cron firing at `now` (UTC).
 * - Tue–Fri: yesterday only.
 * - Mon: last 3 days (Fri + Sat + Sun) so weekend recordings aren't lost.
 * - Sat/Sun: shouldn't fire (cron is Mon–Fri) but handle gracefully = yesterday.
 */
export function pickDigestWindow(now: Date): DigestWindow {
  const dayOfWeek = now.getUTCDay(); // 0 = Sun, 1 = Mon, ...
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
};

export function summarizeSessions(sessions: FullSession[]): DigestStats | null {
  if (sessions.length === 0) return null;

  const averages = computeDimensionAverages(sessions).filter(
    (a) => a.sessionScores.length > 0,
  );
  if (averages.length === 0) return null;

  // Best = highest avg, Focus = lowest avg. Tie-break: earlier in DIMENSIONS order.
  const best = [...averages].sort((a, b) => b.average - a.average)[0];
  const focus = [...averages].sort((a, b) => a.average - b.average)[0];

  // Pull a representative example for the focus dimension from the lowest-scoring session
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
  };
}

/**
 * Build a short coaching synthesis paragraph via Claude. ~60–90 words.
 * Returns null on failure (caller should fall back to a template line).
 */
export async function generateSynthesis(
  sessions: FullSession[],
  stats: DigestStats,
  windowLabel: string,
): Promise<string | null> {
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

  const prompt = `You are a personal speaking coach writing a short daily note to your client. The note will appear at the top of their morning digest email.

Their data from ${windowLabel}:
- ${stats.sessionCount} session${stats.sessionCount === 1 ? "" : "s"} totaling ${Math.round(stats.totalDurationMs / 60000)} minutes.
- Strongest dimension: ${stats.best.dim.name} (${stats.best.average.toFixed(1)} avg)
- Weakest dimension: ${stats.focus.dim.name} (${stats.focus.average.toFixed(1)} avg)

Per-session breakdown:
${perSession}

Write a coaching note in **60–90 words** that:
1. Names what they did well (their strongest dimension), tied to a specific observation.
2. Names the recurring pattern in their weakest dimension.
3. Gives **one concrete thing to focus on** today.

Style: direct, conversational, respectful — like a smart coach who knows your work. Refer to the client as "you". Don't use bullet points; write as one flowing paragraph. Don't restate the scores numerically. Don't include a greeting or sign-off. Return only the paragraph, no preamble.`;

  try {
    const response = await getAnthropic().messages.create({
      model: ANALYSIS_MODEL,
      max_tokens: 400,
      messages: [{ role: "user", content: prompt }],
    });
    const first = response.content[0];
    if (first && first.type === "text") {
      return first.text.trim();
    }
    return null;
  } catch {
    return null;
  }
}
