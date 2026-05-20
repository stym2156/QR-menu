"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createClient } from "@/lib/supabase/client";
import { playChime, unlockAudio } from "@/lib/sound";
import type { CallStaffRequest, Order } from "@/lib/types";

const SOUND_STORAGE_KEY = "shopqr.kitchen.sound";

interface SoundContextValue {
  soundOn: boolean;
  toggle: () => void;
  setOn: (on: boolean) => void;
}

const SoundContext = createContext<SoundContextValue | null>(null);

interface SoundProviderProps {
  restaurantId: string | null;
  children: React.ReactNode;
}

/**
 * Global sound notifications for new orders + call-staff requests.
 *
 * Mounted at the dashboard layout level so notifications keep firing on every
 * page once the user enables sound — they don't have to stay on /kitchen.
 *
 * If restaurantId is null (e.g. a user without a restaurant) the realtime
 * subscription is a no-op.
 */
export function SoundProvider({ restaurantId, children }: SoundProviderProps) {
  const [soundOn, setSoundOn] = useState(false);
  const soundRef = useRef(false);
  const supabase = useMemo(() => createClient(), []);

  // Restore preference from localStorage on mount.
  useEffect(() => {
    try {
      if (localStorage.getItem(SOUND_STORAGE_KEY) === "on") {
        setSoundOn(true);
      }
    } catch {
      // localStorage unavailable; ignore.
    }
  }, []);

  // Persist preference + keep ref in sync.
  // AudioContext needs a user gesture to resume after page reload, so we
  // attach a one-shot listener that resumes on the next interaction.
  useEffect(() => {
    soundRef.current = soundOn;
    try {
      localStorage.setItem(SOUND_STORAGE_KEY, soundOn ? "on" : "off");
    } catch {
      // ignore
    }
    if (!soundOn) return;
    unlockAudio();
    const handler = (): void => unlockAudio();
    document.addEventListener("pointerdown", handler, {
      once: true,
      capture: true,
    });
    return () => {
      document.removeEventListener("pointerdown", handler, true);
    };
  }, [soundOn]);

  // Realtime subscription. Stays mounted as long as the dashboard layout
  // is mounted — so navigating between dashboard pages won't tear it down.
  useEffect(() => {
    if (!restaurantId) return;

    const channel = supabase
      .channel(`global-notify:${restaurantId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "orders",
          filter: `restaurant_id=eq.${restaurantId}`,
        },
        (_payload) => {
          if (soundRef.current) playChime();
        },
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "call_staff_requests",
          filter: `restaurant_id=eq.${restaurantId}`,
        },
        (_payload) => {
          if (soundRef.current) playChime();
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [supabase, restaurantId]);

  const toggle = useCallback(() => setSoundOn((on) => !on), []);
  const setOn = useCallback((on: boolean) => setSoundOn(on), []);

  const value = useMemo<SoundContextValue>(
    () => ({ soundOn, toggle, setOn }),
    [soundOn, toggle, setOn],
  );

  return <SoundContext.Provider value={value}>{children}</SoundContext.Provider>;
}

export function useSound(): SoundContextValue {
  const ctx = useContext(SoundContext);
  if (!ctx) {
    // Fallback if used outside the provider — sound stays off, no-ops.
    return {
      soundOn: false,
      toggle: () => undefined,
      setOn: () => undefined,
    };
  }
  return ctx;
}

// Re-export Order/CallStaffRequest types so callers don't need to import twice.
export type { Order, CallStaffRequest };
