import { redirect } from "next/navigation";
import { getSupabaseServer } from "@/lib/supabase/server";

export function SignOutButton() {
  async function signOut() {
    "use server";
    const supabase = await getSupabaseServer();
    await supabase.auth.signOut();
    redirect("/sign-in");
  }

  return (
    <form action={signOut}>
      <button
        type="submit"
        className="text-xs font-medium text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
      >
        Sign out
      </button>
    </form>
  );
}
