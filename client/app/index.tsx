import { useEffect, useRef } from 'react';
import { Animated, Easing, Text, View } from 'react-native';
import { router } from 'expo-router';

import { useAuth } from '@/lib/auth';
import { colors } from '@/lib/theme';

export default function IndexSplash() {
  const { auth, loading } = useAuth();
  const fade = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.85)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.timing(scale, {
        toValue: 1,
        duration: 700,
        easing: Easing.out(Easing.back(1.6)),
        useNativeDriver: true,
      }),
    ]).start();
  }, [fade, scale]);

  // auth 로딩이 끝나기 전엔 절대 라우팅하지 않음 (refresh 무한로딩 방지)
  useEffect(() => {
    if (loading) return;
    const t = setTimeout(() => {
      if (!auth) router.replace('/login');
      else if (auth.role === 'OWNER') router.replace('/owner/shifts');
      else if (auth.role === 'WORKER') router.replace('/worker/shifts');
      else router.replace('/admin/kpi');
    }, 900);
    return () => clearTimeout(t);
  }, [auth, loading]);

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Animated.View style={{ opacity: fade, transform: [{ scale }], alignItems: 'center' }}>
        <View
          style={{
            width: 96,
            height: 96,
            borderRadius: 28,
            backgroundColor: '#fff',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 20,
          }}
        >
          <Text style={{ fontSize: 44 }}>⚡</Text>
        </View>
        <Text style={{ fontSize: 36, fontWeight: '900', color: '#fff', letterSpacing: -0.8 }}>
          스키마 바이트
        </Text>
        <Text style={{ fontSize: 15, color: 'rgba(255,255,255,0.92)', marginTop: 8, fontWeight: '600' }}>
          1시간 매칭 · 30분 입금
        </Text>
      </Animated.View>

      <Text
        style={{
          position: 'absolute',
          bottom: 40,
          color: 'rgba(255,255,255,0.7)',
          fontSize: 12,
          fontWeight: '500',
        }}
      >
        Skima Byte · 단기 카페 알바 매칭
      </Text>
    </View>
  );
}
