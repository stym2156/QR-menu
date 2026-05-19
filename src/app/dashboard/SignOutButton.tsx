"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function SignOutButton() {
  const router = useRouter();
  const supabase = createClient();

  async function handleSignOut(): Promise<void> {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <button
      onClick={handleSignOut}
      className="rounded-lg border border-line bg-surface px-3 py-1.5 text-xs font-medium text-red-600 transition hover:border-red-200 hover:bg-red-50"
    >
      ออกจากระบบ
    </button>
  );
}
