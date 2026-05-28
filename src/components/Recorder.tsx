"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

type Status =
  | "idle"
  | "recording"
  | "uploading"
  | "analyzing"
  | "error";

type WakeLockSentinelLike = {
  release: () => Promise<void>;
};

type WakeLockApi = {
  request: (type: "screen") => Promise<WakeLockSentinelLike>;
};

function formatDuration(ms: number) {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}

async function uploadAndAnalyze(
  blob: Blob,
  durationMs: number,
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

export function Recorder() {
  const router = useRouter();
  const [status, setStatus] = useState<Status>("idle");
  const [elapsedMs, setElapsedMs] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const wakeLockRef = useRef<WakeLockSentinelLike | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startTimeRef = useRef<number>(0);
  const finalDurationRef = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
    };
  }, []);

  async function start() {
    setErrorMessage(null);
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

  async function processBlob(blob: Blob, durationMs: number) {
    setStatus("uploading");
    try {
      setTimeout(() => {
        setStatus((prev) => (prev === "uploading" ? "analyzing" : prev));
      }, 800);
      const { sessionId } = await uploadAndAnalyze(blob, durationMs);
      router.push(`/sessions/${sessionId}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Analysis failed.";
      setErrorMessage(message);
      setStatus("error");
    }
  }

  function stop() {
    if (!mediaRecorderRef.current) return;
    finalDurationRef.current = Date.now() - startTimeRef.current;
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
  }

  const isRecording = status === "recording";
  const isProcessing = status === "uploading" || status === "analyzing";
  const buttonDisabled = isProcessing;

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
          {status === "analyzing" && "Analyzing four dimensions…"}
          {status === "error" && "Something went wrong"}
        </div>
      </div>

      {errorMessage ? (
        <div className="flex w-full max-w-md flex-col items-center gap-3 rounded-md bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
          <div className="text-center">{errorMessage}</div>
          <button
            type="button"
            onClick={resetError}
            className="rounded-full border border-red-300 px-3 py-1 text-xs font-medium text-red-700 hover:bg-red-100 dark:border-red-800/60 dark:text-red-300 dark:hover:bg-red-950"
          >
            Try again
          </button>
        </div>
      ) : null}
    </div>
  );
}
