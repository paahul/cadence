import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function describeKey(raw: string) {
  if (!raw) return { present: false } as const;
  const trimmed = raw.trim();
  let type: string;
  if (trimmed.startsWith("sb_secret_")) type = "new-secret";
  else if (trimmed.startsWith("sb_publishable_")) type = "PUBLISHABLE-likely-wrong-slot";
  else if (trimmed.startsWith("eyJ")) type = "legacy-jwt";
  else type = "unknown-prefix";
  return {
    present: true,
    length: raw.length,
    trimmedLength: trimmed.length,
    hasLeadingOrTrailingWhitespace: raw !== trimmed,
    hasInternalWhitespace: /\s/.test(trimmed),
    prefix: trimmed.slice(0, 6),
    suffix: trimmed.slice(-4),
    type,
  };
}

function describeUrl(raw: string) {
  if (!raw) return { present: false } as const;
  const trimmed = raw.trim();
  return {
    present: true,
    length: raw.length,
    trimmedLength: trimmed.length,
    hasLeadingOrTrailingWhitespace: raw !== trimmed,
    hasInternalWhitespace: /\s/.test(trimmed),
    startsWithHttps: trimmed.startsWith("https://"),
    endsWithSlash: trimmed.endsWith("/"),
    looksLikeSupabaseUrl: /^https:\/\/[a-z0-9]+\.supabase\.(co|in)\/?$/.test(trimmed),
    previewHead: trimmed.slice(0, 20),
    previewTail: trimmed.slice(-20),
  };
}

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  const openaiKey = process.env.OPENAI_API_KEY ?? "";
  const anthropicKey = process.env.ANTHROPIC_API_KEY ?? "";

  const probeResults: Record<string, unknown> = {};

  if (url && serviceKey) {
    const cleanUrl = url.trim().replace(/\/$/, "");
    const cleanKey = serviceKey.trim();
    try {
      const r = await fetch(`${cleanUrl}/storage/v1/bucket`, {
        headers: {
          apikey: cleanKey,
          authorization: `Bearer ${cleanKey}`,
        },
      });
      const body = await r.text();
      probeResults.storageBucketList = {
        status: r.status,
        bodyPreview: body.slice(0, 400),
      };
    } catch (err) {
      probeResults.storageBucketList = {
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  return NextResponse.json({
    NEXT_PUBLIC_SUPABASE_URL: describeUrl(url),
    SUPABASE_SERVICE_ROLE_KEY: describeKey(serviceKey),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: describeKey(anonKey),
    OPENAI_API_KEY: {
      present: !!openaiKey,
      length: openaiKey.length,
      prefix: openaiKey.slice(0, 6),
    },
    ANTHROPIC_API_KEY: {
      present: !!anthropicKey,
      length: anthropicKey.length,
      prefix: anthropicKey.slice(0, 7),
    },
    probeResults,
  });
}
