import { NextResponse } from "next/server";
import { listSessions } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const sessions = await listSessions(50);
    return NextResponse.json({ sessions });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not list sessions";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
