import { serve } from "inngest/next";
import { analyzeSessionFunction, inngest } from "@/lib/inngest";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [analyzeSessionFunction],
});
