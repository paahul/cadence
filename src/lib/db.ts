import type { SupabaseClient } from "@supabase/supabase-js";
import type { AnalysisResult } from "./rubric/schema";
import { getSupabaseAdmin } from "./supabase/admin";

export type AnalysisStatus =
  | "pending"
  | "processing"
  | "completed"
  | "failed";

export type SessionRow = {
  id: string;
  user_id: string;
  created_at: string;
  duration_ms: number | null;
  storage_path: string;
  mime_type: string;
  analysis_status: AnalysisStatus;
  analysis_error: string | null;
  analysis_started_at: string | null;
  analysis_completed_at: string | null;
};

export type TranscriptRow = {
  id: string;
  session_id: string;
  user_id: string;
  text: string;
  created_at: string;
};

export type AnalysisRow = {
  id: string;
  session_id: string;
  user_id: string;
  dimensions: AnalysisResult["dimensions"];
  model: string;
  created_at: string;
};

export type ProfileRow = {
  id: string;
  digest_recipient: string;
  display_name: string | null;
  created_at: string;
  updated_at: string;
};

export type FullSession = {
  session: SessionRow;
  transcript: TranscriptRow | null;
  analysis: AnalysisRow | null;
};

const FULL_SELECT = `
  *,
  transcripts:transcripts(*),
  analyses:analyses(*)
`;

function shapeFullSession(row: unknown): FullSession {
  const r = row as SessionRow & {
    transcripts: TranscriptRow[] | null;
    analyses: AnalysisRow[] | null;
  };
  return {
    session: {
      id: r.id,
      user_id: r.user_id,
      created_at: r.created_at,
      duration_ms: r.duration_ms,
      storage_path: r.storage_path,
      mime_type: r.mime_type,
      analysis_status: r.analysis_status ?? "completed",
      analysis_error: r.analysis_error ?? null,
      analysis_started_at: r.analysis_started_at ?? null,
      analysis_completed_at: r.analysis_completed_at ?? null,
    },
    transcript: r.transcripts?.[0] ?? null,
    analysis: r.analyses?.[0] ?? null,
  };
}

// =========================================================================
// User-scoped reads. Caller passes the server Supabase client; RLS
// auto-filters to the authenticated user.
// =========================================================================

export async function listMySessions(
  supabase: SupabaseClient,
  limit = 50,
): Promise<FullSession[]> {
  const { data, error } = await supabase
    .from("sessions")
    .select(FULL_SELECT)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(`Failed to list sessions: ${error.message}`);
  return (data ?? []).map(shapeFullSession);
}

export async function getMySession(
  supabase: SupabaseClient,
  id: string,
): Promise<FullSession | null> {
  const { data, error } = await supabase
    .from("sessions")
    .select(FULL_SELECT)
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(`Failed to get session: ${error.message}`);
  if (!data) return null;
  return shapeFullSession(data);
}

// =========================================================================
// Synchronous fallback path — preserved for when Inngest isn't configured.
// Creates session + transcript + analysis in one go, status defaults to
// 'completed'.
// =========================================================================

export async function insertSessionWithResults(args: {
  userId: string;
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
      user_id: args.userId,
      storage_path: args.storagePath,
      mime_type: args.mimeType,
      duration_ms: args.durationMs,
      analysis_status: "completed",
      analysis_completed_at: new Date().toISOString(),
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
    user_id: args.userId,
    text: args.transcript,
  });
  if (transcriptErr) {
    throw new Error(`Failed to insert transcript: ${transcriptErr.message}`);
  }

  const { error: analysisErr } = await admin.from("analyses").insert({
    session_id: session.id,
    user_id: args.userId,
    dimensions: args.dimensions,
    model: args.model,
  });
  if (analysisErr) {
    throw new Error(`Failed to insert analysis: ${analysisErr.message}`);
  }

  return session;
}

// =========================================================================
// Two-phase async path — used when Inngest is configured.
// =========================================================================

/**
 * Phase 1: insert a session row with status='pending'.
 * The Inngest worker picks it up via the emitted event.
 */
