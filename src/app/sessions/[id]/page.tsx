import Link from "next/link";
import { notFound } from "next/navigation";
import { AnalysisView } from "@/components/AnalysisView";
import { getSession } from "@/lib/db";

export const dynamic = "force-dynamic";

function formatDuration(ms: number | null): string {
  if (ms == null) return "—";
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function formatFullDate(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default async function SessionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const fullSession = await getSession(id).catch(() => null);

  if (!fullSession) {
    notFound();
  }

  const { session, transcript, analysis } = fullSession;

  return (
    <div className="flex flex-1 flex-col bg-zinc-50 dark:bg-black">
      <header className="flex items-center justify-between border-b border-zinc-200 px-6 py-4 dark:border-zinc-900">
        <Link
          href="/"
          className="text-sm font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
        >
          ← Sessions
        </Link>
        <div className="flex flex-col items-center">
          <div className="text-xs font-medium uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
            {formatFullDate(session.created_at)}
          </div>
          <div className="font-mono text-[10px] tabular-nums text-zinc-400 dark:text-zinc-500">
            {formatDuration(session.duration_ms)}
          </div>
        </div>
        <div className="w-16" aria-hidden />
      </header>

      <main className="flex w-full flex-1 flex-col items-center px-6 py-6">
        {analysis && transcript ? (
          <AnalysisView
            analysis={{ dimensions: analysis.dimensions }}
            transcript={transcript.text}
          />
        ) : (
          <div className="rounded-md bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
            This session is missing transcript or analysis data.
          </div>
        )}
      </main>
    </div>
  );
}
