"use client";

import { useState } from "react";
import { DIMENSIONS, type Dimension } from "@/lib/rubric/dimensions";
import type { AnalysisResult, DimensionResult } from "@/lib/rubric/schema";

export type DimensionEntry = {
  dim: Dimension;
  data: DimensionResult;
};

export function getDimensionEntries(
  result: AnalysisResult,
): DimensionEntry[] {
  return DIMENSIONS.map((dim) => ({
    dim,
    data: result.dimensions[dim.id as keyof AnalysisResult["dimensions"]],
  })).filter((entry): entry is DimensionEntry => Boolean(entry.data));
}

export function pickFocus(
  entries: DimensionEntry[],
): DimensionEntry | null {
  if (entries.length === 0) return null;
  let best = entries[0];
  for (const entry of entries.slice(1)) {
    if (entry.data.score < best.data.score) best = entry;
  }
  return best;
}

export function AnalysisView({
  analysis,
  transcript,
}: {
  analysis: AnalysisResult;
  transcript: string;
}) {
  const [transcriptOpen, setTranscriptOpen] = useState(false);
  const entries = getDimensionEntries(analysis);
  const focus = pickFocus(entries);

  return (
    <div className="flex w-full max-w-md flex-col gap-4">
      {focus ? <FocusCard entry={focus} /> : null}

      <div className="flex flex-col gap-3">
        {entries.map(({ dim, data }) => (
          <DimensionCard key={dim.id} dim={dim} data={data} />
        ))}
      </div>

      <div className="flex flex-col gap-2 rounded-2xl border border-line bg-card p-4">
        <button
          type="button"
          onClick={() => setTranscriptOpen(!transcriptOpen)}
          className="self-start text-[10px] font-semibold uppercase tracking-[0.18em] text-muted transition-colors hover:text-ink"
        >
          {transcriptOpen ? "Hide transcript" : "Show transcript"}
        </button>
        {transcriptOpen ? (
          <div className="rounded-md bg-paper-2 px-3 py-2 text-sm leading-6 text-ink-2">
            {transcript}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function FocusCard({ entry }: { entry: DimensionEntry }) {
  const { dim, data } = entry;
  const firstExample = data.examples[0];
  return (
    <div className="flex flex-col gap-3 rounded-2xl bg-accent p-5 text-card shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex flex-col">
          <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-accent-tint">
            Focus today
          </div>
          <div className="headline mt-1 text-xl font-medium text-card">
            {dim.name}
          </div>
        </div>
        <div className="flex items-baseline gap-1 text-card">
          <span className="font-mono text-3xl font-semibold tabular-nums">
            {data.score}
          </span>
          <span className="font-mono text-sm opacity-70">/ 5</span>
        </div>
      </div>
      <p className="text-[14px] leading-6 text-card opacity-95">
        {data.reasoning}
      </p>
      {firstExample ? (
        <div className="rounded-md bg-card/10 px-3 py-2">
          <div className="text-sm italic leading-6 text-card">
            &ldquo;{firstExample.quote}&rdquo;
          </div>
          <div className="mt-1 text-xs text-card opacity-80">
            {firstExample.issue}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function DimensionCard({
  dim,
  data,
}: {
  dim: Dimension;
  data: DimensionResult;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-line bg-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">
            {dim.name}
          </div>
          <div className="text-[10px] text-faint">{dim.confidenceLabel}</div>
        </div>
        <div className="flex items-baseline gap-1">
          <span className="font-mono text-3xl font-semibold tabular-nums text-ink">
            {data.score}
          </span>
          <span className="font-mono text-xs text-muted">/ 5</span>
        </div>
      </div>

      <p className="text-[14px] leading-6 text-ink-2">{data.reasoning}</p>

      {data.examples.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {data.examples.map((ex, i) => (
            <li
              key={i}
              className="rounded-md bg-paper-2 px-3 py-2"
            >
              <div className="text-sm italic leading-6 text-ink">
                &ldquo;{ex.quote}&rdquo;
              </div>
              <div className="mt-1 text-xs text-ink-2">{ex.issue}</div>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
