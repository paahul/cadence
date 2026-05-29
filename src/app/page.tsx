import Link from "next/link";
import { redirect } from "next/navigation";
import { listMySessions, type FullSession } from "@/lib/db";
import { DIMENSIONS } from "@/lib/rubric/dimensions";
import type { AnalysisResult } from "@/lib/rubric/schema";
import { getSupabaseServer } from "@/lib/supabase/server";
import { SignOutButton } from "./SignOutButton";

export const dynamic = "force-dynamic";

function formatDuration(ms: number | null): string {
  if (ms == null) return "—";
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

// Server components run on Vercel in UTC by default. Pin display to ET so
// times match what Paahul actually recorded at. Becomes a per-user pref
// once more users than just Paahul exist.
const DISPLAY_TZ = "America/New_York";

function formatTimeShort(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: DISPLAY_TZ,
  });
}

function formatDateShort(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: DISPLAY_TZ,
  });
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

type GroupKey = "today" | "yesterday" | "thisWeek" | "earlier";

// "YYYY-MM-DD" representation of `date` in the display timezone. Used so
// that "today" / "yesterday" grouping uses ET calendar days, not the
// Vercel-server-default UTC calendar days (otherwise a session recorded
// at 8pm ET shows under Yesterday between 7pm-midnight ET).
function etDayKey(date: Date): string {
  return date.toLocaleDateString("en-CA", { timeZone: DISPLAY_TZ });
}

function groupForSession(iso: string, now: Date): GroupKey {
  const todayKey = etDayKey(now);
  const sessionKey = etDayKey(new Date(iso));
  // Parse keys as UTC midnight just for arithmetic — only the day-delta matters.
  const todayMs = new Date(todayKey + "T00:00:00Z").getTime();
  const sessionMs = new Date(sessionKey + "T00:00:00Z").getTime();
  const diffDays = Math.round((todayMs - sessionMs) / (24 * 60 * 60 * 1000));
  if (diffDays <= 0) return "today";
  if (diffDays === 1) return "yesterday";
  if (diffDays < 7) return "thisWeek";
  return "earlier";
}

const GROUP_LABELS: Record<GroupKey, string> = {
  today: "Today",
  yesterday: "Yesterday",
  thisWeek: "This week",
  earlier: "Earlier",
};
const GROUP_ORDER: GroupKey[] = ["today", "yesterday", "thisWeek", "earlier"];

function ScoreBars({ dims }: { dims: AnalysisResult["dimensions"] }) {
  return (
    <div className="flex items-end gap-[3px]" aria-label="Per-dimension scores">
      {DIMENSIONS.map((dim) => {
        const data = dims[dim.id as keyof AnalysisResult["dimensions"]];
        const score = data?.score ?? 0;
        const heightPx = Math.max(2, Math.round((score / 5) * 18));
        return (
          <div
            key={dim.id}
            className="w-[5px] rounded-[1px] bg-line-strong"
            style={{ height: "18px", position: "relative" }}
            title={`${dim.name}: ${score}/5`}
          >
            <div
              className="absolute bottom-0 left-0 w-full rounded-[1px] bg-accent"
              style={{ height: `${heightPx}px` }}
            />
          </div>
        );
      })}
    </div>
  );
}

export default async function Home() {
  const supabase = await getSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  let sessions: FullSession[] = [];
  let loadError: string | null = null;
  try {
    sessions = await listMySessions(supabase, 50);
  } catch (err) {
    loadError = err instanceof Error ? err.message : String(err);
  }

  const now = new Date();
  const grouped: Record<GroupKey, FullSession[]> = {
    today: [],
    yesterday: [],
    thisWeek: [],
    earlier: [],
  };
  for (const s of sessions) {
    grouped[groupForSession(s.session.created_at, now)].push(s);
  }

  return (
    <div className="flex flex-1 flex-col bg-paper">
      <header className="flex items-center justify-between border-b border-line px-6 py-5">
        <div className="flex flex-col">
          <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted">
            Cadence
          </div>
          <div className="text-[11px] text-faint">
            {sessions.length === 0
              ? "No recordings yet"
              : `${sessions.length} ${sessions.length === 1 ? "session" : "sessions"}`}
          </div>
        </div>
        <div className="flex items-center gap-4">
          <SignOutButton />
          <Link
            href="/new"
            className="rounded-full bg-accent px-4 py-2 text-sm font-medium text-card transition-colors hover:bg-accent-strong"
          >
            + New
          </Link>
        </div>
      </header>

      <main className="flex flex-1 flex-col gap-4 px-6 py-7">
        {loadError ? (
          <div className="rounded-md border border-warn bg-paper-2 px-4 py-3 text-sm text-warn">
            <div className="font-medium">Couldn&apos;t load your sessions.</div>
            <div className="mt-1 text-xs text-ink-2">{loadError}</div>
          </div>
        ) : null}

        {sessions.length === 0 && !loadError ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 py-16 text-center">
            <h2 className="headline text-2xl font-medium text-ink">
              Welcome, {user.email}.
            </h2>
            <p className="max-w-sm text-[14px] leading-7 text-ink-2">
              Tap <span className="font-medium text-ink">+ New</span> and talk
              for a minute. Cadence will transcribe, score you on six
              dimensions, and email you a short daily read.
            </p>
          </div>
        ) : null}

        {GROUP_ORDER.map((key) => {
          const items = grouped[key];
          if (items.length === 0) return null;
          return (
            <section key={key} className="flex flex-col gap-3">
              <h2 className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">
                {GROUP_LABELS[key]}
              </h2>
              <div className="flex flex-col gap-3">
                {items.map(({ session, analysis, transcript }) => {
                  const focus = analysis
                    ? pickFocusFromAnalysis(analysis.dimensions)
                    : null;
                  const snippet = transcript?.text.slice(0, 130) ?? "";
                  return (
                    <Link
                      key={session.id}
                      href={`/sessions/${session.id}`}
                      className="flex flex-col gap-3 rounded-2xl border border-line bg-card p-4 transition-colors hover:border-line-strong"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          {analysis ? (
                            <ScoreBars dims={analysis.dimensions} />
                          ) : null}
                          <div className="text-sm font-medium text-ink">
                            {key === "today" || key === "yesterday"
                              ? formatTimeShort(session.created_at)
                              : formatDateShort(session.created_at)}
                          </div>
                        </div>
                        <div className="font-mono text-[11px] tabular-nums text-muted">
                          {formatDuration(session.duration_ms)}
                        </div>
                      </div>
                      {focus ? (
                        <div className="text-xs text-ink-2">
                          Focus:{" "}
                          <span className="font-medium text-ink">
                            {focus.name} {focus.score}/5
                          </span>
                        </div>
                      ) : null}
                      {snippet ? (
                        <div className="text-sm italic leading-6 text-muted">
                          &ldquo;{snippet}
                          {(transcript?.text.length ?? 0) > 130 ? "…" : ""}
                          &rdquo;
                        </div>
                      ) : null}
                    </Link>
                  );
                })}
              </div>
            </section>
          );
        })}
      </main>
    </div>
  );
}
