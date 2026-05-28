import type { AnalysisResult } from "./rubric/schema";
import { getSupabaseAdmin } from "./supabase";

export type SessionRow = {
  id: string;
  created_at: string;
  duration_ms: number | null;
  storage_path: string;
  mime_type: string;
};

export type TranscriptRow = {
  id: string;
  session_id: string;
  text: string;
  created_at: string;
};

export type AnalysisRow = {
  id: string;
  session_id: string;
  dimensions: AnalysisResult["dimensions"];
  model: string;
  created_at: string;
};

export type FullSession = {
  session: SessionRow;
  transcript: TranscriptRow | null;
  analysis: AnalysisRow | null;
};

export async function insertSessionWithResults(args: {
  storagePath: string;
  mimeType: string;
  durationMs: number | null;
  transcript: string;
  dimensions: AnalysisResult["dimensions"];
  model: string;
}): Promise<SessionRow> {
  const admin = getSupabaseAdmin();

  const { data: session, error: sessionErr } = await admin
    .from("sessions")
    .insert({
      storage_path: args.storagePath,
      mime_type: args.mimeType,
      duration_ms: args.durationMs,
    })
    .select("*")
    .single<SessionRow>();

  if (sessionErr || !session) {
    throw new Error(
      `Failed to insert session: ${sessionErr?.message ?? "unknown"}`,
    );
  }

  const { error: transcriptErr } = await admin.from("transcripts").insert({
    session_id: session.id,
    text: args.transcript,
  });
  if (transcriptErr) {
    throw new Error(
      `Failed to insert transcript: ${transcriptErr.message}`,
    );
  }

  const { error: analysisErr } = await admin.from("analyses").insert({
    session_id: session.id,
    dimensions: args.dimensions,
    model: args.model,
  });
  if (analysisErr) {
    throw new Error(`Failed to insert analysis: ${analysisErr.message}`);
  }

  return session;
}

export async function listSessions(limit = 50): Promise<FullSession[]> {
  const admin = getSupabaseAdmin();

  const { data, error } = await admin
    .from("sessions")
    .select(
      `
      *,
      transcripts:transcripts(*),
      analyses:analyses(*)
    `,
    )
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error || !data) {
    throw new Error(`Failed to list sessions: ${error?.message ?? "unknown"}`);
  }

  return data.map((row) => {
    const r = row as unknown as SessionRow & {
      transcripts: TranscriptRow[] | null;
      analyses: AnalysisRow[] | null;
    };
    return {
      session: {
        id: r.id,
        created_at: r.created_at,
        duration_ms: r.duration_ms,
        storage_path: r.storage_path,
        mime_type: r.mime_type,
      },
      transcript: r.transcripts?.[0] ?? null,
      analysis: r.analyses?.[0] ?? null,
    };
  });
}

export async function getSession(id: string): Promise<FullSession | null> {
  const admin = getSupabaseAdmin();

  const { data, error } = await admin
    .from("sessions")
    .select(
      `
      *,
      transcripts:transcripts(*),
      analyses:analyses(*)
    `,
    )
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to get session: ${error.message}`);
  }
  if (!data) return null;

  const r = data as unknown as SessionRow & {
    transcripts: TranscriptRow[] | null;
    analyses: AnalysisRow[] | null;
  };
  return {
    session: {
      id: r.id,
      created_at: r.created_at,
      duration_ms: r.duration_ms,
      storage_path: r.storage_path,
      mime_type: r.mime_type,
    },
    transcript: r.transcripts?.[0] ?? null,
    analysis: r.analyses?.[0] ?? null,
  };
}
