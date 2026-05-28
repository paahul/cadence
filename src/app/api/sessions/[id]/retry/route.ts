import { NextResponse } from "next/server";
import { getMySession, markSessionPendingForRetry } from "@/lib/db";
import { inngest, inngestIsConfigured } from "@/lib/inngest";
import { getSupabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await getSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { id } = await params;
  // RLS will return null if the session doesn't belong to the caller
  const fullSession = await getMySession(supabase, id).catch(() => null);
  if (!fullSession) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (!inngestIsConfigured()) {
    return NextResponse.json(
      {
        error:
          "Inngest isn't configured on this deploy — retry is only available in the async flow",
      },
      { status: 503 },
    );
  }

  try {
    await markSessionPendingForRetry(id);
    await inngest.send({
      name: "cadence/analyze.requested",
      data: { sessionId: id },
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: `Could not retry analysis: ${message}` },
      { status: 500 },
    );
  }
}
