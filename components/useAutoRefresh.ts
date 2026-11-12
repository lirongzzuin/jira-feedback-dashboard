'use client';
import { useEffect, useRef, useState } from 'react';

interface Options {
  intervalMs: number;
  enabled: boolean;
  onRefresh: () => void | Promise<void>;
}

interface State {
  secondsUntilNext: number;
  pausedByVisibility: boolean;
}

/**
 * Polls `onRefresh` at a fixed interval. Pauses when the tab is hidden,
 * fires immediately when the tab becomes visible again. Returns a live
 * countdown so the UI can show "다음 갱신 N초 후".
 */
export function useAutoRefresh({ intervalMs, enabled, onRefresh }: Options): State {
  const [secondsUntilNext, setSecondsUntilNext] = useState<number>(Math.floor(intervalMs / 1000));
  const [pausedByVisibility, setPausedByVisibility] = useState<boolean>(false);
  const nextTickAtRef = useRef<number>(Date.now() + intervalMs);
  const callbackRef = useRef(onRefresh);
  callbackRef.current = onRefresh;

  // Main countdown + fire loop (1 Hz tick).
  useEffect(() => {
    if (!enabled) return;
    nextTickAtRef.current = Date.now() + intervalMs;
    setSecondsUntilNext(Math.floor(intervalMs / 1000));
    const id = setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) {
        setPausedByVisibility(true);
        return;
      }
      if (pausedByVisibility) setPausedByVisibility(false);
      const remainingMs = nextTickAtRef.current - Date.now();
      if (remainingMs <= 0) {
        nextTickAtRef.current = Date.now() + intervalMs;
        setSecondsUntilNext(Math.floor(intervalMs / 1000));
        Promise.resolve(callbackRef.current()).catch(() => {/* swallow */});
      } else {
        setSecondsUntilNext(Math.max(1, Math.ceil(remainingMs / 1000)));
      }
    }, 1000);
    return () => clearInterval(id);
  }, [enabled, intervalMs, pausedByVisibility]);

  // When tab becomes visible after being hidden, fire immediately.
  useEffect(() => {
    if (!enabled) return;
    const onVis = () => {
      if (!document.hidden && pausedByVisibility) {
        nextTickAtRef.current = Date.now() + intervalMs;
        setSecondsUntilNext(Math.floor(intervalMs / 1000));
        setPausedByVisibility(false);
        Promise.resolve(callbackRef.current()).catch(() => {/* swallow */});
      }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [enabled, intervalMs, pausedByVisibility]);

  return { secondsUntilNext, pausedByVisibility };
}
