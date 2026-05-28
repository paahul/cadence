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
        className="text-xs font-medium text-muted transition-colors hover:text-ink"
      >
        Sign out
      </button>
    </form>
  );
}
