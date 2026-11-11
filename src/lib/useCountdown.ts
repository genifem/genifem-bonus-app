import { useCallback, useEffect, useState } from "react";

import { formatTime } from "@/lib/format";

/**
 * Whole seconds until `targetMs`, ticking once a second; null until the first tick. The clock
 * is only read in timers, never during render. For a deadline the API gives (a lockout's end).
 */
export function useSecondsUntil(targetMs: number | null): number | null {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    if (targetMs === null) return;
    const tick = () => setNow(Date.now());
    const first = setTimeout(tick, 0);
    const timer = setInterval(tick, 1000);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [targetMs]);
  if (targetMs === null || now === null) return null;
  return Math.max(0, Math.ceil((targetMs - now) / 1000));
}

/**
 * A countdown from `seconds` to 0, a tick a second, and a way to start it again: the "Resend
 * code (0:30)" wait. Starts on mount.
 */
export function useCountdownFrom(seconds: number): [remaining: number, restart: () => void] {
  const [remaining, setRemaining] = useState(seconds);
  const [round, setRound] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setRemaining((left) => (left > 0 ? left - 1 : 0)), 1000);
    return () => clearInterval(timer);
  }, [round]);

  const restart = useCallback(() => {
    setRemaining(seconds);
    setRound((n) => n + 1);
  }, [seconds]);

  return [remaining, restart];
}

/** "9:48", or "1:02:05" past an hour. */
export function formatCountdown(seconds: number): string {
  return formatTime(seconds);
}
