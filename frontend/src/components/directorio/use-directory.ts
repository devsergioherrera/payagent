"use client";

import { useEffect, useState } from "react";
import { usePolling } from "@/hooks/use-polling";

export function useDebounced<T>(value: T, ms = 300) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setV(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return v;
}

// Polled fetch that reloads at once when `key` changes and keeps the old data on screen meanwhile.
export function useKeyedPolling<T>(load: () => Promise<T>, key: string) {
  const result = usePolling(load, 3000);
  const { refresh } = result;
  useEffect(() => {
    refresh();
  }, [key, refresh]);
  return result;
}

export const count = (n: number) => new Intl.NumberFormat("es-CO").format(n);
export const PAGE_SIZE = 50;
