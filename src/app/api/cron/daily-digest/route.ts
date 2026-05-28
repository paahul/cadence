import { NextResponse } from "next/server";
import {
  getSessionsBetweenForUser,
  listAllProfiles,
  type ProfileRow,
} from "@/lib/db";
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

type PerUserResult = {
  userId: string;
  recipient: string;
  sent: boolean;
  reason?: string;
  sessions?: number;
  messageId?: string | null;
  preview?: {
    subject: string;
    text: string;
  };
  error?: string;
};

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

  const url = new URL(request.url);
  const dryRun = url.searchParams.get("dryRun") === "1";
  const useToday = url.searchParams.get("today") === "1";
  const onlyUserId = url.searchParams.get("userId") ?? null;

  const now = new Date();
  const window = pickDigestWindow(now);

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

  let profiles: ProfileRow[];
  try {
    profiles = await listAllProfiles();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: `Could not load profiles: ${message}` },
      { status: 500 },
    );
  }

  const targetProfiles = onlyUserId
    ? profiles.filter((p) => p.id === onlyUserId)
    : profiles;

  const host = request.headers.get("host") ?? "localhost:3000";
  const proto = host.includes("localhost") ? "http" : "https";
  const appBaseUrl = `${proto}://${host}`;
  const label = todayLabel(now);

  const perUser: PerUserResult[] = [];

  for (const profile of targetProfiles) {
    try {
      const sessions = await getSessionsBetweenForUser(
        profile.id,
        window.start.toISOString(),
        window.end.toISOString(),
      );
      const stats = summarizeSessions(sessions);
      if (!stats) {
        perUser.push({
          userId: profile.id,
          recipient: profile.digest_recipient,
          sent: false,
          reason: "no sessions in window",
        });
        continue;
      }

      const synthesis = await generateSynthesis(
        sessions,
        stats,
        window.label,
      );
      const email = buildDigestEmail({
        stats,
        sessions,
        synthesis,
        windowLabel: window.label,
        appBaseUrl,
        todayLabel: label,
      });

      if (dryRun) {
        perUser.push({
          userId: profile.id,
          recipient: profile.digest_recipient,
          sent: false,
          reason: "dryRun=1",
          sessions: sessions.length,
          preview: { subject: email.subject, text: email.text },
        });
        continue;
      }

      const result = await getResend().emails.send({
        from: DIGEST_FROM_ADDRESS,
        to: profile.digest_recipient,
        subject: email.subject,
        html: email.html,
        text: email.text,
      });
      if (result.error) throw new Error(result.error.message);

      perUser.push({
        userId: profile.id,
        recipient: profile.digest_recipient,
        sent: true,
        sessions: sessions.length,
        messageId: result.data?.id ?? null,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      perUser.push({
        userId: profile.id,
        recipient: profile.digest_recipient,
        sent: false,
        error: message,
      });
    }
  }

  const summary = {
    window: {
      start: window.start.toISOString(),
      end: window.end.toISOString(),
      label: window.label,
    },
    totalProfiles: targetProfiles.length,
    sent: perUser.filter((r) => r.sent).length,
    skipped: perUser.filter((r) => !r.sent && !r.error).length,
    failed: perUser.filter((r) => r.error).length,
    perUser,
  };

  return NextResponse.json(summary);
}
