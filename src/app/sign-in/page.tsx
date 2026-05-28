import { Suspense } from "react";
import { SignInForm } from "./SignInForm";

export const dynamic = "force-dynamic";

export default function SignInPage() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-zinc-50 px-6 py-12 dark:bg-black">
      <main className="flex w-full max-w-sm flex-col items-center gap-8 text-center">
        <div className="flex flex-col items-center gap-2">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
            Cadence
          </div>
          <h1 className="text-2xl font-semibold leading-tight tracking-tight text-zinc-950 dark:text-zinc-50">
            A speaking coach,<br />in your pocket.
          </h1>
          <p className="mt-1 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
            Sign in to start recording.
          </p>
        </div>
        <Suspense fallback={<div className="text-sm text-zinc-500">Loading…</div>}>
          <SignInForm />
        </Suspense>
      </main>
    </div>
  );
}