export async function createPendingSession(args: {
  userId: string;
  storagePath: string;
  mimeType: string;
  durationMs: number | null;
}): Promise<SessionRow> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("sessions")
    .insert({
      user_id: args.userId,
      storage_path: args.storagePath,
      mime_type: args.mimeType,
      duration_ms: args.durationMs,
      analysis_status: "pending",
    })
    .select("*")
    .single<SessionRow>();
  if (error || !data) {
    throw new Error(
      `Failed to create pending session: ${error?.message ?? "unknown"}`,
    );
  }
  return data;
}

/** Load a session by id with service-role access (no RLS). For the worker. */
export async function getSessionForWorker(
  sessionId: string,
): Promise<SessionRow | null> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("sessions")
    .select("*")
    .eq("id", sessionId)
    .maybeSingle<SessionRow>();
  if (error) throw new Error(`Failed to load session: ${error.message}`);
  return data;
}

export async function markSessionProcessing(sessionId: string): Promise<void> {
  const admin = getSupabaseAdmin();
  const { error } = await admin
    .from("sessions")
    .update({
      analysis_status: "processing",
      analysis_started_at: new Date().toISOString(),
      analysis_error: null,
    })
    .eq("id", sessionId);
  if (error) throw new Error(`Failed to mark processing: ${error.message}`);
}

export async function markSessionFailed(
  sessionId: string,
  errorMessage: string,
): Promise<void> {
  const admin = getSupabaseAdmin();
  const { error } = await admin
    .from("sessions")
    .update({
      analysis_status: "failed",
      analysis_error: errorMessage,
      analysis_completed_at: new Date().toISOString(),
    })
    .eq("id", sessionId);
  if (error) {
    // Best-effort — don't throw, we're already in a failure path
    console.error(`Failed to mark session failed: ${error.message}`);
  }
}

export async function markSessionPendingForRetry(
  sessionId: string,
): Promise<void> {
  const admin = getSupabaseAdmin();
  // Clear any existing transcript/analysis rows so the worker can re-insert
  await admin.from("transcripts").delete().eq("session_id", sessionId);
  await admin.from("analyses").delete().eq("session_id", sessionId);

  const { error } = await admin
    .from("sessions")
    .update({
      analysis_status: "pending",
      analysis_error: null,
      analysis_started_at: null,
      analysis_completed_at: null,
    })
    .eq("id", sessionId);
  if (error) {
    throw new Error(`Failed to reset session for retry: ${error.message}`);
  }
}

/**
 * Phase 2 completion: insert transcript + analysis, flip status to completed.
 */
export async function completeSessionAnalysis(args: {
  sessionId: string;
  userId: string;
  transcript: string;
  dimensions: AnalysisResult["dimensions"];
  model: string;
}): Promise<void> {
  const admin = getSupabaseAdmin();

  const { error: transcriptErr } = await admin.from("transcripts").insert({
    session_id: args.sessionId,
    user_id: args.userId,
    text: args.transcript,
  });
  if (transcriptErr) {
    throw new Error(`Failed to insert transcript: ${transcriptErr.message}`);
  }

  const { error: analysisErr } = await admin.from("analyses").insert({
    session_id: args.sessionId,
    user_id: args.userId,
    dimensions: args.dimensions,
    model: args.model,
  });
  if (analysisErr) {
    throw new Error(`Failed to insert analysis: ${analysisErr.message}`);
  }

  const { error: sessionErr } = await admin
    .from("sessions")
    .update({
      analysis_status: "completed",
      analysis_completed_at: new Date().toISOString(),
      analysis_error: null,
    })
    .eq("id", args.sessionId);
  if (sessionErr) {
    throw new Error(
      `Failed to mark session completed: ${sessionErr.message}`,
    );
  }
}

// =========================================================================
// Cron-side reads — admin client, iterates over users.
// =========================================================================

export async function listAllProfiles(): Promise<ProfileRow[]> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin.from("profiles").select("*");
  if (error) throw new Error(`Failed to list profiles: ${error.message}`);
  return (data ?? []) as ProfileRow[];
}

export async function getSessionsBetweenForUser(
  userId: string,
  startIso: string,
  endIso: string,
): Promise<FullSession[]> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("sessions")
    .select(FULL_SELECT)
    .eq("user_id", userId)
    .eq("analysis_status", "completed")
    .gte("created_at", startIso)
    .lt("created_at", endIso)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(
      `Failed to get sessions in range for user: ${error.message}`,
    );
  }
  return (data ?? []).map(shapeFullSession);
}
