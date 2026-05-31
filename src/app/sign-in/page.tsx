import { Suspense } from "react";
import { SignInForm } from "./SignInForm";

export const dynamic = "force-dynamic";

export default function SignInPage() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-paper px-6 py-16">
      <main className="flex w-full max-w-md flex-col gap-10">
        <div className="flex flex-col gap-3 text-left">
          <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted">
            Cadence
          </div>
          <h1 className="headline text-3xl font-medium leading-[1.15]">
            A speaking coach that<br />
            listens to how you communicate.
          </h1>

          <ol className="mt-4 flex flex-col gap-3.5">
            {[
              {
                label: "Record",
                rest: "a meeting, a pitch, or a practice run.",
              },
              {
                label: "Get scored",
                rest: "across six dimensions of how you communicate.",
              },
              {
                label: "Read your digest",
                rest: "one thing to work on, emailed each weekday morning.",
              },
            ].map((step, i) => (
              <li key={step.label} className="flex items-start gap-3">
                <span className="mt-[1px] flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent-tint text-[11px] font-semibold text-accent">
                  {i + 1}
                </span>
                <span className="text-[14px] leading-6 text-ink-2">
                  <span className="font-medium text-ink">{step.label}:</span>{" "}
                  {step.rest}
                </span>
              </li>
            ))}
          </ol>

          <p className="mt-2 text-[13px] leading-6 text-muted">
            The six: Clarity · Conciseness · Confidence · Word precision ·
            Pace · Pronunciation clarity
          </p>
        </div>

        <Suspense
          fallback={
            <div className="text-sm text-muted">Loading…</div>
          }
        >
          <SignInForm />
        </Suspense>
      </main>
    </div>
  );
}
