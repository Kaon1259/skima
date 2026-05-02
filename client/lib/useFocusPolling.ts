import { useCallback, useEffect, useRef } from 'react';
import { useFocusEffect } from 'expo-router';

/**
 * 화면이 포커스된 동안 fn 을 즉시 1회 + 주기적으로 호출.
 * unfocus 시 자동 stop. 배터리/네트워크 절약을 위해 백그라운드에서는 동작 안 함.
 */
export function useFocusPolling(fn: () => void | Promise<void>, intervalMs: number) {
  const fnRef = useRef(fn);
  fnRef.current = fn;

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      const tick = () => {
        if (cancelled) return;
        Promise.resolve(fnRef.current()).catch(() => {});
      };
      tick();
      const id = setInterval(tick, intervalMs);
      return () => {
        cancelled = true;
        clearInterval(id);
      };
    }, [intervalMs]),
  );
}
