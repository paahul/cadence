"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { getSupabaseBrowser } from "@/lib/supabase/browser";

export function SignInForm() {
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/";
  // Surface errors thrown by /auth/callback (e.g. expired link, PKCE
  // mismatch from clicking on a different device).
  const callbackError = searchParams.get("error");

  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">(
    "idle",
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(
    callbackError,
  );

  const [code, setCode] = useState("");
  const [verifyStatus, setVerifyStatus] = useState<"idle" | "verifying" | "error">(
    "idle",
  );
  const [verifyError, setVerifyError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("sending");
    setErrorMessage(null);

    const supabase = getSupabaseBrowser();
    const redirectTo =
      typeof window !== "undefined"
        ? `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`
        : undefined;

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: redirectTo,
        shouldCreateUser: true,
      },
    });

    if (error) {
      setStatus("error");
      setErrorMessage(error.message);
      return;
    }

    setStatus("sent");
  }

  async function handleVerify(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const token = code.trim();
    if (!token) return;
    setVerifyStatus("verifying");
    setVerifyError(null);

    const supabase = getSupabaseBrowser();
    const { error } = await supabase.auth.verifyOtp({
      email,
      token,
      type: "email",
    });

    if (error) {
      setVerifyStatus("error");
      setVerifyError(error.message);
      return;
    }

    // Hard navigate so the middleware reads the new auth cookies on the next request.
    if (typeof window !== "undefined") {
      window.location.href = next.startsWith("/") ? next : "/";
    }
  }

  if (status === "sent") {
    return (
      <div className="flex w-full flex-col gap-4">
        <div className="flex w-full flex-col gap-2 rounded-lg border border-accent bg-accent-tint px-5 py-4 text-sm text-accent-strong">
          <div className="font-medium text-ink">Check your inbox</div>
          <div className="text-[13px] leading-5 text-ink-2">
            We sent a sign-in code to{" "}
            <span className="font-medium text-ink">{email}</span>. Paste the
            6-digit code from the email below — or tap the backup link in the
            email if it&rsquo;s easier.
          </div>
        </div>

        <form onSubmit={handleVerify} className="flex w-full flex-col gap-3">
          <label
            htmlFor="cadence-otp-code"
            className="text-xs font-medium uppercase tracking-wider text-muted"
          >
            6-digit code
          </label>
          <input
            id="cadence-otp-code"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="\d{6}"
            maxLength={6}
            placeholder="123456"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            disabled={verifyStatus === "verifying"}
            className="rounded-lg border border-line bg-card px-4 py-3 text-[15px] tracking-[0.3em] text-ink outline-none transition-colors placeholder:text-faint focus:border-accent disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={verifyStatus === "verifying" || code.length < 6}
            className="rounded-lg bg-accent px-4 py-3 text-[15px] font-medium text-card transition-colors hover:bg-accent-strong disabled:opacity-40"
          >
            {verifyStatus === "verifying" ? "Verifying…" : "Sign in with code"}
          </button>
          {verifyError ? (
            <div className="rounded-md border border-record bg-record-tint px-4 py-3 text-sm text-record">
              {verifyError}
            </div>
          ) : null}
          <div className="text-xs leading-5 text-muted">
            Use the code if the email link doesn&rsquo;t work. Corporate email
            scanners sometimes consume single-use links before you get a chance
            to click them.
          </div>
        </form>

        <button
          type="button"
          onClick={() => {
            setStatus("idle");
            setCode("");
            setVerifyStatus("idle");
            setVerifyError(null);
          }}
          className="text-xs text-muted underline-offset-4 hover:underline"
        >
          Use a different email
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex w-full flex-col gap-3">
      <input
        type="email"
        required
        autoComplete="email"
        placeholder="you@example.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        disabled={status === "sending"}
        className="rounded-lg border border-line bg-card px-4 py-3 text-[15px] text-ink outline-none transition-colors placeholder:text-faint focus:border-accent disabled:opacity-50"
      />
      <button
        type="submit"
        disabled={status === "sending" || !email}
        className="rounded-lg bg-accent px-4 py-3 text-[15px] font-medium text-card transition-colors hover:bg-accent-strong disabled:opacity-40"
      >
        {status === "sending" ? "Sending…" : "Email me a sign-in code"}
      </button>
      {errorMessage ? (
        <div className="rounded-md border border-record bg-record-tint px-4 py-3 text-sm text-record">
          {errorMessage}
        </div>
      ) : null}
      <div className="mt-1 text-xs leading-5 text-muted">
        No password needed. We email you a 6-digit code (and a link, as a
        backup).
      </div>
    </form>
  );
}
