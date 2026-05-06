import { useEffect, useMemo, useRef } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';

import { KAKAO_JS_KEY } from '@/lib/config';
import { colors, radius } from '@/lib/theme';

export type ShiftPin = {
  /** 시프트 ID — 마커 클릭 시 onPinClick 인자로 전달 */
  id: number;
  latitude: number;
  longitude: number;
  /** 마커 위 라벨 (시급 또는 매장명 등) */
  label: string;
  /** 라벨 보조 텍스트 (직무·시간 등) */
  subLabel?: string;
  /** 단골 매장 — 황금 마커 */
  isFavorite?: boolean;
  /** 단골 전용 N분 후 공개 — 잠금 마커 */
  favoritesOnlyUntil?: string | null;
};

type Props = {
  pins: ShiftPin[];
  /** 워커 본인 위치 — 있으면 파란 점으로 표시 */
  myCoords?: { latitude: number; longitude: number } | null;
  /** 마커 클릭 콜백 — id 전달 */
  onPinClick?: (id: number) => void;
  height?: number;
};

/**
 * 다중 마커 카카오 지도 — 워커 시프트 검색 지도뷰 전용.
 * - Web: iframe + Maps JS SDK + postMessage 로 마커 클릭 브리지
 * - Native: WebView + ReactNativeWebView.postMessage 브리지
 *
 * 핀 데이터 변경 시 iframe 을 srcDoc 으로 통째로 다시 렌더 (단순함 우선).
 */
