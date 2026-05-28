"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

type Status =
  | "idle"
  | "recording"
  | "uploading"
  | "analyzing"
  | "error";

type AnalysisStage = "uploading" | "transcribing" | "reading";

type WakeLockSentinelLike = {
  release: () => Promise<void>;
};

type WakeLockApi = {
  request: (type: "screen") => Promise<WakeLockSentinelLike>;
};

const MAX_RECORDING_MS = 120_000; // 2 minutes — band-aid for the 60s Vercel function timeout; removed by M7 (background queue)
const URGENT_WINDOW_MS = 10_000;

function formatDuration(ms: number) {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}

type UploadAndAnalyzeProgress = {
  onUploaded?: () => void;
  onAnalyzeStart?: () => void;
};

async function uploadAndAnalyze(
  blob: Blob,
  durationMs: number,
  progress?: UploadAndAnalyzeProgress,
): Promise<{ sessionId: string }> {
  const mimeType = blob.type || "audio/webm";

  const urlResp = await fetch("/api/upload-url", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mimeType }),
  });
  if (!urlResp.ok) {
    const text = await urlResp.text();
    throw new Error(`Could not get upload URL: ${text}`);
  }
  const { uploadUrl, storagePath } = (await urlResp.json()) as {
    uploadUrl: string;
    storagePath: string;
  };

  const putResp = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": mimeType },
    body: blob,
  });
  if (!putResp.ok) {
    const text = await putResp.text();
    throw new Error(`Upload failed: ${text}`);
  }

  progress?.onUploaded?.();
  progress?.onAnalyzeStart?.();

  const analyzeResp = await fetch("/api/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ storagePath, mimeType, durationMs }),
  });
  if (!analyzeResp.ok) {
    const text = await analyzeResp.text();
    throw new Error(`Analysis failed: ${text}`);
  }
  return (await analyzeResp.json()) as { sessionId: string };
}

const STAGES: { id: AnalysisStage; label: string }[] = [
  { id: "uploading", label: "Uploading audio" },
  { id: "transcribing", label: "Transcribing what you said" },
  { id: "reading", label: "Reading your speech across six dimensions" },
];

function stageIndex(stage: AnalysisStage): number {
  return STAGES.findIndex((s) => s.id === stage);
}

