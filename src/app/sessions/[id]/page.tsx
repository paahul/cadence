import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AnalysisView } from "@/components/AnalysisView";
import { PendingAnalysis } from "@/components/PendingAnalysis";
import { RetryButton } from "@/components/RetryButton";
import { getMySession } from "@/lib/db";
import { RECORDINGS_BUCKET, getSupabaseAdmin } from "@/lib/supabase/admin";
import { getSupabaseServer } from "@/lib/supabase/server";

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

async function signedAudioUrl(storagePath: string): Promise<string | null> {
  try {
    const { data, error } = await getSupabaseAdmin()
      .storage.from(RECORDINGS_BUCKET)
      .createSignedUrl(storagePath, 60 * 60);
    if (error || !data?.signedUrl) return null;
    return data.signedUrl;
  } catch {
    return null;
  }
}

export default async function SessionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const supabase = await getSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const { id } = await params;
  const fullSession = await getMySession(supabase, id).catch(() => null);

  if (!fullSession) {
    notFound();
  }

  const { session, transcript, analysis } = fullSession;
  const status = session.analysis_status;
  const audioUrl = await signedAudioUrl(session.storage_path);

  return (
    <div className="flex flex-1 flex-col bg-paper">
      <header className="flex items-center justify-between border-b border-line px-6 py-5">
        <Link
          href="/"
          className="text-sm font-medium text-muted transition-colors hover:text-ink"
        >
          ← Sessions
        </Link>
        <div className="flex flex-col items-center">
          <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted">
            {formatFullDate(session.created_at)}
          </div>
          <div className="font-mono text-[10px] tabular-nums text-faint">
            {formatDuration(session.duration_ms)}
          </div>
        </div>
        <div className="w-16" aria-hidden />
      </header>

      <main className="flex w-full flex-1 flex-col items-center gap-5 px-6 py-7">
        {audioUrl ? (
          <div className="flex w-full max-w-md flex-col gap-2 rounded-2xl border border-line bg-card p-4">
            <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">
              Listen back
            </div>
            <audio
              controls
              preload="metadata"
              src={audioUrl}
              className="w-full"
            />
          </div>
        ) : null}

        {status === "pending" || status === "processing" ? (
          <PendingAnalysis
            sessionId={id}
            initialStatus={status}
            durationMs={session.duration_ms}
          />
        ) : status === "failed" ? (
          <div className="flex w-full max-w-md flex-col gap-4 rounded-2xl border border-record bg-record-tint p-5">
            <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-record">
              Analysis failed
            </div>
            <div className="text-sm leading-6 text-ink-2">
              Something went wrong while analyzing this recording. You can try
              again — the audio itself was uploaded fine.
            </div>
            {session.analysis_error ? (
              <div className="rounded-md bg-paper px-3 py-2 font-mono text-[11px] leading-5 text-ink-2">
                {session.analysis_error}
              </div>
            ) : null}
            <RetryButton sessionId={id} />
          </div>
        ) : analysis && transcript ? (
          <AnalysisView
            analysis={{ dimensions: analysis.dimensions }}
            transcript={transcript.text}
          />
        ) : (
          <div className="rounded-md border border-warn bg-paper-2 px-4 py-3 text-sm text-warn">
            This session is missing transcript or analysis data.
          </div>
        )}
      </main>
    </div>
  );
}
