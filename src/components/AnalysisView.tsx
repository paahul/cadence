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

      <div className="flex flex-col gap-2 rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
        <button
          type="button"
          onClick={() => setTranscriptOpen(!transcriptOpen)}
          className="self-start text-xs font-medium uppercase tracking-[0.14em] text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
        >
          {transcriptOpen ? "Hide transcript" : "Show transcript"}
        </button>
        {transcriptOpen ? (
          <div className="rounded-md bg-zinc-50 px-3 py-2 text-sm leading-6 text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
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
    <div className="flex flex-col gap-3 rounded-2xl border-2 border-slate-900 bg-slate-900 p-5 text-slate-50 shadow-md dark:border-slate-100 dark:bg-slate-100 dark:text-slate-900">
      <div className="flex items-center justify-between">
        <div className="flex flex-col">
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-300 dark:text-slate-600">
            Focus today
          </div>
          <div className="mt-1 text-lg font-semibold">{dim.name}</div>
        </div>
        <div className="flex items-baseline gap-1">
          <span className="font-mono text-3xl font-semibold tabular-nums">
            {data.score}
          </span>
          <span className="font-mono text-sm text-slate-400 dark:text-slate-500">
            / 5
          </span>
        </div>
      </div>
      <p className="text-sm leading-6 text-slate-100 dark:text-slate-800">
        {data.reasoning}
      </p>
      {firstExample ? (
        <div className="rounded-md bg-white/10 px-3 py-2 dark:bg-black/10">
          <div className="text-sm italic">
            &ldquo;{firstExample.quote}&rdquo;
          </div>
          <div className="mt-1 text-xs text-slate-300 dark:text-slate-600">
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
    <div className="flex flex-col gap-3 rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-medium uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">
            {dim.name}
          </div>
          <div className="text-[11px] text-zinc-400 dark:text-zinc-500">
            {dim.confidenceLabel}
          </div>
        </div>
        <div className="flex items-baseline gap-1">
          <span className="font-mono text-3xl font-semibold tabular-nums text-zinc-950 dark:text-zinc-50">
            {data.score}
          </span>
          <span className="font-mono text-xs text-zinc-400">/ 5</span>
        </div>
      </div>

      <p className="text-sm leading-6 text-zinc-700 dark:text-zinc-300">
        {data.reasoning}
      </p>

      {data.examples.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {data.examples.map((ex, i) => (
            <li
              key={i}
              className="rounded-md bg-zinc-50 px-3 py-2 dark:bg-zinc-900"
            >
              <div className="text-sm italic text-zinc-800 dark:text-zinc-200">
                &ldquo;{ex.quote}&rdquo;
              </div>
              <div className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
                {ex.issue}
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
