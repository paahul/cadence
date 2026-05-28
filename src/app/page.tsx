import Link from "next/link";
import { redirect } from "next/navigation";
import { listMySessions, type FullSession } from "@/lib/db";
import { DIMENSIONS } from "@/lib/rubric/dimensions";
import type { AnalysisResult } from "@/lib/rubric/schema";
import { getSupabaseServer } from "@/lib/supabase/server";
import { SignOutButton } from "./SignOutButton";

export const dynamic = "force-dynamic";

function formatRelative(iso: string): string {
  const date = new Date(iso);
  const diffMs = Date.now() - date.getTime();
  const diffMin = diffMs / 60000;
  const diffHr = diffMin / 60;
  const diffDay = diffHr / 24;

  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${Math.floor(diffMin)}m ago`;
  if (diffHr < 24) return `${Math.floor(diffHr)}h ago`;
  if (diffDay < 7) return `${Math.floor(diffDay)}d ago`;
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function formatDuration(ms: number | null): string {
  if (ms == null) return "—";
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function pickFocusFromAnalysis(dims: AnalysisResult["dimensions"]) {
  let best: { name: string; score: number } | null = null;
  for (const dim of DIMENSIONS) {
    const data = dims[dim.id as keyof AnalysisResult["dimensions"]];
    if (!data) continue;
    if (!best || data.score < best.score) {
      best = { name: dim.name, score: data.score };
    }
  }
  return best;
}

export default async function Home() {
  const supabase = await getSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Middleware should have redirected unauth users; defensive check anyway.
  if (!user) redirect("/sign-in");

  let sessions: FullSession[] = [];
  let loadError: string | null = null;
  try {
    sessions = await listMySessions(supabase, 50);
  } catch (err) {
    loadError = err instanceof Error ? err.message : String(err);
  }

  return (
    <div className="flex flex-1 flex-col bg-zinc-50 dark:bg-black">
      <header className="flex items-center justify-between border-b border-zinc-200 px-6 py-4 dark:border-zinc-900">
        <div className="flex flex-col">
          <div className="text-xs font-medium uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
            Cadence
          </div>
          <div className="text-xs text-zinc-400 dark:text-zinc-500">
            {sessions.length === 0
              ? "No recordings yet"
              : `${sessions.length} ${sessions.length === 1 ? "session" : "sessions"}`}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <SignOutButton />
          <Link
            href="/new"
            className="rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-slate-50 hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
          >
            + New
          </Link>
        </div>
      </header>

      <main className="flex flex-1 flex-col gap-3 px-6 py-6">
        {loadError ? (
          <div className="rounded-md bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
            <div className="font-medium">Couldn&apos;t load your sessions.</div>
            <div className="mt-1 text-xs">{loadError}</div>
            <div className="mt-2 text-xs text-amber-800 dark:text-amber-300">
              If this is the first run after the M5 migration, make sure
              you&apos;ve run <code>supabase/migrations/0002_multi_user.sql</code>{" "}
              in your Supabase SQL editor.
            </div>
          </div>
        ) : null}

        {sessions.length === 0 && !loadError ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 py-16 text-center">
            <div className="text-base text-zinc-700 dark:text-zinc-300">
              Welcome, {user.email}.
            </div>
            <div className="max-w-xs text-sm text-zinc-500 dark:text-zinc-400">
              Tap <span className="font-medium">+ New</span> to record your
              first session. Cadence analyzes how you communicate — clarity,
              conciseness, confidence, and word precision — using your own
              voice.
            </div>
          </div>
        ) : null}

        {sessions.map(({ session, analysis, transcript }) => {
          const focus = analysis
            ? pickFocusFromAnalysis(analysis.dimensions)
            : null;
          const snippet = transcript?.text.slice(0, 120) ?? "";
          return (
            <Link
              key={session.id}
              href={`/sessions/${session.id}`}
              className="flex flex-col gap-2 rounded-2xl border border-zinc-200 bg-white p-4 transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:bg-zinc-900"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                  {formatRelative(session.created_at)}
                </div>
                <div className="font-mono text-xs tabular-nums text-zinc-500 dark:text-zinc-400">
                  {formatDuration(session.duration_ms)}
                </div>
              </div>
              {focus ? (
                <div className="text-xs text-zinc-600 dark:text-zinc-400">
                  Focus:{" "}
                  <span className="font-medium text-zinc-800 dark:text-zinc-200">
                    {focus.name} {focus.score}/5
                  </span>
                </div>
              ) : null}
              {snippet ? (
                <div className="text-sm italic leading-6 text-zinc-500 dark:text-zinc-500">
                  &ldquo;{snippet}
                  {(transcript?.text.length ?? 0) > 120 ? "…" : ""}&rdquo;
                </div>
              ) : null}
            </Link>
          );
        })}
      </main>
    </div>
  );
}
