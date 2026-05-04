import { useEffect } from 'react';
import { Linking, Platform, Pressable, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';

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
  /** 인터랙티브 모드 — 마커 드래그 / 지도 클릭으로 좌표 수정. 매장 편집 폼에서 사용 (web only). */
  interactive?: boolean;
  /** interactive=true 일 때 사용자가 좌표 변경 시 호출 */
  onCoordsChange?: (lat: number, lng: number) => void;
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
  interactive = false,
  onCoordsChange,
}: Props) {
  const externalUrl = buildKakaoMapUrl(latitude, longitude, placeName);

  // 인터랙티브 모드: iframe 내부 SDK 가 postMessage 로 좌표 보냄 — 부모에서 수신
  useEffect(() => {
    if (Platform.OS !== 'web' || !interactive || !onCoordsChange) return;
    function handler(e: MessageEvent) {
      const data = e.data;
      if (data && data.type === 'kakao-map-coords'
          && typeof data.lat === 'number' && typeof data.lng === 'number') {
        onCoordsChange!(data.lat, data.lng);
      }
    }
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [interactive, onCoordsChange]);

  if (Platform.OS === 'web') {
    const iframeHtml = buildIframeHtml(latitude, longitude, showGateRadius, interactive);
    return (
      <Pressable
        onPress={() => { if (!interactive) Linking.openURL(externalUrl); }}
        style={{
          height,
          borderRadius: radius.md,
          overflow: 'hidden',
          borderWidth: 1,
          borderColor: interactive ? colors.primary : colors.border,
        }}
      >
        {/* @ts-ignore — RN-Web allows iframe */}
        <iframe
          srcDoc={iframeHtml}
          style={{ width: '100%', height: '100%', border: 'none', pointerEvents: interactive ? 'auto' : 'none' }}
          title="kakao-map"
        />
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 8,
            right: 8,
            paddingHorizontal: 8,
            paddingVertical: 4,
            borderRadius: radius.pill,
            backgroundColor: interactive ? colors.primary : 'rgba(0,0,0,0.55)',
          }}
        >
          <Text style={{ fontSize: 10, color: '#fff', fontWeight: '700' }}>
            {interactive ? '🖱 드래그·클릭으로 위치 수정' : '🗺 카카오맵 열기 →'}
          </Text>
        </View>
      </Pressable>
    );
  }

  // Native — react-native-webview 로 같은 iframe HTML 렌더링.
  // baseUrl 을 카카오 콘솔 등록 도메인(http://localhost:8081/) 으로 지정해서 SDK 도메인 검증 통과.
  // 인터랙티브 모드는 native 에서는 비활성 (마커 드래그 메시지 브리지는 web 전용).
  const html = buildIframeHtml(latitude, longitude, showGateRadius, false);
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
        },
        pressed && { opacity: 0.92 },
      ]}
    >
      <WebView
        originWhitelist={['*']}
        source={{ html, baseUrl: 'http://localhost:8081/' }}
        style={{ width: '100%', height: '100%', backgroundColor: '#E8F1F8' }}
        scrollEnabled={false}
        javaScriptEnabled
        domStorageEnabled
        // 탭 이벤트는 부모 Pressable 이 처리 — WebView 자체 인터랙션 차단
        pointerEvents="none"
      />
      <View
        pointerEvents="none"
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

function buildKakaoMapUrl(lat: number, lng: number, placeName?: string): string {
  if (placeName && placeName.trim().length > 0) {
    const q = encodeURIComponent(placeName);
    return `https://map.kakao.com/link/search/${q}`;
  }
  return `https://map.kakao.com/link/map/${lat},${lng},${lat},${lng}`;
}

function buildIframeHtml(lat: number, lng: number, showGate: boolean, interactive: boolean): string {
  const gateScript = showGate
    ? `
      var gateCircle = new kakao.maps.Circle({
        center: center, radius: 100,
        strokeWeight: 2, strokeColor: '#FB923C', strokeOpacity: 0.9, strokeStyle: 'dashed',
        fillColor: '#FB923C', fillOpacity: 0.18
      });
      gateCircle.setMap(map);
    `
    : 'var gateCircle = null;';
  const interactiveScript = interactive
    ? `
      // 마커 드래그 → 부모에 좌표 전달 + 100m 게이트 동기 이동
      kakao.maps.event.addListener(marker, 'dragend', function() {
        var pos = marker.getPosition();
        if (gateCircle) gateCircle.setPosition(pos);
        window.parent.postMessage({ type: 'kakao-map-coords', lat: pos.getLat(), lng: pos.getLng() }, '*');
      });
      // 지도 클릭 시 마커 + 게이트 이동
      kakao.maps.event.addListener(map, 'click', function(mouseEvent) {
        var latlng = mouseEvent.latLng;
        marker.setPosition(latlng);
        if (gateCircle) gateCircle.setPosition(latlng);
        window.parent.postMessage({ type: 'kakao-map-coords', lat: latlng.getLat(), lng: latlng.getLng() }, '*');
      });
    `
    : '';
  const mapDraggable = interactive ? 'true' : 'false';
  const mapScrollwheel = interactive ? 'true' : 'false';
  const markerDraggable = interactive ? 'true' : 'false';
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
              center: center, level: ${level},
              draggable: ${mapDraggable}, scrollwheel: ${mapScrollwheel}, disableDoubleClick: true
            });
            var marker = new kakao.maps.Marker({ position: center, draggable: ${markerDraggable} });
            marker.setMap(map);
            ${gateScript}
            ${interactiveScript}
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
