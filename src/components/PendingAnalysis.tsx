"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

type AnalysisStatus = "pending" | "processing" | "completed" | "failed";

type Stage = { id: AnalysisStatus | "uploading"; label: string };

// Three visible stages. The first ("uploading") is always already done by
// the time this component renders — the audio has been uploaded, the
// session row exists, the user is here. So it always shows as a green check.
const STAGES: Stage[] = [
  { id: "uploading", label: "Audio uploaded" },
  { id: "pending", label: "Queued for analysis" },
  { id: "processing", label: "Transcribing and reading your speech" },
];

function stageIndex(current: AnalysisStatus): number {
  if (current === "pending") return 1;
  if (current === "processing") return 2;
  if (current === "completed") return 3;
  return -1;
}

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/**
 * Rough estimate of processing time. Whisper scales ~linearly with audio
 * length (~8-15 sec per minute of audio); Claude is roughly constant
 * (~15-25 sec). Adds some overhead for queueing + DB writes.
 */
function estimateProcessingSeconds(
  durationMs: number | null,
): { low: number; high: number } {
  if (!durationMs) return { low: 30, high: 90 };
  const minutes = durationMs / 60_000;
  const low = Math.max(20, Math.round(20 + minutes * 8));
  const high = Math.max(45, Math.round(30 + minutes * 15));
  return { low, high };
}

export function PendingAnalysis({
  sessionId,
  initialStatus,
  durationMs,
}: {
  sessionId: string;
  initialStatus: AnalysisStatus;
  durationMs: number | null;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<AnalysisStatus>(initialStatus);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const stoppedRef = useRef(false);
  const startTimeRef = useRef(Date.now());

  const estimate = estimateProcessingSeconds(durationMs);

  // Wall-clock counter so the user has a sense the page is alive.
  useEffect(() => {
    startTimeRef.current = Date.now();
    setElapsedSeconds(0);
    const id = setInterval(() => {
      setElapsedSeconds(
        Math.floor((Date.now() - startTimeRef.current) / 1000),
      );
    }, 1000);
    return () => clearInterval(id);
  }, []);

  // Poll the session row until status flips to completed/failed.
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
  const isOverdue = elapsedSeconds > estimate.high + 30;

  return (
    <div className="flex w-full max-w-md flex-col gap-5 rounded-2xl border border-line bg-card p-6">
      <div className="flex items-center justify-between">
        <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">
          Working
        </div>
        <div className="flex items-center gap-2">
          <span className="cadence-pulse-dot" aria-hidden />
          <span className="font-mono text-xs tabular-nums text-muted">
            {formatElapsed(elapsedSeconds)}
          </span>
        </div>
      </div>

      <div className="headline text-xl font-medium text-ink">
        Reading your recording…
      </div>

      <p className="text-sm leading-6 text-ink-2">
        Cadence is transcribing your audio and scoring it across six
        dimensions. Recordings around this length usually take{" "}
        <span className="font-medium text-ink">
          {estimate.low}–{estimate.high} seconds
        </span>
        . You can leave this page open — it&apos;ll update as soon as the
        analysis is ready.
      </p>

      <ul className="flex flex-col gap-2.5">
        {STAGES.map((stage, i) => {
          const isDone = i < idx;
          const isActive = i === idx;
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

      {isOverdue ? (
        <div className="rounded-md bg-paper-2 px-3 py-2 text-xs leading-5 text-ink-2">
          Taking longer than usual. The analysis is still running — check the
          Inngest dashboard if you set this up, or try reloading the page.
        </div>
      ) : null}
    </div>
  );
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
