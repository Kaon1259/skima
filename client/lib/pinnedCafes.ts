import { useCallback, useEffect, useState } from 'react';
import { storage } from './storage';

const KEY = 'skima.owner.pinnedCafes';

async function load(): Promise<number[]> {
  const raw = await storage.get(KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((v) => typeof v === 'number') : [];
  } catch {
    return [];
  }
}

async function persist(ids: number[]): Promise<void> {
  await storage.set(KEY, JSON.stringify(ids));
}

export function usePinnedCafes() {
  const [pinned, setPinned] = useState<Set<number>>(new Set());
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;
    load().then((ids) => {
      if (alive) {
        setPinned(new Set(ids));
        setReady(true);
      }
    });
    return () => {
      alive = false;
    };
  }, []);

  const toggle = useCallback(async (cafeId: number) => {
    setPinned((prev) => {
      const next = new Set(prev);
      if (next.has(cafeId)) next.delete(cafeId);
      else next.add(cafeId);
      persist(Array.from(next)).catch(() => {});
      return next;
    });
  }, []);

  return { pinned, toggle, ready };
}
