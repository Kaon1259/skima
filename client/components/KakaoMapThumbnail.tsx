import { Linking, Platform, Pressable, Text, View } from 'react-native';

import { KAKAO_JS_KEY } from '@/lib/config';
import { colors, radius } from '@/lib/theme';

type Props = {
  latitude: number;
  longitude: number;
  /** 지도 클릭/탭 시 카카오맵으로 열 매장명 (검색용 라벨) */
  placeName?: string;
  address?: string | null;
  /** 컴팩트 모드 — 카드용 작은 썸네일 */
  height?: number;
  /** 100m GPS 출근 게이트 원형 표시 (점주 매장 폼에서 사용) */
  showGateRadius?: boolean;
};

/**
 * 카카오 지도 썸네일.
 * - Web: <iframe> 으로 카카오 Maps JS SDK 임베드 (도메인 화이트리스트 필요)
 * - Native: 스타일드 placeholder (지도 모양 카드 + 핀 + 좌표) → 탭 시 카카오맵 URL 열기
 *
 * 양쪽 모두 탭하면 카카오맵 외부 링크가 열려 길찾기·상세 가능.
 */
export default function KakaoMapThumbnail({
  latitude,
  longitude,
  placeName,
  address,
  height = 140,
  showGateRadius = false,
}: Props) {
  const externalUrl = buildKakaoMapUrl(latitude, longitude, placeName);

  if (Platform.OS === 'web') {
    const iframeHtml = buildIframeHtml(latitude, longitude, showGateRadius);
    return (
      <Pressable
        onPress={() => Linking.openURL(externalUrl)}
        style={{
          height,
          borderRadius: radius.md,
          overflow: 'hidden',
          borderWidth: 1,
          borderColor: colors.border,
        }}
      >
        {/* @ts-ignore — RN-Web allows iframe */}
        <iframe
          srcDoc={iframeHtml}
          style={{ width: '100%', height: '100%', border: 'none', pointerEvents: 'none' }}
          title="kakao-map"
        />
        <View
          style={{
            position: 'absolute',
            top: 8,
            right: 8,
            paddingHorizontal: 8,
            paddingVertical: 4,
            borderRadius: radius.pill,
            backgroundColor: 'rgba(0,0,0,0.55)',
          }}
        >
          <Text style={{ fontSize: 10, color: '#fff', fontWeight: '700' }}>
            🗺 카카오맵 열기 →
          </Text>
        </View>
      </Pressable>
    );
  }

  // Native — placeholder card with pin (탭 시 카카오맵 외부 링크)
  return (
    <Pressable
      onPress={() => Linking.openURL(externalUrl)}
      style={({ pressed }) => [
        {
          height,
          borderRadius: radius.md,
          overflow: 'hidden',
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: '#E8F1F8',
          alignItems: 'center',
          justifyContent: 'center',
        },
        pressed && { opacity: 0.85 },
      ]}
    >
      {/* 가로/세로 그리드 라인 — 지도 느낌 */}
      <View pointerEvents="none" style={{ position: 'absolute', inset: 0, opacity: 0.4 }}>
        {[1, 2, 3].map((i) => (
          <View
            key={`h${i}`}
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: `${(i * 100) / 4}%`,
              height: 1,
              backgroundColor: '#9CB3C7',
            }}
          />
        ))}
        {[1, 2, 3].map((i) => (
          <View
            key={`v${i}`}
            style={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              left: `${(i * 100) / 4}%`,
              width: 1,
              backgroundColor: '#9CB3C7',
            }}
          />
        ))}
      </View>
      {/* 100m 게이트 원형 시각화 (native placeholder) */}
      {showGateRadius ? (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            width: Math.min(height * 0.7, 110),
            height: Math.min(height * 0.7, 110),
            borderRadius: 9999,
            borderWidth: 2,
            borderColor: '#FB923C',
            borderStyle: 'dashed',
            backgroundColor: 'rgba(251,146,60,0.18)',
          }}
        />
      ) : null}
      {/* 핀 + 라벨 */}
      <Text style={{ fontSize: 36, marginBottom: 4 }}>📍</Text>
      <Text style={{ fontSize: 12, fontWeight: '800', color: '#1F4E79' }} numberOfLines={1}>
        {placeName ?? '매장 위치'}
      </Text>
      {address ? (
        <Text style={{ fontSize: 10, color: '#3A6FA0', marginTop: 2 }} numberOfLines={1}>
          {address}
        </Text>
      ) : null}
      {showGateRadius ? (
        <View
          style={{
            marginTop: 6,
            paddingHorizontal: 8,
            paddingVertical: 3,
            borderRadius: radius.pill,
            backgroundColor: 'rgba(251,146,60,0.85)',
          }}
        >
          <Text style={{ fontSize: 10, color: '#fff', fontWeight: '800' }}>
            🎯 100m GPS 출근 게이트
          </Text>
        </View>
      ) : null}
      <View
        style={{
          marginTop: 8,
          paddingHorizontal: 10,
          paddingVertical: 4,
          borderRadius: radius.pill,
          backgroundColor: 'rgba(31, 78, 121, 0.85)',
        }}
      >
        <Text style={{ fontSize: 10, color: '#fff', fontWeight: '700' }}>
          🗺 카카오맵 열기 →
        </Text>
      </View>
    </Pressable>
  );
}

