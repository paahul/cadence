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
          <p className="mt-2 text-[15px] leading-7 text-ink-2">
            Tap to start when you begin talking — a meeting, a pitch, a
            practice run. Cadence transcribes the audio and scores you on
            four dimensions of communication:
          </p>
          <ul className="mt-1 flex flex-col gap-1 text-[14px] leading-6 text-ink-2">
            <li>· <span className="text-ink">Clarity</span> — could a listener restate your point?</li>
            <li>· <span className="text-ink">Conciseness</span> — did you use the right number of words?</li>
            <li>· <span className="text-ink">Confidence</span> — did your language commit to a position?</li>
            <li>· <span className="text-ink">Word precision</span> — did you reach for the specific word?</li>
          </ul>
          <p className="mt-3 text-[15px] leading-7 text-ink-2">
            Every weekday morning you get a short email with one specific
            thing to focus on — drawn from your own voice, not generic advice.
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
