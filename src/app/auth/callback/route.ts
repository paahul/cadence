import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function buildSignInRedirect(originUrl: URL, errorMessage?: string): URL {
  const dest = new URL("/sign-in", originUrl.origin);
  if (errorMessage) dest.searchParams.set("error", errorMessage);
  return dest;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") ?? "/";

  if (!code) {
    return NextResponse.redirect(buildSignInRedirect(url, "missing_code"));
  }

  const supabase = await getSupabaseServer();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(buildSignInRedirect(url, error.message));
  }

  const dest = new URL(next.startsWith("/") ? next : "/", url.origin);
  return NextResponse.redirect(dest);
}
