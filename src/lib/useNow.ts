import { useSyncExternalStore } from "react";

/**
 * The time, for "5m ago" labels, read on a shared minute tick rather than during render
 * (rendering must not read the clock). Every screen showing times shares the one timer, and
 * it runs only while something is listening.
 */

const TICK_MS = 30_000;

let current = Date.now();
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | null = null;

function tick() {
  current = Date.now();
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  if (!timer) {
    timer = setInterval(tick, TICK_MS);
    // The value may be stale from the last time nothing was listening.
    tick();
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && timer) {
      clearInterval(timer);
      timer = null;
    }
  };
}

function snapshot(): number {
  return current;
}

export function useNow(): number {
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}
