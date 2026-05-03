import { Image, View } from 'react-native';

/**
 * 단바 브랜드 마크 — 실제 앱 아이콘(오렌지 + 노란 번개 + 단바)을 그대로 표시.
 * icon.png 를 작게 라운드 처리해 헤더 좌측에 노출.
 */
export default function BrandMark({ size = 'sm' }: { size?: 'sm' | 'md' }) {
  const isMd = size === 'md';
  const tile = isMd ? 36 : 30;
  const radius = isMd ? 10 : 8;

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingLeft: 12 }}>
      <Image
        source={require('@/assets/images/icon.png')}
        style={{ width: tile, height: tile, borderRadius: radius }}
        resizeMode="cover"
      />
    </View>
  );
}
