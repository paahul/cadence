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

  const ext = extensionForMime(mimeType);
  const storagePath = `sessions/${crypto.randomUUID()}.${ext}`;

  const { data, error } = await getSupabaseAdmin()
    .storage.from(RECORDINGS_BUCKET)
    .createSignedUploadUrl(storagePath);

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message ?? "Could not create signed upload URL" },
      { status: 500 },
    );
  }

  return NextResponse.json({
    uploadUrl: data.signedUrl,
    storagePath,
  });
}
