import { Platform } from 'react-native';
import * as Location from 'expo-location';

export type Coords = { latitude: number; longitude: number };

/**
 * 현재 위치 좌표 가져오기 — Web/Native 양쪽 지원.
 * Web 은 navigator.geolocation, Native 는 expo-location 사용.
 * 권한 거부 / 미지원 / 타임아웃 시 throw.
 */
export async function getCurrentCoords(timeoutMs = 8000): Promise<Coords> {
  if (Platform.OS === 'web') {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      throw new Error('이 브라우저는 위치 정보를 지원하지 않습니다');
    }
    return new Promise<Coords>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('위치 가져오기 타임아웃')), timeoutMs);
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          clearTimeout(timer);
          resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
        },
        (err) => {
          clearTimeout(timer);
          reject(new Error(err.message));
        },
        { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 30_000 },
      );
    });
  }

  // Native
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') {
    throw new Error('위치 권한이 필요합니다');
  }
  const pos = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.High,
  });
  return { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
}

/** Haversine 거리 (km) — 두 좌표 사이 거리 계산 */
export function distanceKm(a: Coords, b: Coords): number {
  const R = 6371; // 지구 반지름 km
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