export function Recorder() {
  const router = useRouter();
  const [status, setStatus] = useState<Status>("idle");
  const [elapsedMs, setElapsedMs] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [analysisStage, setAnalysisStage] =
    useState<AnalysisStage>("uploading");
  const [autoStopped, setAutoStopped] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const wakeLockRef = useRef<WakeLockSentinelLike | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startTimeRef = useRef<number>(0);
  const finalDurationRef = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stageTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const acquireWakeLock = useCallback(async () => {
    const wakeLock = (navigator as Navigator & { wakeLock?: WakeLockApi })
      .wakeLock;
    if (!wakeLock) return;
    try {
      wakeLockRef.current = await wakeLock.request("screen");
    } catch {
      // wake lock is best-effort
    }
  }, []);

  useEffect(() => {
    const onVisibility = () => {
      if (status === "recording" && document.visibilityState === "visible") {
        acquireWakeLock();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [status, acquireWakeLock]);

  useEffect(() => {
    return () => {
      if (
        mediaRecorderRef.current &&
        mediaRecorderRef.current.state !== "inactive"
      ) {
        mediaRecorderRef.current.stop();
      }
      streamRef.current?.getTracks().forEach((t) => t.stop());
      wakeLockRef.current?.release().catch(() => {});
      if (timerRef.current) clearInterval(timerRef.current);
      if (stageTimeoutRef.current) clearTimeout(stageTimeoutRef.current);
    };
  }, []);

  async function start() {
    setErrorMessage(null);
    setAutoStopped(false);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      streamRef.current = stream;
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const mime = recorder.mimeType || "audio/webm";
        const blob = new Blob(chunksRef.current, { type: mime });
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        processBlob(blob, finalDurationRef.current);
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      startTimeRef.current = Date.now();
      setElapsedMs(0);
      timerRef.current = setInterval(() => {
        const now = Date.now() - startTimeRef.current;
        setElapsedMs(now);
        // Auto-stop at the cap
        if (
          now >= MAX_RECORDING_MS &&
          mediaRecorderRef.current?.state === "recording"
        ) {
          setAutoStopped(true);
          stop();
        }
      }, 100);
      await acquireWakeLock();
      setStatus("recording");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Could not access microphone.";
      setErrorMessage(message);
      setStatus("error");
    }
  }

  async function processBlob(blob: Blob, durationMs: number) {
    setStatus("uploading");
    setAnalysisStage("uploading");
    try {
      const { sessionId } = await uploadAndAnalyze(blob, durationMs, {
        onUploaded: () => {
          setStatus("analyzing");
          setAnalysisStage("transcribing");
          stageTimeoutRef.current = setTimeout(() => {
            setAnalysisStage((prev) =>
              prev === "transcribing" ? "reading" : prev,
            );
          }, 7000);
        },
      });
      router.push(`/sessions/${sessionId}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Analysis failed.";
      setErrorMessage(message);
      setStatus("error");
    } finally {
      if (stageTimeoutRef.current) clearTimeout(stageTimeoutRef.current);
    }
  }

  function stop() {
    if (!mediaRecorderRef.current) return;
    finalDurationRef.current = Math.min(
      Date.now() - startTimeRef.current,
      MAX_RECORDING_MS,
    );
    if (mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    wakeLockRef.current?.release().catch(() => {});
    wakeLockRef.current = null;
  }

  function resetError() {
    setStatus("idle");
    setElapsedMs(0);
    setErrorMessage(null);
    setAutoStopped(false);
  }

  const isRecording = status === "recording";
  const isProcessing = status === "uploading" || status === "analyzing";
  const buttonDisabled = isProcessing;
  const remainingMs = Math.max(0, MAX_RECORDING_MS - elapsedMs);
  const isUrgent =
    isRecording && remainingMs > 0 && remainingMs <= URGENT_WINDOW_MS;
  const cappedElapsed = Math.min(elapsedMs, MAX_RECORDING_MS);

  return (
    <div className="flex w-full flex-col items-center gap-10">
      <button
        type="button"
        onClick={isRecording ? stop : start}
        disabled={buttonDisabled}
        aria-label={
          isRecording
            ? "Stop recording"
            : isProcessing
              ? "Analyzing your recording"
              : "Start recording"
        }
        className={`group relative flex h-40 w-40 items-center justify-center rounded-full transition-all ${
          isRecording
            ? "bg-record shadow-[0_0_0_10px_var(--color-record-tint)]"
            : isProcessing
              ? "bg-card border border-line cursor-default"
              : "bg-accent hover:bg-accent-strong active:scale-95"
        }`}
      >
        {isRecording ? (
          <>
            <span className="block h-12 w-12 rounded-md bg-card" />
            <span
              className="pointer-events-none absolute inset-0 animate-ping rounded-full"
              style={{
                background:
                  "color-mix(in srgb, var(--color-record) 35%, transparent)",
              }}
            />
          </>
        ) : isProcessing ? (
          <ProcessingBars />
        ) : (
          <span className="block h-16 w-16 rounded-full bg-card" />
        )}
      </button>

      <div className="flex flex-col items-center gap-3">
        <div
          className={`font-mono text-3xl tabular-nums transition-colors ${
            isUrgent ? "text-record" : "text-ink"
          }`}
        >
          {isRecording
            ? `${formatDuration(cappedElapsed)} / ${formatDuration(MAX_RECORDING_MS)}`
            : formatDuration(cappedElapsed)}
        </div>

        {isRecording ? (
          <RecordingProgressBar
            elapsedMs={cappedElapsed}
            maxMs={MAX_RECORDING_MS}
            isUrgent={isUrgent}
          />
        ) : null}

        {status === "idle" && (
          <>
            <div className="text-sm text-muted">Tap to start</div>
            <div className="text-xs italic text-faint">
              Max 2:00 per session
            </div>
          </>
        )}
        {status === "recording" && (
          <div className="text-sm text-muted">Recording — tap to stop</div>
        )}
        {status === "error" && (
          <div className="text-sm text-record">Something went wrong</div>
        )}

        {autoStopped && (status === "recording" || isProcessing) ? (
          <div className="cadence-flash text-xs italic text-record">
            Max length reached
          </div>
        ) : null}
      </div>

      {isProcessing ? (
        <ProcessingChecklist currentStage={analysisStage} />
      ) : null}

      {errorMessage ? (
        <div className="flex w-full max-w-md flex-col items-center gap-3 rounded-md border border-record bg-record-tint px-4 py-3 text-sm text-record">
          <div className="text-center">{errorMessage}</div>
          <button
            type="button"
            onClick={resetError}
            className="rounded-full border border-record px-3 py-1 text-xs font-medium text-record transition-colors hover:bg-paper"
          >
            Try again
          </button>
        </div>
      ) : null}
    </div>
  );
}

function RecordingProgressBar({
  elapsedMs,
  maxMs,
  isUrgent,
}: {
  elapsedMs: number;
  maxMs: number;
  isUrgent: boolean;
}) {
  const pct = Math.min(100, (elapsedMs / maxMs) * 100);
  return (
    <div
      className="h-[3px] w-48 overflow-hidden rounded-full bg-line"
      role="progressbar"
      aria-label="Recording progress toward maximum length"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className="h-full transition-[width,background-color] duration-150"
        style={{
          width: `${pct}%`,
          background: isUrgent
            ? "var(--color-record)"
            : "var(--color-accent)",
        }}
      />
    </div>
  );
}

function ProcessingBars() {
  return (
    <div
      className="flex h-12 items-center justify-center gap-2"
      aria-hidden
    >
      <span
        className="cadence-pulse-bar"
        style={{ height: 36, animationDelay: "0ms" }}
      />
      <span
        className="cadence-pulse-bar"
        style={{ height: 36, animationDelay: "150ms" }}
      />
      <span
        className="cadence-pulse-bar"
        style={{ height: 36, animationDelay: "300ms" }}
      />
      <span
        className="cadence-pulse-bar"
        style={{ height: 36, animationDelay: "450ms" }}
      />
    </div>
  );
}

function ProcessingChecklist({
  currentStage,
}: {
  currentStage: AnalysisStage;
}) {
  const currentIndex = stageIndex(currentStage);
  return (
    <div className="flex w-full max-w-sm flex-col gap-3 rounded-2xl border border-line bg-card p-5">
      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">
        Working
      </div>
      <ul className="flex flex-col gap-2.5">
        {STAGES.map((stage, idx) => {
          const isDone = idx < currentIndex;
          const isActive = idx === currentIndex;
          return (
            <li
              key={stage.id}
              className="flex items-center gap-3 text-sm"
            >
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
