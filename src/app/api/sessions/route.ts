import { NextResponse } from "next/server";
import { listMySessions } from "@/lib/db";
import { getSupabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await getSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const sessions = await listMySessions(supabase, 50);
    return NextResponse.json({ sessions });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Could not list sessions";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
