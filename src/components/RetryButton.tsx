"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function RetryButton({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onClick() {
    setPending(true);
    setError(null);
    try {
      const resp = await fetch(`/api/sessions/${sessionId}/retry`, {
        method: "POST",
      });
      if (!resp.ok) {
        const data = (await resp.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(data.error ?? `Retry failed (${resp.status})`);
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Retry failed");
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <button
        type="button"
        onClick={onClick}
        disabled={pending}
        className="rounded-full bg-accent px-5 py-2 text-sm font-medium text-card transition-colors hover:bg-accent-strong disabled:opacity-50"
      >
        {pending ? "Re-running…" : "Re-run analysis"}
      </button>
      {error ? (
        <div className="text-xs text-record">{error}</div>
      ) : null}
    </div>
  );
}
