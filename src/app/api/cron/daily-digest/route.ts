import { NextResponse } from "next/server";
import { getSessionsBetween } from "@/lib/db";
import {
  generateSynthesis,
  pickDigestWindow,
  summarizeSessions,
} from "@/lib/digest";
import { buildDigestEmail } from "@/lib/email-template";
import { DIGEST_FROM_ADDRESS, getResend } from "@/lib/resend";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function unauthorized(message: string) {
  return NextResponse.json({ error: message }, { status: 401 });
}

function todayLabel(now: Date): string {
  return now.toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
    timeZone: "America/New_York",
  });
}

export async function GET(request: Request) {
  const expectedSecret = process.env.CRON_SECRET;
  if (!expectedSecret) {
    return NextResponse.json(
      { error: "CRON_SECRET is not set on the server" },
      { status: 500 },
    );
  }

  const authHeader = request.headers.get("authorization") ?? "";
  const provided = authHeader.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length)
    : "";
  if (provided !== expectedSecret) {
    return unauthorized("Invalid or missing CRON_SECRET");
  }

  const recipient = process.env.CADENCE_DIGEST_RECIPIENT;
  if (!recipient) {
    return NextResponse.json(
      { error: "CADENCE_DIGEST_RECIPIENT is not set" },
      { status: 500 },
    );
  }

  const url = new URL(request.url);
  const dryRun = url.searchParams.get("dryRun") === "1";
  const useToday = url.searchParams.get("today") === "1";

  const now = new Date();
  const window = pickDigestWindow(now);

  // For testing: override the window to "all of today" so a freshly
  // recorded session is visible immediately.
  if (useToday) {
    const startOfToday = new Date(
      Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate(),
        0,
        0,
        0,
        0,
      ),
    );
    const endOfToday = new Date(startOfToday);
    endOfToday.setUTCDate(endOfToday.getUTCDate() + 1);
    window.start = startOfToday;
    window.end = endOfToday;
    window.label = "today (override)";
  }

  let sessions;
  try {
    sessions = await getSessionsBetween(
      window.start.toISOString(),
      window.end.toISOString(),
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: `Could not load sessions: ${message}` },
      { status: 500 },
    );
  }

  const stats = summarizeSessions(sessions);
  if (!stats) {
    return NextResponse.json({
      sent: false,
      reason: `No sessions in window (${window.label}). Skipped per design — don't shame the user.`,
      window: { start: window.start.toISOString(), end: window.end.toISOString() },
    });
  }

  const host = request.headers.get("host") ?? "localhost:3000";
  const proto = host.includes("localhost") ? "http" : "https";
  const appBaseUrl = `${proto}://${host}`;

  const synthesis = await generateSynthesis(sessions, stats, window.label);

  const email = buildDigestEmail({
    stats,
    sessions,
    synthesis,
    windowLabel: window.label,
    appBaseUrl,
    todayLabel: todayLabel(now),
  });

  if (dryRun) {
    return NextResponse.json({
      sent: false,
      reason: "dryRun=1",
      window: { start: window.start.toISOString(), end: window.end.toISOString() },
      preview: {
        to: recipient,
        from: DIGEST_FROM_ADDRESS,
        subject: email.subject,
        text: email.text,
        html: email.html,
      },
    });
  }

  try {
    const result = await getResend().emails.send({
      from: DIGEST_FROM_ADDRESS,
      to: recipient,
      subject: email.subject,
      html: email.html,
      text: email.text,
    });
    if (result.error) {
      throw new Error(result.error.message);
    }
    return NextResponse.json({
      sent: true,
      to: recipient,
      messageId: result.data?.id ?? null,
      window: {
        start: window.start.toISOString(),
        end: window.end.toISOString(),
        label: window.label,
      },
      sessions: sessions.length,
      synthesisUsed: !!synthesis,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: `Resend send failed: ${message}` },
      { status: 502 },
    );
  }
}
