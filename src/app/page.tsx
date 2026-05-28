export default function Home() {
  return (
    <div className="flex flex-1 items-center justify-center bg-zinc-50 px-6 dark:bg-black">
      <main className="flex w-full max-w-md flex-col items-center gap-6 text-center">
        <div className="text-xs font-medium uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
          Cadence
        </div>
        <h1 className="text-3xl font-semibold leading-tight tracking-tight text-zinc-950 dark:text-zinc-50">
          Tap to start. Tap to stop.
        </h1>
        <p className="text-base leading-7 text-zinc-600 dark:text-zinc-400">
          A speaking coach that&apos;s honest about what it can and can&apos;t measure.
        </p>
        <div className="mt-2 text-sm text-zinc-500 dark:text-zinc-500">
          M1 in progress.
        </div>
      </main>
    </div>
  );
}
