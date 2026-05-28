import { NextResponse } from "next/server";
import { RECORDINGS_BUCKET, getSupabaseAdmin } from "@/lib/supabase";

function extensionForMime(mime: string): string {
  if (mime.includes("webm")) return "webm";
  if (mime.includes("mp4")) return "m4a";
  if (mime.includes("ogg")) return "ogg";
  if (mime.includes("wav")) return "wav";
  if (mime.includes("mpeg")) return "mp3";
  return "audio";
}

export async function POST(request: Request) {
  let mimeType: string;
  try {
    const body = (await request.json()) as { mimeType?: string };
    mimeType = body.mimeType ?? "audio/webm";
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 },
    );
  }

  // Diagnostic check: verify env vars are present and bucket is reachable.
  const envPresence = {
    NEXT_PUBLIC_SUPABASE_URL: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
  };

  let admin;
  try {
    admin = getSupabaseAdmin();
  } catch (err) {
    return NextResponse.json(
      {
        error: "Supabase admin init failed",
        detail: err instanceof Error ? err.message : String(err),
        envPresence,
      },
      { status: 500 },
    );
  }

  const ext = extensionForMime(mimeType);
  const storagePath = `sessions/${crypto.randomUUID()}.${ext}`;

  const { data, error } = await admin.storage
    .from(RECORDINGS_BUCKET)
    .createSignedUploadUrl(storagePath);

  if (error || !data) {
    // Pull a list of visible buckets to help diagnose
    const { data: buckets, error: listErr } = await admin.storage.listBuckets();
    return NextResponse.json(
      {
        error: error?.message ?? "Could not create signed upload URL",
        attemptedBucket: RECORDINGS_BUCKET,
        attemptedPath: storagePath,
        rawError: error,
        visibleBuckets: buckets?.map((b) => b.name) ?? null,
        listBucketsError: listErr?.message ?? null,
        envPresence,
      },
      { status: 500 },
    );
  }

  return NextResponse.json({
    uploadUrl: data.signedUrl,
    storagePath,
  });
}
