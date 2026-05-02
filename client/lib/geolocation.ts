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
