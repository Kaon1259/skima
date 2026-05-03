import { useEffect, useRef } from 'react';
import { Animated, Easing, Image, Text, View } from 'react-native';
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
        backgroundColor: '#FFF7ED',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Animated.View style={{ opacity: fade, transform: [{ scale }], alignItems: 'center' }}>
        <Image
          source={require('@/assets/images/icon.png')}
          style={{
            width: 180,
            height: 180,
            borderRadius: 40,
            marginBottom: 24,
          }}
          resizeMode="cover"
        />
        <Text style={{ fontSize: 16, color: colors.textMuted, fontWeight: '700' }}>
          1시간 매칭 · 30분 입금
        </Text>
      </Animated.View>

      <Text
        style={{
          position: 'absolute',
          bottom: 40,
          color: colors.textLight,
          fontSize: 12,
          fontWeight: '500',
        }}
      >
        단바 · 단기 알바 30분 매칭
      </Text>
    </View>
  );
}
