import { Inngest } from "inngest";
import { runAnalysisPipeline } from "./analysis-pipeline";
import {
  completeSessionAnalysis,
  getSessionForWorker,
  markSessionFailed,
  markSessionProcessing,
} from "./db";

export const inngest = new Inngest({
  id: "cadence",
});

/**
 * Background worker that runs the analysis pipeline for a single session.
 *
 * Triggered by `cadence/analyze.requested` events emitted by /api/analyze
 * when Inngest is configured. Uses step.run() so individual phases are
 * cached on retry — won't re-pay for Whisper/Claude if a later step fails.
 *
 * onFailure handler marks the session as 'failed' so the UI can surface
 * the error and offer a re-run button.
 */
export const analyzeSessionFunction = inngest.createFunction(
  {
    id: "analyze-session",
    triggers: [{ event: "cadence/analyze.requested" }],
    retries: 2,
    onFailure: async ({ event, error }) => {
      const sessionId =
        ((event as unknown) as { data?: { event?: { data?: { sessionId?: string } } } })
          .data?.event?.data?.sessionId ?? null;
      if (!sessionId) return;
      const message =
        error instanceof Error ? error.message : String(error);
      await markSessionFailed(sessionId, message);
    },
  },
  async ({ event, step }) => {
    const { sessionId } = event.data as { sessionId: string };

    await step.run("mark-processing", async () => {
      await markSessionProcessing(sessionId);
    });

    const session = await step.run("load-session", async () => {
      const s = await getSessionForWorker(sessionId);
      if (!s) throw new Error(`Session ${sessionId} not found`);
      return {
        id: s.id,
        user_id: s.user_id,
        storage_path: s.storage_path,
      };
    });

    const result = await step.run("run-pipeline", async () => {
      return await runAnalysisPipeline({
        storagePath: session.storage_path,
      });
    });

    await step.run("save-results", async () => {
      await completeSessionAnalysis({
        sessionId,
        userId: session.user_id,
        transcript: result.transcript,
        dimensions: result.dimensions,
        model: result.model,
      });
    });

    return { sessionId, status: "completed" };
  },
);

/**
 * True when both Inngest env vars are present. /api/analyze uses this to
 * decide between the two-phase async flow and the synchronous fallback.
 */
export function inngestIsConfigured(): boolean {
  return (
    !!process.env.INNGEST_EVENT_KEY && !!process.env.INNGEST_SIGNING_KEY
  );
}
