import { useCallback, useEffect, useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';

import { Avatar } from '@/components/Avatar';
import { Icon } from '@/components/Icon';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { colors, radius, spacing } from '@/lib/theme';

/**
 * 헤더 우측 프로필 칩 — 작은 아바타 + 이름.
 * 탭하면 드롭다운 (프로필/로그아웃).
 * 프로필 사진은 /api/me 한 번 불러서 캐시.
 */
export default function HeaderLogout() {
  const { auth, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [profileImage, setProfileImage] = useState<string | null>(null);

  const loadProfileImage = useCallback(async () => {
    if (!auth) return;
    try {
      const me = await api<{ profileImage?: string | null }>('/api/me');
      setProfileImage(me.profileImage ?? null);
    } catch {
      // silent — 헤더 아바타는 폴백으로 표시
    }
  }, [auth]);

  useEffect(() => { loadProfileImage(); }, [loadProfileImage]);
  // 메뉴 열 때마다 최신 사진 반영 (사용자가 프로필 사진 바꿨을 수 있음)
  useEffect(() => { if (open) loadProfileImage(); }, [open, loadProfileImage]);

  const role = auth?.role;
  const profileRoute = role === 'OWNER' ? '/owner/cafes' : role === 'WORKER' ? '/worker/me' : null;

  async function handleLogout() {
    setOpen(false);
    await logout();
    router.replace('/');
  }

  function handleProfile() {
    setOpen(false);
    if (profileRoute) router.push(profileRoute as never);
  }

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        style={({ pressed }) => [
          {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            paddingLeft: 6,
            paddingRight: 10,
            paddingVertical: 4,
            marginRight: 6,
            borderRadius: radius.pill,
            backgroundColor: colors.surfaceAlt,
          },
          pressed && { opacity: 0.7 },
        ]}
      >
        <Avatar name={auth?.name ?? '?'} imageUrl={profileImage} size={26} />
        <Text
          style={{
            color: colors.text,
            fontSize: 12,
            fontWeight: '700',
            letterSpacing: -0.3,
            maxWidth: 80,
          }}
          numberOfLines={1}
        >
          {auth?.name ?? ''}
        </Text>
        <Icon name="chevron-forward" size={12} color={colors.textMuted} style={{ transform: [{ rotate: '90deg' }] }} />
      </Pressable>

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <Pressable
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' }}
          onPress={() => setOpen(false)}
        >
          <View
            style={{
              marginTop: 56,
              marginRight: 12,
              alignItems: 'flex-end',
            }}
          >
            <Pressable
              onPress={(e) => e.stopPropagation()}
              style={{
                backgroundColor: colors.bg,
                borderRadius: radius.lg,
                minWidth: 200,
                padding: spacing.sm,
                borderWidth: 1,
                borderColor: colors.border,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.15,
                shadowRadius: 12,
                elevation: 6,
              }}
            >
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 10,
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                  borderBottomWidth: 1,
                  borderBottomColor: colors.border,
                }}
              >
                <Avatar name={auth?.name ?? '?'} imageUrl={profileImage} size={32} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 13, fontWeight: '800', color: colors.text, letterSpacing: -0.3 }}>
                    {auth?.name ?? '알 수 없음'}
                  </Text>
                  <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 1 }}>
                    {role === 'OWNER' ? '점주' : role === 'WORKER' ? '워커' : role === 'ADMIN' ? '관리자' : '사용자'}
                  </Text>
                </View>
              </View>

              {profileRoute ? (
                <Pressable
                  onPress={handleProfile}
                  style={({ pressed }) => [
                    {
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 10,
                      paddingHorizontal: 12,
                      paddingVertical: 10,
                      borderRadius: radius.md,
                    },
                    pressed && { backgroundColor: colors.surfaceAlt },
                  ]}
                >
                  <Icon name="user" size={16} color={colors.text} />
                  <Text style={{ fontSize: 13, fontWeight: '600', color: colors.text }}>
                    {role === 'OWNER' ? '내 매장' : '마이페이지'}
                  </Text>
                </Pressable>
              ) : null}

              <Pressable
                onPress={handleLogout}
                style={({ pressed }) => [
                  {
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 10,
                    paddingHorizontal: 12,
                    paddingVertical: 10,
                    borderRadius: radius.md,
                  },
                  pressed && { backgroundColor: colors.dangerSoft },
                ]}
              >
                <Icon name="log-out" size={16} color={colors.danger} />
                <Text style={{ fontSize: 13, fontWeight: '600', color: colors.danger }}>
                  로그아웃
                </Text>
              </Pressable>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </>
  );
}
