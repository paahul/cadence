"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Status = "idle" | "recording" | "ready" | "error";

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

export function Recorder() {
  const [status, setStatus] = useState<Status>("idle");
  const [elapsedMs, setElapsedMs] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioMime, setAudioMime] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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
      // wake lock is best-effort — recording continues even if it fails
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
        setAudioMime(mime);
        setStatus("ready");
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
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
    setAudioMime(null);
    setStatus("idle");
    setElapsedMs(0);
    setErrorMessage(null);
  }

  const isRecording = status === "recording";
  const isReady = status === "ready";

  return (
    <div className="flex w-full flex-col items-center gap-8">
      <button
        type="button"
        onClick={isRecording ? stop : start}
        disabled={isReady}
        aria-label={isRecording ? "Stop recording" : "Start recording"}
        className={`group relative flex h-40 w-40 items-center justify-center rounded-full transition-all ${
          isRecording
            ? "bg-red-600 shadow-[0_0_0_8px_rgba(220,38,38,0.18)]"
            : "bg-slate-900 hover:bg-slate-800 active:scale-95 dark:bg-slate-100 dark:hover:bg-white"
        } ${isReady ? "opacity-40" : ""}`}
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
          {status === "ready" && "Recording captured"}
          {status === "error" && "Something went wrong"}
        </div>
      </div>

      {isReady && audioUrl ? (
        <div className="flex w-full flex-col items-center gap-3">
          <audio
            controls
            src={audioUrl}
            className="w-full max-w-sm"
          />
          <div className="text-xs text-zinc-500 dark:text-zinc-500">
            Format: {audioMime ?? "unknown"}
          </div>
          <button
            type="button"
            onClick={reset}
            className="rounded-full border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
          >
            Record again
          </button>
        </div>
      ) : null}

      {errorMessage ? (
        <div className="max-w-sm rounded-md bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
          {errorMessage}
        </div>
      ) : null}
    </div>
  );
}
