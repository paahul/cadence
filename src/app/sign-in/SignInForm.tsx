"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { getSupabaseBrowser } from "@/lib/supabase/browser";

export function SignInForm() {
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/";

  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">(
    "idle",
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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

  if (status === "sent") {
    return (
      <div className="flex w-full flex-col gap-2 rounded-lg border border-accent bg-accent-tint px-5 py-4 text-sm text-accent-strong">
        <div className="font-medium text-ink">Check your inbox</div>
        <div className="text-[13px] leading-5 text-ink-2">
          We sent a sign-in link to{" "}
          <span className="font-medium text-ink">{email}</span>. Tap it to
          come back here.
        </div>
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
        {status === "sending" ? "Sending…" : "Email me a sign-in link"}
      </button>
      {errorMessage ? (
        <div className="rounded-md border border-record bg-record-tint px-4 py-3 text-sm text-record">
          {errorMessage}
        </div>
      ) : null}
      <div className="mt-1 text-xs leading-5 text-muted">
        No password needed — we email you a link that signs you in.
      </div>
    </form>
  );
}
