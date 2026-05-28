"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

type AnalysisStatus = "pending" | "processing" | "completed" | "failed";

type Stage = { id: AnalysisStatus | "uploading"; label: string };

const STAGES: Stage[] = [
  { id: "uploading", label: "Audio uploaded" },
  { id: "pending", label: "Queued for analysis" },
  { id: "processing", label: "Transcribing and reading your speech" },
  { id: "completed", label: "Done" },
];

function stageIndex(current: AnalysisStatus): number {
  // "uploading" is implicit — we're past it by the time we land here, so the
  // visible progression starts at "pending".
  if (current === "pending") return 1;
  if (current === "processing") return 2;
  if (current === "completed") return 3;
  return -1; // failed handled separately
}

export function PendingAnalysis({
  sessionId,
  initialStatus,
}: {
  sessionId: string;
  initialStatus: AnalysisStatus;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<AnalysisStatus>(initialStatus);
  const stoppedRef = useRef(false);

  useEffect(() => {
    stoppedRef.current = false;
    let cancelled = false;

    async function poll() {
      while (!cancelled && !stoppedRef.current) {
        try {
          const resp = await fetch(`/api/sessions/${sessionId}`, {
            cache: "no-store",
          });
          if (!resp.ok) {
            // Transient — wait and retry
            await sleep(3000);
            continue;
          }
          const data = (await resp.json()) as {
            fullSession?: {
              session?: { analysis_status?: AnalysisStatus };
            };
          };
          const next =
            data.fullSession?.session?.analysis_status ?? "pending";

          if (next !== status) {
            setStatus(next);
          }
          if (next === "completed" || next === "failed") {
            stoppedRef.current = true;
            // refresh the server component so the page renders the final state
            router.refresh();
            break;
          }
        } catch {
          // ignore transient errors, retry
        }
        await sleep(2500);
      }
    }

    void poll();
    return () => {
      cancelled = true;
      stoppedRef.current = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  const idx = stageIndex(status);

  return (
    <div className="flex w-full max-w-md flex-col gap-5 rounded-2xl border border-line bg-card p-6">
      <div className="flex items-center justify-between">
        <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">
          Working
        </div>
        <div className="cadence-pulse-dot" aria-hidden />
      </div>

      <div className="headline text-xl font-medium text-ink">
        Reading your recording…
      </div>

      <p className="text-sm leading-6 text-ink-2">
        Cadence is transcribing your audio and scoring it across six
        dimensions. This usually takes 30–60 seconds, depending on how long
        the recording was. You can leave this page open — it&apos;ll update
        as soon as the analysis is ready.
      </p>

      <ul className="flex flex-col gap-2.5">
        {STAGES.slice(0, 3).map((stage, i) => {
          const stageNum = i + 1; // skip the implicit "uploading" entry visually
          const isDone = stageNum < idx;
          const isActive = stageNum === idx;
          return (
            <li key={stage.id} className="flex items-center gap-3 text-sm">
              <span className="flex h-5 w-5 items-center justify-center">
                {isDone ? (
                  <span
                    className="flex h-4 w-4 items-center justify-center rounded-full bg-accent text-card"
                    aria-hidden
                  >
                    <svg
                      width="10"
                      height="10"
                      viewBox="0 0 10 10"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <polyline points="1.5,5 4,7.5 8.5,2.5" />
                    </svg>
                  </span>
                ) : isActive ? (
                  <span className="cadence-pulse-dot" aria-hidden />
                ) : (
                  <span
                    className="block h-3 w-3 rounded-full border border-line-strong"
                    aria-hidden
                  />
                )}
              </span>
              <span
                className={
                  isDone
                    ? "text-ink-2"
                    : isActive
                      ? "text-ink"
                      : "text-faint"
                }
              >
                {stage.label}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
