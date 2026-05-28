"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { WordPrecisionResult } from "@/lib/rubric/word-precision";

type Status =
  | "idle"
  | "recording"
  | "uploading"
  | "analyzing"
  | "analyzed"
  | "error";

type WakeLockSentinelLike = {
  release: () => Promise<void>;
};

type WakeLockApi = {
  request: (type: "screen") => Promise<WakeLockSentinelLike>;
};

type AnalyzeResponse = {
  transcript: string;
  analysis: WordPrecisionResult;
};

function formatDuration(ms: number) {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}

async function uploadAndAnalyze(blob: Blob): Promise<AnalyzeResponse> {
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

  const analyzeResp = await fetch("/api/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ storagePath }),
  });
  if (!analyzeResp.ok) {
    const text = await analyzeResp.text();
    throw new Error(`Analysis failed: ${text}`);
  }
  return (await analyzeResp.json()) as AnalyzeResponse;
}

export function Recorder() {
  const [status, setStatus] = useState<Status>("idle");
  const [elapsedMs, setElapsedMs] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [result, setResult] = useState<AnalyzeResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [transcriptOpen, setTranscriptOpen] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const wakeLockRef = useRef<WakeLockSentinelLike | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startTimeRef = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioUrlRef = useRef<string | null>(null);

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
    audioUrlRef.current = audioUrl;
  }, [audioUrl]);

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
      if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
    };
  }, []);

  async function start() {
    setErrorMessage(null);
    setResult(null);
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
      setAudioUrl(null);
    }
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
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        // Auto-kick off upload + analyze
        processBlob(blob);
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      startTimeRef.current = Date.now();
      setElapsedMs(0);
      timerRef.current = setInterval(() => {
        setElapsedMs(Date.now() - startTimeRef.current);
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

  async function processBlob(blob: Blob) {
    setStatus("uploading");
    try {
      // Once upload completes, we flip to analyzing inside uploadAndAnalyze
      // For simplicity we go uploading -> analyzing as one phase from the user's POV
      setTimeout(() => {
        setStatus((prev) => (prev === "uploading" ? "analyzing" : prev));
      }, 800);
      const response = await uploadAndAnalyze(blob);
      setResult(response);
      setStatus("analyzed");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Analysis failed.";
      setErrorMessage(message);
      setStatus("error");
    }
  }

  function stop() {
    if (!mediaRecorderRef.current) return;
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

  function reset() {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl(null);
    setResult(null);
    setStatus("idle");
    setElapsedMs(0);
    setErrorMessage(null);
    setTranscriptOpen(false);
  }

  const isRecording = status === "recording";
  const isProcessing = status === "uploading" || status === "analyzing";
  const isAnalyzed = status === "analyzed";
  const buttonDisabled = isProcessing || isAnalyzed;

  return (
    <div className="flex w-full flex-col items-center gap-8">
      <button
        type="button"
        onClick={isRecording ? stop : start}
        disabled={buttonDisabled}
        aria-label={isRecording ? "Stop recording" : "Start recording"}
        className={`group relative flex h-40 w-40 items-center justify-center rounded-full transition-all ${
          isRecording
            ? "bg-red-600 shadow-[0_0_0_8px_rgba(220,38,38,0.18)]"
            : "bg-slate-900 hover:bg-slate-800 active:scale-95 dark:bg-slate-100 dark:hover:bg-white"
        } ${buttonDisabled ? "opacity-40" : ""}`}
      >
        {isRecording ? (
          <span className="block h-12 w-12 rounded-md bg-white" />
        ) : (
          <span className="block h-16 w-16 rounded-full bg-white dark:bg-slate-900" />
        )}
        {isRecording ? (
          <span className="pointer-events-none absolute inset-0 animate-ping rounded-full bg-red-500/30" />
        ) : null}
      </button>

      <div className="flex flex-col items-center gap-1">
        <div className="font-mono text-3xl tabular-nums text-zinc-950 dark:text-zinc-50">
          {formatDuration(elapsedMs)}
        </div>
        <div className="text-sm text-zinc-500 dark:text-zinc-400">
          {status === "idle" && "Tap to start"}
          {status === "recording" && "Recording — tap to stop"}
          {status === "uploading" && "Uploading…"}
          {status === "analyzing" && "Analyzing word precision…"}
          {status === "analyzed" && "Analysis ready"}
          {status === "error" && "Something went wrong"}
        </div>
      </div>

      {isAnalyzed && result ? (
        <AnalysisCard result={result} onReset={reset} transcriptOpen={transcriptOpen} setTranscriptOpen={setTranscriptOpen} />
      ) : null}

      {errorMessage ? (
        <div className="flex w-full max-w-md flex-col items-center gap-3 rounded-md bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
          <div className="text-center">{errorMessage}</div>
          <button
            type="button"
            onClick={reset}
            className="rounded-full border border-red-300 px-3 py-1 text-xs font-medium text-red-700 hover:bg-red-100 dark:border-red-800/60 dark:text-red-300 dark:hover:bg-red-950"
          >
            Try again
          </button>
        </div>
      ) : null}
    </div>
  );
}

function AnalysisCard({
  result,
  onReset,
  transcriptOpen,
  setTranscriptOpen,
}: {
  result: AnalyzeResponse;
  onReset: () => void;
  transcriptOpen: boolean;
  setTranscriptOpen: (v: boolean) => void;
}) {
  const { analysis, transcript } = result;
  return (
    <div className="flex w-full max-w-md flex-col gap-5 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs font-medium uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">
            Word Precision
          </div>
          <div className="text-[11px] text-zinc-400 dark:text-zinc-500">
            High tool reliability
          </div>
        </div>
        <div className="flex items-baseline gap-1">
          <span className="font-mono text-4xl font-semibold tabular-nums text-zinc-950 dark:text-zinc-50">
            {analysis.score}
          </span>
          <span className="font-mono text-sm text-zinc-400">/ 5</span>
        </div>
      </div>

      <p className="text-sm leading-6 text-zinc-700 dark:text-zinc-300">
        {analysis.reasoning}
      </p>

      {analysis.examples.length > 0 ? (
        <div className="flex flex-col gap-3">
          <div className="text-xs font-medium uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">
            Examples
          </div>
          <ul className="flex flex-col gap-3">
            {analysis.examples.map((ex, i) => (
              <li key={i} className="rounded-md bg-zinc-50 px-3 py-2 dark:bg-zinc-900">
                <div className="text-sm italic text-zinc-800 dark:text-zinc-200">
                  &ldquo;{ex.quote}&rdquo;
                </div>
                <div className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
                  {ex.issue}
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={() => setTranscriptOpen(!transcriptOpen)}
          className="text-left text-xs font-medium uppercase tracking-[0.14em] text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
        >
          {transcriptOpen ? "Hide transcript" : "Show transcript"}
        </button>
        {transcriptOpen ? (
          <div className="rounded-md bg-zinc-50 px-3 py-2 text-sm leading-6 text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
            {transcript}
          </div>
        ) : null}
      </div>

      <button
        type="button"
        onClick={onReset}
        className="self-center rounded-full border border-zinc-300 px-5 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
      >
        Record again
      </button>
    </div>
  );
}
