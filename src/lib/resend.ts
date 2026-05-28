import { Resend } from "resend";

let cached: Resend | null = null;

export function getResend(): Resend {
  if (cached) return cached;
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("RESEND_API_KEY is not set");
  cached = new Resend(apiKey);
  return cached;
}

// Falls back to Resend's testing address if no env var is set, which only
// delivers to the Resend account owner. Set CADENCE_DIGEST_FROM_ADDRESS to a
// verified-domain address once your domain is set up in Resend.
export const DIGEST_FROM_ADDRESS =
  process.env.CADENCE_DIGEST_FROM_ADDRESS ?? "Cadence <onboarding@resend.dev>";
