import Link from "next/link";
import { Recorder } from "@/components/Recorder";

export default function NewSessionPage() {
  return (
    <div className="flex flex-1 flex-col bg-zinc-50 dark:bg-black">
      <header className="flex items-center justify-between border-b border-zinc-200 px-6 py-4 dark:border-zinc-900">
        <Link
          href="/"
          className="text-sm font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
        >
          ← Sessions
        </Link>
        <div className="text-xs font-medium uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
          New recording
        </div>
        <div className="w-16" aria-hidden />
      </header>
      <main className="flex w-full flex-1 flex-col items-center justify-center px-6 py-12">
        <Recorder />
      </main>
    </div>
  );
}
