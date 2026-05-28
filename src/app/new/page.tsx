import Link from "next/link";
import { Recorder } from "@/components/Recorder";

export default function NewSessionPage() {
  return (
    <div className="flex flex-1 flex-col bg-paper">
      <header className="flex items-center justify-between border-b border-line px-6 py-5">
        <Link
          href="/"
          className="text-sm font-medium text-muted transition-colors hover:text-ink"
        >
          ← Sessions
        </Link>
        <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted">
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
