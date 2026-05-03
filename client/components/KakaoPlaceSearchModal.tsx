import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Modal, Platform, Pressable, Text, TextInput, View } from 'react-native';

import { Icon } from '@/components/Icon';
import { api } from '@/lib/api';
import { KAKAO_JS_KEY } from '@/lib/config';
import { getCurrentCoords } from '@/lib/geolocation';
import { colors, radius, spacing, styles } from '@/lib/theme';

export type KakaoPlace = {
  placeName: string;
  addressName: string | null;
  roadAddressName: string | null;
  phone: string | null;
  latitude: number | null;
  longitude: number | null;
  categoryName: string | null;
  placeUrl: string | null;
  distanceMeters: number | null;
};

type Props = {
  visible: boolean;
  onClose: () => void;
  onSelect: (p: KakaoPlace) => void;
  /** 초기 검색어 — 매장명 input 값을 미리 넣어 한 번에 검색 가능 */
  initialQuery?: string;
};

/**
 * 카카오 Local API 키워드 검색 모달.
 * 점주 매장 등록·수정 시 매장명 검색 → 자동완성 (이름·주소·좌표·전화번호).
 */
export default function KakaoPlaceSearchModal({ visible, onClose, onSelect, initialQuery }: Props) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<KakaoPlace[]>([]);
  const [busy, setBusy] = useState(false);
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 검색 결과들의 위치를 카카오맵에 마커로 표시 (web only)
  const mapHtml = useMemo(() => buildMapHtml(results, coords), [results, coords]);
  const mapKey = useMemo(
    () => results.map((r) => `${r.latitude},${r.longitude}`).join('|') + ':' + (coords ? `${coords.latitude},${coords.longitude}` : ''),
    [results, coords],
  );

  // 모달 열릴 때 초기 검색어 + GPS (best-effort)
  useEffect(() => {
    if (!visible) return;
    setQ(initialQuery ?? '');
    setResults([]);
    setError(null);
    getCurrentCoords()
      .then((c) => setCoords(c))
      .catch(() => { /* silent — 거리 정렬만 비활성 */ });
  }, [visible, initialQuery]);

  // q 변경 시 디바운스 검색 (300ms)
  useEffect(() => {
    if (!visible) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const trimmed = q.trim();
    if (trimmed.length < 2) {
      setResults([]);
      return;
    }
    debounceRef.current = setTimeout(() => {
      doSearch(trimmed);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [q, visible, coords?.latitude, coords?.longitude]);

  async function doSearch(query: string) {
    setBusy(true);
    setError(null);
    try {
      const params = new URLSearchParams({ q: query, size: '15' });
      if (coords) {
        params.set('lat', String(coords.latitude));
        params.set('lng', String(coords.longitude));
      }
      const data = await api<KakaoPlace[]>(`/api/kakao/places?${params.toString()}`);
      setResults(data);
    } catch (e) {
      setError((e as Error).message ?? '검색 실패');
      setResults([]);
    } finally {
      setBusy(false);
    }
  }

  function handleSelect(p: KakaoPlace) {
    onSelect(p);
    onClose();
  }

  function buildMapHtml(places: KakaoPlace[], myCoords: { latitude: number; longitude: number } | null): string {
    const validPlaces = places.filter((p) => p.latitude != null && p.longitude != null);
    // 기본 중심: 내 GPS → 첫 결과 → 서울시청 (37.5665, 126.978)
    const centerLat = myCoords?.latitude ?? validPlaces[0]?.latitude ?? 37.5665;
    const centerLng = myCoords?.longitude ?? validPlaces[0]?.longitude ?? 126.978;
    const initialLevel = validPlaces.length === 0 ? (myCoords ? 4 : 7) : 5;
    const markersJs = validPlaces
      .map((p, i) => {
        const safeName = (p.placeName ?? '').replace(/'/g, "\\'");
        return `(function(){
          var pos = new kakao.maps.LatLng(${p.latitude}, ${p.longitude});
          var mk = new kakao.maps.Marker({ position: pos, map: map, title: '${safeName}' });
          var iw = new kakao.maps.InfoWindow({ content: '<div style="padding:5px 8px;font-size:11px;font-weight:700;">${i + 1}. ${safeName}</div>' });
          kakao.maps.event.addListener(mk, 'click', function() { iw.open(map, mk); });
        })();`;
      })
      .join('\n');
    const myCoordsJs = myCoords
      ? `var myMk = new kakao.maps.Marker({
          position: new kakao.maps.LatLng(${myCoords.latitude}, ${myCoords.longitude}),
          map: map,
          image: new kakao.maps.MarkerImage(
            'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"><circle cx="10" cy="10" r="6" fill="%232563EB" stroke="white" stroke-width="2"/></svg>',
            new kakao.maps.Size(20, 20)
          ),
          title: '내 위치'
        });`
      : '';
    const fitBoundsJs =
      validPlaces.length > 1
        ? `
      var bounds = new kakao.maps.LatLngBounds();
      ${validPlaces.map((p) => `bounds.extend(new kakao.maps.LatLng(${p.latitude}, ${p.longitude}));`).join('\n')}
      ${myCoords ? `bounds.extend(new kakao.maps.LatLng(${myCoords.latitude}, ${myCoords.longitude}));` : ''}
      map.setBounds(bounds);`
        : '';
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <base href="https://localhost/">
  <style>
    html,body,#map{margin:0;padding:0;width:100%;height:100%;}
    #fallback{display:none;position:absolute;inset:0;background:#FFF7ED;color:#9A3412;
      align-items:center;justify-content:center;flex-direction:column;font-family:sans-serif;
      padding:16px;text-align:center;font-size:12px;}
    #fallback.show{display:flex;}
  </style>
</head>
<body>
  <div id="map"></div>
  <div id="fallback">
    <div style="font-size:32px;margin-bottom:8px;">🗺</div>
    <div style="font-weight:700;margin-bottom:6px;">카카오맵을 불러올 수 없습니다</div>
    <div style="opacity:0.85;line-height:1.5;">
      카카오 디벨로퍼스 콘솔에서<br/>
      <b>플랫폼 → Web → 사이트 도메인</b>에<br/>
      <code>http://localhost:8081</code> 등록 후 새로고침
    </div>
  </div>
  <script>
    (function() {
      var loaded = false;
      var fb = document.getElementById('fallback');
      function showFallback() { if (fb) fb.className = 'show'; }
      setTimeout(function(){ if(!loaded) showFallback(); }, 5000);

      var s = document.createElement('script');
      s.src = 'https://dapi.kakao.com/v2/maps/sdk.js?appkey=${KAKAO_JS_KEY}&autoload=false';
      s.onload = function() {
        if (typeof kakao === 'undefined' || !kakao.maps) { showFallback(); return; }
        kakao.maps.load(function() {
          loaded = true;
          try {
            var center = new kakao.maps.LatLng(${centerLat}, ${centerLng});
            var map = new kakao.maps.Map(document.getElementById('map'), { center: center, level: ${initialLevel} });
            ${markersJs}
            ${myCoordsJs}
            ${fitBoundsJs}
          } catch (e) { console.error('[kakao map init]', e); showFallback(); }
        });
      };
      s.onerror = showFallback;
      document.head.appendChild(s);
    })();
  </script>
</body>
</html>`;
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
        <View
          style={{
            backgroundColor: colors.bg,
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            maxHeight: '90%',
            paddingBottom: Platform.OS === 'ios' ? 32 : 16,
          }}
        >
          {/* 헤더 */}
          <View style={{ flexDirection: 'row', alignItems: 'center', padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.border }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 17, fontWeight: '900', color: colors.text }}>매장 검색</Text>
              <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 2 }}>
                카카오 지도에서 매장명·주소를 찾아 자동 입력
              </Text>
            </View>
            <Pressable onPress={onClose} hitSlop={10}>
              <Text style={{ fontSize: 24, color: colors.textMuted }}>×</Text>
            </Pressable>
          </View>

          {/* 검색 input */}
          <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={{ flex: 1, position: 'relative' }}>
                <TextInput
                  style={[styles.input, { paddingLeft: 36, marginBottom: 0 }]}
                  value={q}
                  onChangeText={setQ}
                  placeholder="예: 메가커피 강남, 서울 서초구 양재대로"
                  placeholderTextColor={colors.textLight}
                  autoFocus
                  returnKeyType="search"
                />
                <Text style={{ position: 'absolute', left: 12, top: 12, fontSize: 16 }}>🔍</Text>
              </View>
            </View>
            <Text style={{ fontSize: 10, color: colors.textLight, marginTop: 6 }}>
              {coords ? '📍 현재 위치 기준 가까운 순 정렬' : 'GPS 권한이 없어 일반 검색 결과 — 거리 정렬 비활성'}
            </Text>
          </View>

          {/* 지도 — 모달 열리는 즉시 노출 (내 위치 기준), 결과 들어오면 마커 추가 (web only) */}
          {Platform.OS === 'web' ? (
            <View
              style={{
                marginHorizontal: spacing.lg,
                marginTop: spacing.md,
                height: 240,
                borderRadius: radius.md,
                overflow: 'hidden',
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              {/* @ts-ignore — RN-Web allows iframe */}
              <iframe
                key={mapKey}
                srcDoc={mapHtml}
                style={{ width: '100%', height: '100%', border: 'none' }}
                title="kakao-map-preview"
              />
            </View>
          ) : null}

          {/* 결과 영역 */}
          <View style={{ flex: 1, marginTop: spacing.md }}>
            {busy ? (
              <View style={{ padding: spacing.xl, alignItems: 'center' }}>
                <ActivityIndicator color={colors.primary} />
              </View>
            ) : error ? (
              <View style={{ padding: spacing.xl, alignItems: 'center' }}>
                <Text style={{ fontSize: 13, color: colors.danger, fontWeight: '700' }}>❌ {error}</Text>
              </View>
            ) : results.length === 0 ? (
              <View style={{ padding: spacing.xl, alignItems: 'center' }}>
                <Text style={{ fontSize: 32, marginBottom: 8 }}>🔎</Text>
                <Text style={{ fontSize: 13, color: colors.textMuted, fontWeight: '700' }}>
                  {q.trim().length < 2 ? '두 글자 이상 입력해 주세요' : '검색 결과가 없습니다'}
                </Text>
              </View>
            ) : (
              <FlatList
                data={results}
                keyExtractor={(item, i) => `${item.placeUrl ?? i}`}
                contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.xl }}
                ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: colors.border, marginVertical: 6 }} />}
                renderItem={({ item }) => (
                  <Pressable
                    onPress={() => handleSelect(item)}
                    style={({ pressed }) => [
                      {
                        paddingVertical: 12,
                        paddingHorizontal: 8,
                        borderRadius: radius.sm,
                        flexDirection: 'row',
                        alignItems: 'flex-start',
                        gap: 10,
                      },
                      pressed && { backgroundColor: colors.surfaceAlt },
                    ]}
                  >
                    <View
                      style={{
                        width: 32, height: 32, borderRadius: 9,
                        backgroundColor: colors.primarySoft,
                        alignItems: 'center', justifyContent: 'center',
                      }}
                    >
                      <Text style={{ fontSize: 16 }}>📍</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                        <Text style={{ fontSize: 14, fontWeight: '800', color: colors.text }} numberOfLines={1}>
                          {item.placeName}
                        </Text>
                        {item.distanceMeters != null ? (
                          <Text style={{ fontSize: 11, color: colors.primary, fontWeight: '700' }}>
                            📍 {item.distanceMeters < 1000 ? `${Math.round(item.distanceMeters)}m` : `${(item.distanceMeters / 1000).toFixed(1)}km`}
                          </Text>
                        ) : null}
                      </View>
                      {item.roadAddressName ? (
                        <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }} numberOfLines={1}>
                          {item.roadAddressName}
                        </Text>
                      ) : null}
                      {item.addressName && item.addressName !== item.roadAddressName ? (
                        <Text style={{ fontSize: 11, color: colors.textLight, marginTop: 1 }} numberOfLines={1}>
                          (지번) {item.addressName}
                        </Text>
                      ) : null}
                      {item.categoryName ? (
                        <Text style={{ fontSize: 10, color: colors.textLight, marginTop: 2 }} numberOfLines={1}>
                          {item.categoryName.replace(/ > /g, ' · ')}
                        </Text>
                      ) : null}
                      {item.phone ? (
                        <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 2 }}>
                          📞 {item.phone}
                        </Text>
                      ) : null}
                    </View>
                    <Icon name="chevron-forward" size={16} color={colors.textLight} />
                  </Pressable>
                )}
              />
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}
