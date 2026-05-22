import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import JoinForm from "./JoinForm";
import JoinStatus from "./JoinStatus";
import { card, cardPad } from "@/components/ui";

interface PageProps {
  params: Promise<{ token: string }>;
}

export default async function JoinPage({ params }: PageProps) {
  const { token } = await params;
  const supabase = await createClient();

  const { data: invite, error } = await supabase
    .rpc("lookup_invite", { token_input: token })
    .single();

  if (error || !invite) {
    return (
      <Shell>
        <JoinStatus kind="invalid" />
      </Shell>
    );
  }

  const inviteRow = invite as {
    id: string;
    restaurant_id: string;
    restaurant_name: string;
    role: string;
    used_at: string | null;
    revoked_at: string | null;
  };

  if (inviteRow.used_at) {
    return (
      <Shell>
        <JoinStatus kind="used" />
      </Shell>
    );
  }

  if (inviteRow.revoked_at) {
    return (
      <Shell>
        <JoinStatus kind="revoked" />
      </Shell>
    );
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // If already logged in → accept invite directly via RPC and redirect.
  if (user) {
    const { error: acceptErr } = await supabase.rpc("accept_invite", {
      token_input: token,
    });
    if (acceptErr) {
      return (
        <Shell>
          <JoinStatus kind="failed" detail={acceptErr.message} />
        </Shell>
      );
    }
    redirect("/dashboard");
  }

  return (
    <Shell>
      <JoinForm
        token={token}
        restaurantName={inviteRow.restaurant_name}
        role={inviteRow.role}
      />
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-5 py-12">
      <Link
        href="/"
        className="mb-8 inline-flex items-center gap-2 self-center text-base font-semibold tracking-tight text-ink"
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-ink text-xs font-bold text-surface">
          Q
        </span>
        QR Menu
      </Link>
      <div className={`${card} ${cardPad}`}>{children}</div>
    </main>
  );
}
