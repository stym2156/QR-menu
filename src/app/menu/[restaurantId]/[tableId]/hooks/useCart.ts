"use client";

import { useEffect, useState } from "react";

export interface CartLine {
  menuId: string;
  qty: number;
  note: string;
}

interface UseCartOptions {
  storageKey: string;
  validMenuIds: Set<string>;
}

interface UseCartResult {
  cart: Record<string, CartLine>;
  hydrated: boolean;
  add: (menuId: string, amount?: number) => void;
  remove: (menuId: string) => void;
  setNote: (menuId: string, note: string) => void;
  clear: () => void;
}

export function useCart({ storageKey, validMenuIds }: UseCartOptions): UseCartResult {
  const [cart, setCart] = useState<Record<string, CartLine>>({});
  const [hydrated, setHydrated] = useState(false);

  // Restore cart from localStorage on mount, dropping menus that no longer exist
  // (owner may have deleted them since the customer's last visit).
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw) as Record<string, CartLine>;
        const cleaned: Record<string, CartLine> = {};
        for (const [id, line] of Object.entries(parsed)) {
          if (validMenuIds.has(id) && line.qty > 0) cleaned[id] = line;
        }
        setCart(cleaned);
      }
    } catch {
      // ignore parse / storage errors
    }
    setHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  // Persist cart whenever it changes (skip until after hydration to avoid wiping).
  useEffect(() => {
    if (!hydrated) return;
    try {
      if (Object.keys(cart).length === 0) {
        localStorage.removeItem(storageKey);
      } else {
        localStorage.setItem(storageKey, JSON.stringify(cart));
      }
    } catch {
      // ignore
    }
  }, [cart, hydrated, storageKey]);

  function add(menuId: string, amount: number = 1): void {
    setCart((prev) => {
      const existing = prev[menuId];
      return {
        ...prev,
        [menuId]: {
          menuId,
          qty: (existing?.qty ?? 0) + amount,
          note: existing?.note ?? "",
        },
      };
    });
  }

  function remove(menuId: string): void {
    setCart((prev) => {
      const existing = prev[menuId];
      if (!existing) return prev;
      const nextQty = existing.qty - 1;
      const copy = { ...prev };
      if (nextQty <= 0) delete copy[menuId];
      else copy[menuId] = { ...existing, qty: nextQty };
      return copy;
    });
  }

  function setNote(menuId: string, note: string): void {
    setCart((prev) => {
      const existing = prev[menuId];
      if (!existing) return prev;
      return { ...prev, [menuId]: { ...existing, note } };
    });
  }

  function clear(): void {
    setCart({});
  }

  return { cart, hydrated, add, remove, setNote, clear };
}