export default function KakaoShiftsMap({
  pins,
  myCoords,
  onPinClick,
  height = 480,
}: Props) {
  const html = useMemo(() => buildMapHtml(pins, myCoords ?? null), [pins, myCoords]);
  const webRef = useRef<WebView>(null);

  // Web: window message 수신 (iframe → parent)
  useEffect(() => {
    if (Platform.OS !== 'web' || !onPinClick) return;
    function handler(e: MessageEvent) {
      const d = e.data;
      if (d && d.type === 'kakao-shift-pin' && typeof d.id === 'number') {
        onPinClick!(d.id);
      }
    }
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [onPinClick]);

  if (pins.length === 0) {
    return (
      <View
        style={{
          height,
          borderRadius: radius.md,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.surfaceAlt,
          alignItems: 'center',
          justifyContent: 'center',
          padding: 20,
        }}
      >
        <Text style={{ fontSize: 32, marginBottom: 8 }}>🗺</Text>
        <Text style={{ fontSize: 13, fontWeight: '700', color: colors.textMuted }}>
          표시할 시프트가 없어요
        </Text>
        <Text style={{ fontSize: 11, color: colors.textLight, marginTop: 4, textAlign: 'center' }}>
          필터를 풀거나 좌표가 등록된 매장을 기다려 주세요
        </Text>
      </View>
    );
  }

  if (Platform.OS === 'web') {
    return (
      <View style={{ height, borderRadius: radius.md, overflow: 'hidden', borderWidth: 1, borderColor: colors.border }}>
        {/* @ts-ignore — RN-Web allows iframe */}
        <iframe
          srcDoc={html}
          style={{ width: '100%', height: '100%', border: 'none' }}
          title="kakao-shifts-map"
        />
      </View>
    );
  }

  return (
    <View style={{ height, borderRadius: radius.md, overflow: 'hidden', borderWidth: 1, borderColor: colors.border, backgroundColor: '#E8F1F8' }}>
      <WebView
        ref={webRef}
        originWhitelist={['*']}
        source={{ html, baseUrl: 'http://localhost:8081/' }}
        style={{ width: '100%', height: '100%', backgroundColor: '#E8F1F8' }}
        javaScriptEnabled
        domStorageEnabled
        onMessage={(e) => {
          if (!onPinClick) return;
          try {
            const d = JSON.parse(e.nativeEvent.data);
            if (d && d.type === 'kakao-shift-pin' && typeof d.id === 'number') {
              onPinClick(d.id);
            }
          } catch {
            /* ignore */
          }
        }}
      />
    </View>
  );
}

function buildMapHtml(pins: ShiftPin[], me: { latitude: number; longitude: number } | null): string {
  // 중심: 워커 위치 우선, 없으면 첫 핀
  const center = me ?? { latitude: pins[0].latitude, longitude: pins[0].longitude };
  const pinsJson = JSON.stringify(pins);
  const meJson = JSON.stringify(me);

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
    .pin {
      display:flex;flex-direction:column;align-items:center;cursor:pointer;
      transform:translate(-50%, -100%);
    }
    .pin .bubble {
      background:#FB923C;color:#fff;font-weight:800;font-size:11px;
      padding:5px 9px;border-radius:14px;border:2px solid #fff;
      box-shadow:0 2px 6px rgba(0,0,0,0.25);white-space:nowrap;
      font-family:-apple-system,BlinkMacSystemFont,sans-serif;
    }
    .pin.fav .bubble { background:#F59E0B; }
    .pin.lock .bubble { background:#6B7280; }
    .pin .tip {
      width:0;height:0;border-left:6px solid transparent;border-right:6px solid transparent;
      border-top:8px solid #FB923C;margin-top:-1px;
    }
    .pin.fav .tip { border-top-color:#F59E0B; }
    .pin.lock .tip { border-top-color:#6B7280; }
    .me-dot {
      width:14px;height:14px;border-radius:50%;background:#3B82F6;
      border:3px solid #fff;box-shadow:0 0 0 2px #3B82F6;
      transform:translate(-50%,-50%);
    }
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

      function postPinClick(id) {
        try {
          if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
            window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'kakao-shift-pin', id: id }));
          } else if (window.parent) {
            window.parent.postMessage({ type: 'kakao-shift-pin', id: id }, '*');
          }
        } catch (e) { /* ignore */ }
      }

      var s = document.createElement('script');
      s.src = 'https://dapi.kakao.com/v2/maps/sdk.js?appkey=${KAKAO_JS_KEY}&autoload=false';
      s.onload = function() {
        if (typeof kakao === 'undefined' || !kakao.maps) { showFb(); return; }
        kakao.maps.load(function() {
          loaded = true;
          try {
            var pins = ${pinsJson};
            var me = ${meJson};
            var center = new kakao.maps.LatLng(${center.latitude}, ${center.longitude});
            var map = new kakao.maps.Map(document.getElementById('map'), {
              center: center, level: 6, draggable: true, scrollwheel: true
            });

            var bounds = new kakao.maps.LatLngBounds();

            pins.forEach(function(p) {
              var pos = new kakao.maps.LatLng(p.latitude, p.longitude);
              bounds.extend(pos);
              var nowMs = Date.now();
              var lockedTill = p.favoritesOnlyUntil ? new Date(p.favoritesOnlyUntil).getTime() : 0;
              var locked = lockedTill > nowMs;
              var cls = 'pin';
              if (p.isFavorite) cls += ' fav';
              if (locked) cls += ' lock';
              var prefix = locked ? '🔒 ' : (p.isFavorite ? '⭐ ' : '');
              var content = '<div class="' + cls + '" data-id="' + p.id + '">'
                + '<div class="bubble">' + prefix + escapeHtml(p.label) + '</div>'
                + '<div class="tip"></div>'
                + '</div>';
              var overlay = new kakao.maps.CustomOverlay({
                position: pos, content: content, yAnchor: 1.0, xAnchor: 0.5, zIndex: 3
              });
              overlay.setMap(map);
            });

            // 워커 본인 위치 (있을 때)
            if (me) {
              var meDot = new kakao.maps.CustomOverlay({
                position: new kakao.maps.LatLng(me.latitude, me.longitude),
                content: '<div class="me-dot"></div>',
                yAnchor: 0.5, xAnchor: 0.5, zIndex: 4
              });
              meDot.setMap(map);
            }

            // 모든 마커가 보이게 줌 자동 조정 (단일이면 그대로)
            if (pins.length > 1) {
              if (me) bounds.extend(new kakao.maps.LatLng(me.latitude, me.longitude));
              map.setBounds(bounds, 50, 50, 50, 50);
            }

            // 마커 클릭 — 이벤트 위임 (CustomOverlay 는 직접 listener 안 됨)
            document.getElementById('map').addEventListener('click', function(ev) {
              var t = ev.target;
              while (t && t !== document.body && !t.classList.contains('pin')) t = t.parentNode;
              if (t && t.classList && t.classList.contains('pin')) {
                var id = parseInt(t.getAttribute('data-id'), 10);
                if (!isNaN(id)) postPinClick(id);
              }
            });

          } catch (e) { console.error('[kakao shifts map]', e); showFb(); }
        });
      };
      s.onerror = showFb;
      document.head.appendChild(s);

      function escapeHtml(s) {
        return String(s).replace(/[&<>"']/g, function(c){
          return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
        });
      }
    })();
  </script>
</body>
</html>`;
}
