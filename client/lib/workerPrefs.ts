import { useCallback, useEffect, useState } from 'react';
import { storage } from './storage';

const KEY = 'skima.worker.preferences';

export type WorkerPrefs = {
  /** 시프트 시급 최소값 (원). 0 = 제한 없음 */
  minWage: number;
  /** 매장 평균 별점 최소값 (★). null = 제한 없음 */
  minCafeRating: number | null;
  /** 매장 노쇼율 최대값 (0~1). null = 제한 없음 */
  maxCafeNoShowRate: number | null;
  /** 거리 최대값 km. null = 제한 없음 */
  maxDistanceKm: number | null;
};

export const DEFAULT_PREFS: WorkerPrefs = {
  minWage: 0,
  minCafeRating: null,
  maxCafeNoShowRate: null,
  maxDistanceKm: null,
};

async function loadRaw(): Promise<WorkerPrefs> {
  const raw = await storage.get(KEY);
  if (!raw) return DEFAULT_PREFS;
  try {
    const v = JSON.parse(raw);
    return {
      minWage: typeof v.minWage === 'number' ? v.minWage : 0,
      minCafeRating: typeof v.minCafeRating === 'number' ? v.minCafeRating : null,
      maxCafeNoShowRate: typeof v.maxCafeNoShowRate === 'number' ? v.maxCafeNoShowRate : null,
      maxDistanceKm: typeof v.maxDistanceKm === 'number' ? v.maxDistanceKm : null,
    };
  } catch {
    return DEFAULT_PREFS;
  }
}

async function persist(p: WorkerPrefs): Promise<void> {
  await storage.set(KEY, JSON.stringify(p));
}

/** 워커 선호 조건 hook — 마이 탭에서 편집 / 시프트 화면에서 영구 필터로 적용 */
export function useWorkerPrefs() {
  const [prefs, setPrefs] = useState<WorkerPrefs>(DEFAULT_PREFS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let alive = true;
    loadRaw().then((p) => {
      if (alive) {
        setPrefs(p);
        setLoaded(true);
      }
    });
    return () => { alive = false; };
  }, []);

  const update = useCallback(async (next: Partial<WorkerPrefs>) => {
    setPrefs((prev) => {
      const merged = { ...prev, ...next };
      persist(merged).catch(() => {});
      return merged;
    });
  }, []);

  const reset = useCallback(async () => {
    setPrefs(DEFAULT_PREFS);
    await persist(DEFAULT_PREFS);
  }, []);

  return { prefs, loaded, update, reset };
}

/** 활성 영구 필터 갯수 — 마이 카드 부 라벨 */
export function activePrefsCount(p: WorkerPrefs): number {
  let n = 0;
  if (p.minWage > 0) n++;
  if (p.minCafeRating != null) n++;
  if (p.maxCafeNoShowRate != null) n++;
  if (p.maxDistanceKm != null) n++;
  return n;
}
