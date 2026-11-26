"use client";
// DEMO persistence: the whole demo state lives in this browser's localStorage.
// No server, no accounts, no real patient data.
import { useSyncExternalStore } from "react";
import { initialState, reduce, type Action } from "./state.ts";
import type { DemoState } from "./types.ts";

export const STORAGE_KEY = "genomed-demo-v1";

let current: DemoState | null = null;
const listeners = new Set<() => void>();

function load(): DemoState {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as DemoState;
      if (parsed.version === 1) return parsed;
    }
  } catch {
    /* blocked or corrupt storage: start fresh */
  }
  return initialState();
}

function save(s: DemoState) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    /* storage unavailable: the demo still works until refresh */
  }
}

function subscribe(fn: () => void) {
  listeners.add(fn);
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) { current = load(); fn(); } // another tab changed the demo
  };
  window.addEventListener("storage", onStorage);
  return () => { listeners.delete(fn); window.removeEventListener("storage", onStorage); };
}

const getSnapshot = () => (current ??= load());
const getServerSnapshot = () => null;

export function dispatch(action: Action) {
  current = reduce(getSnapshot(), action, new Date().toISOString());
  save(current);
  listeners.forEach((l) => l());
}

/** Returns null during server rendering / before the browser state is read. */
export function useDemoState(): DemoState | null {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
