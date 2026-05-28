import { NextResponse } from "next/server";
import { runAnalysisPipeline } from "@/lib/analysis-pipeline";
import {
  createPendingSession,
  insertSessionWithResults,
} from "@/lib/db";
import { inngest, inngestIsConfigured } from "@/lib/inngest";
import { getSupabaseServer } from "@/lib/supabase/server";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

type AnalyzeRequest = {
  storagePath?: string;
  mimeType?: string;
  durationMs?: number;
};

export async function POST(request: Request) {
  const serverSupabase = await getSupabaseServer();
  const {
    data: { user },
  } = await serverSupabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  let body: AnalyzeRequest;
  try {
    body = (await request.json()) as AnalyzeRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.storagePath) {
    return NextResponse.json({ error: "Missing storagePath" }, { status: 400 });
  }
  const storagePath = body.storagePath;
  const mimeType = body.mimeType ?? "audio/webm";
  const durationMs =
    typeof body.durationMs === "number" ? body.durationMs : null;

  if (!storagePath.startsWith(`users/${user.id}/`)) {
    return NextResponse.json(
      { error: "Storage path does not belong to this user" },
      { status: 403 },
    );
  }

  // =======================================================================
  // Async path — Inngest is configured. Create the session row immediately,
  // emit an event, return. The worker handles Whisper + Claude in the
  // background. Recordings can be any length.
  // =======================================================================
  if (inngestIsConfigured()) {
    try {
      const session = await createPendingSession({
        userId: user.id,
        storagePath,
        mimeType,
        durationMs,
      });

      await inngest.send({
        name: "cadence/analyze.requested",
        data: { sessionId: session.id },
      });

      return NextResponse.json({ sessionId: session.id });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      return NextResponse.json(
        { error: `Could not queue analysis: ${message}` },
        { status: 500 },
      );
    }
  }

  // =======================================================================
  // Synchronous fallback — Inngest not configured. Preserves the original
  // behavior so the product keeps working before/during M7 rollout. Subject
  // to the 60s Vercel function timeout (mitigated client-side by the 2-min
  // recording cap that's still in place when this code path is used).
  // =======================================================================
  try {
    const result = await runAnalysisPipeline({ storagePath });
    const session = await insertSessionWithResults({
      userId: user.id,
      storagePath,
      mimeType,
      durationMs,
      transcript: result.transcript,
      dimensions: result.dimensions,
      model: result.model,
    });
    return NextResponse.json({ sessionId: session.id });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Analysis failed";
    return NextResponse.json(
      { error: `Analysis failed: ${message}` },
      { status: 500 },
    );
  }
}
