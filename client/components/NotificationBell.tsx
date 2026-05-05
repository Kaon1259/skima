import { useCallback, useEffect, useRef, useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';

import { Icon } from '@/components/Icon';
import { blurFocusedForModal } from '@/components/RatingModal';
import { api } from '@/lib/api';
import { useToast } from '@/lib/toast';
import { NotificationItem, fmtDateTime } from '@/lib/types';
import { colors, radius, spacing, styles } from '@/lib/theme';

const POLL_MS = 15_000;

const SEVERITY_COLOR: Record<NotificationItem['severity'], string> = {
  info: colors.info,
  warn: colors.warn,
  success: colors.success,
};

const SEVERITY_BG: Record<NotificationItem['severity'], string> = {
  info: colors.infoSoft,
  warn: colors.warnSoft,
  success: colors.successSoft,
};

const TYPE_ICON: Record<NotificationItem['type'], string> = {
  NEW_APPLICATION: 'people',
  NEEDS_RATING: 'star',
  WORKER_RATING: 'star',
  NEW_MATCH: 'checkmark-circle',
  NO_SHOW: 'alert-circle',
  APPLICATION_REJECTED: 'alert-circle',
  APPLICATION_AUTO_WITHDRAWN: 'alert-circle',
  OWNER_RATING: 'star',
  PAYOUT_COMPLETED: 'wallet',
  PAYOUT_REQUESTED: 'wallet',
  NOSHOW_REPORTED: 'alert-circle',
  SHIFT_CANCELED: 'alert-circle',
  WORKER_CONTRACT_ACK: 'document-text',
  CONTRACT_ACK_REQUIRED: 'document-text',
  FAVORITE_CAFE_NEW_SHIFT: 'star',
};

type Role = 'owner' | 'worker';

type Props = {
  role: Role;
};

export default function NotificationBell({ role }: Props) {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [open, setOpen] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const seenKeysRef = useRef<Set<string>>(new Set());
  const baselineLoadedRef = useRef(false);
  const toast = useToast();

  const listUrl = `/api/${role}/notifications`;
  const markUrl = `/api/${role}/notifications/mark-seen`;

  const itemKey = (it: NotificationItem) =>
    `${it.type}:${it.targetId ?? ''}:${it.at}`;

  // 입력 포커스 중에는 자동 이동 차단 — 작업 중 갑자기 페이지 바뀌는 거 방지
  function hasFocusedInput(): boolean {
    if (Platform.OS !== 'web') return false; // native에선 일단 항상 이동 허용
    if (typeof document === 'undefined') return false;
    const el = document.activeElement;
    if (!el) return false;
    const tag = el.tagName?.toLowerCase();
    return tag === 'input' || tag === 'textarea' || el.getAttribute('contenteditable') === 'true';
  }

  const load = useCallback(async () => {
    try {
      const data = await api<NotificationItem[]>(listUrl);
      setItems(data);

      // 첫 로드는 baseline (이미 누적된 알림은 토스트 안 띄움)
      if (!baselineLoadedRef.current) {
        data.forEach((it) => seenKeysRef.current.add(itemKey(it)));
        baselineLoadedRef.current = true;
        return;
      }

      // 새 unread 항목만 토스트
      const fresh = data
        .filter((it) => it.unread && !seenKeysRef.current.has(itemKey(it)))
        .sort((a, b) => a.at.localeCompare(b.at));
      for (const it of fresh) {
        seenKeysRef.current.add(itemKey(it));
        toast.push({
          title: it.title,
          subtitle: it.subtitle,
          severity: it.severity,
          route: it.route,
        });
      }

      // 워커: NEW_MATCH 도착 시 자동 이동 (입력 포커스 중이 아닐 때)
      if (role === 'worker') {
        const newMatch = fresh.find((it) => it.type === 'NEW_MATCH' && it.route);
        if (newMatch && !hasFocusedInput()) {
          // 짧은 딜레이 후 push — 토스트가 잠깐 보인 뒤 이동
          setTimeout(() => {
            try {
              router.push(newMatch.route as never);
            } catch { /* ignore */ }
          }, 800);
        }
      }
      // 사라진 알림 키도 정리 (메모리 누수 방지)
      const liveKeys = new Set(data.map(itemKey));
      seenKeysRef.current.forEach((k) => {
        if (!liveKeys.has(k)) seenKeysRef.current.delete(k);
      });
    } catch {
      // 조용히 실패 — 알림은 부가 기능
    }
  }, [listUrl, toast]);

  useEffect(() => {
    load();
    timerRef.current = setInterval(load, POLL_MS);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [load]);

  const totalCount = items.length;
  const unreadCount = items.filter((i) => i.unread).length;

  async function markSeen() {
    try {
      await api(markUrl, { method: 'POST' });
      setItems((prev) => prev.map((i) => ({ ...i, unread: false })));
    } catch {
      // silent
    }
  }

  function navigate(item: NotificationItem) {
    setOpen(false);
    if (item.route) {
      router.push(item.route as never);
    }
  }

  return (
    <>
      <Pressable
        onPress={() => {
          blurFocusedForModal();
          load();
          setOpen(true);
          markSeen();
        }}
        style={({ pressed }) => [
          { padding: 8, marginRight: 4 },
          pressed && { opacity: 0.6 },
        ]}
      >
        <View>
          <Icon name="notifications" size={22} color={colors.text} />
          {unreadCount > 0 ? (
            <View
              style={{
                position: 'absolute',
                top: -2,
                right: -4,
                minWidth: 18,
                height: 18,
                paddingHorizontal: 4,
                borderRadius: 9,
                backgroundColor: colors.danger,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ color: '#fff', fontSize: 10, fontWeight: '900' }}>
                {unreadCount > 99 ? '99+' : unreadCount}
              </Text>
            </View>
          ) : null}
        </View>
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' }}
          onPress={() => setOpen(false)}
        >
          <View style={{ marginTop: 56, marginRight: 12, alignItems: 'flex-end' }}>
            <Pressable
              onPress={() => {}}
              style={{
                width: 360,
                maxHeight: 520,
                backgroundColor: colors.surface,
                borderRadius: radius.lg,
                padding: spacing.md,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.12,
                shadowRadius: 12,
                elevation: 6,
              }}
            >
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 10,
                  paddingHorizontal: 4,
                }}
              >
                <Text style={[styles.title, { fontSize: 14 }]}>
                  알림 ({totalCount})
                  {unreadCount > 0 ? (
                    <Text style={{ color: colors.danger, fontSize: 12, fontWeight: '800' }}>
                      {' '}· 새 {unreadCount}
                    </Text>
                  ) : null}
                </Text>
                <Pressable onPress={() => setOpen(false)}>
                  <Text style={{ color: colors.textMuted, fontSize: 12, fontWeight: '700' }}>닫기</Text>
                </Pressable>
              </View>
              <ScrollView style={{ maxHeight: 460 }} showsVerticalScrollIndicator={false}>
                {totalCount === 0 ? (
                  <View style={{ paddingVertical: 36, alignItems: 'center' }}>
                    <Text style={{ fontSize: 28, marginBottom: 8 }}>🌱</Text>
                    <Text style={styles.bodyMuted}>새 알림이 없어요</Text>
                  </View>
                ) : (
                  items.map((it, i) => (
                    <Pressable
                      key={i}
                      onPress={() => navigate(it)}
                      style={({ pressed }) => [
                        {
                          flexDirection: 'row',
                          gap: 10,
                          padding: 12,
                          borderRadius: radius.md,
                          backgroundColor: SEVERITY_BG[it.severity],
                          marginBottom: 6,
                          alignItems: 'flex-start',
                          borderLeftWidth: it.unread ? 3 : 0,
                          borderLeftColor: it.unread ? SEVERITY_COLOR[it.severity] : 'transparent',
                          opacity: it.unread ? 1 : 0.65,
                        },
                        pressed && { opacity: 0.7 },
                      ]}
                    >
                      <View
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: 14,
                          backgroundColor: SEVERITY_COLOR[it.severity],
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Icon name={TYPE_ICON[it.type]} size={14} color="#fff" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 13, fontWeight: '800', color: colors.text }}>
                          {it.title}
                        </Text>
                        <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }}>
                          {it.subtitle}
                        </Text>
                        <Text style={{ fontSize: 10, color: colors.textLight, marginTop: 4 }}>
                          {fmtDateTime(it.at)}
                        </Text>
                      </View>
                    </Pressable>
                  ))
                )}
              </ScrollView>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </>
  );
}