function buildKakaoMapUrl(lat: number, lng: number, placeName?: string): string {
  if (placeName && placeName.trim().length > 0) {
    const q = encodeURIComponent(placeName);
    return `https://map.kakao.com/link/search/${q}`;
  }
  return `https://map.kakao.com/link/map/${lat},${lng},${lat},${lng}`;
}

function buildIframeHtml(lat: number, lng: number, showGate: boolean): string {
  const gateScript = showGate
    ? `
      new kakao.maps.Circle({
        center: center, radius: 100,
        strokeWeight: 2, strokeColor: '#FB923C', strokeOpacity: 0.9, strokeStyle: 'dashed',
        fillColor: '#FB923C', fillOpacity: 0.18
      }).setMap(map);
    `
    : '';
  const level = 4;
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
  <base href="https://localhost/">
  <style>
    html,body,#map{margin:0;padding:0;width:100%;height:100%;}
    #fb{display:none;position:absolute;inset:0;background:#FFF7ED;color:#9A3412;
      align-items:center;justify-content:center;flex-direction:column;font-family:sans-serif;
      padding:12px;text-align:center;font-size:11px;}
    #fb.show{display:flex;}
  </style>
</head>
<body>
  <div id="map"></div>
  <div id="fb">
    <div style="font-size:24px;margin-bottom:4px;">🗺</div>
    <div style="font-weight:700;">지도 로드 실패</div>
    <div style="opacity:0.8;margin-top:4px;">카카오 콘솔 도메인 등록 필요</div>
  </div>
  <script>
    (function() {
      var loaded = false;
      function showFb() { var fb = document.getElementById('fb'); if (fb) fb.className = 'show'; }
      setTimeout(function(){ if(!loaded) showFb(); }, 5000);
      var s = document.createElement('script');
      s.src = 'https://dapi.kakao.com/v2/maps/sdk.js?appkey=${KAKAO_JS_KEY}&autoload=false';
      s.onload = function() {
        if (typeof kakao === 'undefined' || !kakao.maps) { showFb(); return; }
        kakao.maps.load(function() {
          loaded = true;
          try {
            var center = new kakao.maps.LatLng(${lat}, ${lng});
            var map = new kakao.maps.Map(document.getElementById('map'), {
              center: center, level: ${level}, draggable: false, scrollwheel: false, disableDoubleClick: true
            });
            new kakao.maps.Marker({ position: center }).setMap(map);
            ${gateScript}
          } catch (e) { console.error('[kakao map]', e); showFb(); }
        });
      };
      s.onerror = showFb;
      document.head.appendChild(s);
    })();
  </script>
</body>
</html>`;
}
