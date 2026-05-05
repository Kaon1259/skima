import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';

import { getApiBase } from './config';
import { loadAuth } from './storage';

/**
 * 이미지 픽 + S3 multipart 업로드.
 * @param endpoint 백엔드 multipart endpoint (예: '/api/me/profile-image' 또는 '/api/owner/cafes/{id}/image')
 * @returns 업로드된 S3 URL (또는 throw)
 */
export async function pickAndUploadImage(endpoint: string): Promise<string> {
  // 권한
  if (Platform.OS !== 'web') {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (perm.status !== 'granted') {
      throw new Error('사진 라이브러리 접근 권한이 필요합니다');
    }
  }

  // 픽 (정사각 크롭, 0.7 압축)
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.7,
  });

  if (result.canceled || !result.assets?.length) {
    throw new Error('cancelled');
  }
  const asset = result.assets[0];

  // FormData 구성 — Web vs Native
  const formData = new FormData();
  if (Platform.OS === 'web') {
    // Web: blob fetch
    const blob = await fetch(asset.uri).then((r) => r.blob());
    const file = new File([blob], asset.fileName ?? 'upload.jpg', { type: asset.mimeType ?? 'image/jpeg' });
    formData.append('file', file);
  } else {
    // Native: { uri, name, type }
    const filename = asset.fileName ?? `upload.${(asset.mimeType ?? 'image/jpeg').split('/')[1] ?? 'jpg'}`;
    // @ts-ignore — RN FormData accepts this shape
    formData.append('file', { uri: asset.uri, name: filename, type: asset.mimeType ?? 'image/jpeg' });
  }

  // basicHeader 포함 fetch (api wrapper 는 JSON 전제라 직접 fetch 사용)
  const stored = await loadAuth();
  const headers: Record<string, string> = {};
  if (stored?.basicHeader) headers['Authorization'] = stored.basicHeader;
  // Content-Type 은 FormData 가 자동 설정하게 둠

  const res = await fetch(`${getApiBase()}${endpoint}`, {
    method: 'POST',
    headers,
    body: formData,
  });

  if (!res.ok) {
    const text = await res.text();
    let msg = `HTTP ${res.status}`;
    try {
      const j = JSON.parse(text);
      if (j.message) msg = j.message;
    } catch { /* ignore */ }
    throw new Error(msg);
  }

  const data = await res.json();
  return data.imageUrl as string;
}

/** 이미지 삭제 (DELETE endpoint 호출) */
export async function deleteImage(endpoint: string): Promise<void> {
  const stored = await loadAuth();
  const headers: Record<string, string> = {};
  if (stored?.basicHeader) headers['Authorization'] = stored.basicHeader;

  const res = await fetch(`${getApiBase()}${endpoint}`, {
    method: 'DELETE',
    headers,
  });
  if (!res.ok) throw new Error(`삭제 실패 (${res.status})`);
}
