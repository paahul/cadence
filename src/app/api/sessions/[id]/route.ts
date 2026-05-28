import { NextResponse } from "next/server";
import { getSession } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const fullSession = await getSession(id);
    if (!fullSession) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ fullSession });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not get session";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
