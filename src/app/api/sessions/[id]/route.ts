import { NextResponse } from "next/server";
import { getMySession } from "@/lib/db";
import { getSupabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(
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
  try {
    const fullSession = await getMySession(supabase, id);
    if (!fullSession) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ fullSession });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Could not get session";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
