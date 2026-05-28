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
      <div className="flex w-full flex-col items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-6 py-5 text-sm text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/40 dark:text-emerald-200">
        <div className="font-medium">Check your inbox</div>
        <div className="text-center text-xs leading-5 text-emerald-800 dark:text-emerald-300">
          We sent a sign-in link to <span className="font-medium">{email}</span>.
          Tap it to come back here.
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
        className="rounded-full border border-zinc-300 bg-white px-5 py-3 text-base text-zinc-950 outline-none transition-colors focus:border-slate-900 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50 dark:focus:border-slate-100"
      />
      <button
        type="submit"
        disabled={status === "sending" || !email}
        className="rounded-full bg-slate-900 px-5 py-3 text-base font-medium text-slate-50 transition-colors hover:bg-slate-800 disabled:opacity-40 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
      >
        {status === "sending" ? "Sending…" : "Email me a sign-in link"}
      </button>
      {errorMessage ? (
        <div className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
          {errorMessage}
        </div>
      ) : null}
      <div className="mt-2 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
        No password needed — we email you a link that signs you in for 24 hours.
      </div>
    </form>
  );
}
