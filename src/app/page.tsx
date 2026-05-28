import { Recorder } from "@/components/Recorder";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-zinc-50 px-6 py-12 dark:bg-black">
      <header className="mb-12 flex flex-col items-center gap-2">
        <div className="text-xs font-medium uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
          Cadence
        </div>
        <div className="text-sm text-zinc-600 dark:text-zinc-400">
          Tap to start. Tap to stop.
        </div>
      </header>
      <main className="flex w-full max-w-md flex-1 flex-col items-center justify-center">
        <Recorder />
      </main>
      <footer className="mt-12 text-xs text-zinc-400 dark:text-zinc-600">
        M1 · local recording only
      </footer>
    </div>
  );
}
