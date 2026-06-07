import { useEffect, useState } from "react";
import { hasSupabaseEnv } from "./env";
import { supabase } from "./supabase";
import type { Restaurant, Role } from "./types";

export type Workspace = {
  loading: boolean;
  userId: string | null;
  email: string | null;
  restaurant: Restaurant | null;
  role: Role;
};

const emptyWorkspace: Workspace = {
  loading: false,
  userId: null,
  email: null,
  restaurant: null,
  role: "owner",
};

export function useWorkspace(): Workspace {
  const [state, setState] = useState<Workspace>({
    ...emptyWorkspace,
    loading: true,
  });

  useEffect(() => {
    if (!hasSupabaseEnv()) {
      setState(emptyWorkspace);
      return;
    }

    let cancelled = false;

    async function load(): Promise<void> {
      const client = supabase();
      const { data: sessionData } = await client.auth.getSession();
      const user = sessionData.session?.user ?? null;

      if (!user) {
        if (!cancelled) {
          setState((prev) =>
            prev.userId ? { ...prev, loading: false } : emptyWorkspace,
          );
        }
        return;
      }

      const { data: member, error } = await client
        .from("restaurant_members")
        .select("role, restaurants(*)")
        .eq("user_id", user.id)
        .limit(1)
        .maybeSingle();

      if (cancelled) return;

      if (error) {
        setState((prev) => ({
          ...prev,
          loading: false,
          userId: user.id,
          email: user.email ?? null,
        }));
        return;
      }

      const row = member as {
        role?: Role;
        restaurants?: Restaurant | Restaurant[] | null;
      } | null;
      const restaurant = Array.isArray(row?.restaurants)
        ? row?.restaurants[0] ?? null
        : row?.restaurants ?? null;

      setState({
        loading: false,
        userId: user.id,
        email: user.email ?? null,
        restaurant,
        role: row?.role ?? "owner",
      });
    }

    void load();
    const { data } = supabase().auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        setState(emptyWorkspace);
        return;
      }
      void load();
    });

    return () => {
      cancelled = true;
      data.subscription.unsubscribe();
    };
  }, []);

  return state;
}
