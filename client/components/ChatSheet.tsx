import { useCallback, useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';

import { Icon } from '@/components/Icon';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { fmtDateTime } from '@/lib/types';
import { colors, radius, spacing, styles } from '@/lib/theme';

const POLL_MS = 5_000;

type ChatMessage = {
  id: number;
  matchId: number;
  senderId: number;
  senderName: string;
  senderRole: 'OWNER' | 'WORKER' | 'ADMIN';
  body: string;
  createdAt: string;
};

type Props = {
  visible: boolean;
  matchId: number | null;
  title?: string;
  onClose: () => void;
};

export function ChatSheet({ visible, matchId, title, onClose }: Props) {
  const { auth } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    if (matchId == null) return;
    try {
      const data = await api<ChatMessage[]>(`/api/matches/${matchId}/messages`);
      setMessages((prev) => {
        // 새 메시지가 늘었을 때만 스크롤
        if (data.length > prev.length) {
          setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
        }
        return data;
      });
    } catch (e) {
      // silent
    }
  }, [matchId]);

  useEffect(() => {
    if (!visible || matchId == null) {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;
      return;
    }
    load();
    // 채팅 열면 본 시각 갱신 (점주/워커 자동 분기)
    api(`/api/matches/${matchId}/messages/seen`, { method: 'POST' }).catch(() => {});
    timerRef.current = setInterval(load, POLL_MS);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [visible, matchId, load]);

  async function send() {
    const body = input.trim();
    if (!body || matchId == null) return;
    setBusy(true);
    try {
      const created = await api<ChatMessage>(`/api/matches/${matchId}/messages`, {
        method: 'POST',
        body: { body },
      });
      setMessages((prev) => [...prev, created]);
      setInput('');
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
    } catch (e) {
      if (Platform.OS === 'web') window.alert((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' }}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{
            backgroundColor: colors.surface,
            borderTopLeftRadius: radius.lg,
            borderTopRightRadius: radius.lg,
            maxHeight: '85%',
            minHeight: 420,
          }}
        >
          {/* Header */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: spacing.lg,
              borderBottomWidth: 1,
              borderBottomColor: colors.border,
            }}
          >
            <View style={{ flex: 1 }}>
              <Text style={[styles.title, { fontSize: 15 }]}>{title ?? '채팅'}</Text>
              <Text style={[styles.bodyMuted, { fontSize: 11, marginTop: 2 }]}>
                매칭 #{matchId ?? '—'} · 5초마다 자동 새로고침
              </Text>
            </View>
            <Pressable onPress={onClose} style={{ padding: 6 }}>
              <Text style={{ fontSize: 18, color: colors.textMuted }}>×</Text>
            </Pressable>
          </View>

          {/* Messages */}
          <ScrollView
            ref={scrollRef}
            style={{ flex: 1, backgroundColor: colors.surfaceAlt }}
            contentContainerStyle={{ padding: spacing.md, gap: 8 }}
            showsVerticalScrollIndicator={false}
          >
            {messages.length === 0 ? (
              <View style={{ paddingVertical: 60, alignItems: 'center' }}>
                <Text style={{ fontSize: 28, marginBottom: 8 }}>💬</Text>
                <Text style={styles.bodyMuted}>아직 메시지가 없어요. 먼저 인사를 건네보세요</Text>
              </View>
            ) : (
              messages.map((m) => {
                const mine = auth?.id === m.senderId;
                return (
                  <View
                    key={m.id}
                    style={{
                      alignSelf: mine ? 'flex-end' : 'flex-start',
                      maxWidth: '80%',
                    }}
                  >
                    {!mine ? (
                      <Text style={{ fontSize: 10, color: colors.textMuted, marginBottom: 2, marginLeft: 6 }}>
                        {m.senderName} · {m.senderRole === 'OWNER' ? '점주' : '워커'}
                      </Text>
                    ) : null}
                    <View
                      style={{
                        paddingHorizontal: 12,
                        paddingVertical: 8,
                        borderRadius: radius.md,
                        backgroundColor: mine ? colors.primary : colors.surface,
                        borderWidth: mine ? 0 : 1,
                        borderColor: colors.border,
                      }}
                    >
                      <Text style={{ color: mine ? '#fff' : colors.text, fontSize: 13, lineHeight: 18 }}>
                        {m.body}
                      </Text>
                    </View>
                    <Text
                      style={{
                        fontSize: 9,
                        color: colors.textLight,
                        marginTop: 2,
                        textAlign: mine ? 'right' : 'left',
                        marginHorizontal: 4,
                      }}
                    >
                      {fmtDateTime(m.createdAt)}
                    </Text>
                  </View>
                );
              })
            )}
          </ScrollView>

          {/* Input */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              padding: spacing.md,
              borderTopWidth: 1,
              borderTopColor: colors.border,
            }}
          >
            <TextInput
              style={[styles.input, { flex: 1, marginBottom: 0 }]}
              value={input}
              onChangeText={setInput}
              placeholder="메시지를 입력하세요"
              placeholderTextColor={colors.textLight}
              onSubmitEditing={send}
              returnKeyType="send"
              blurOnSubmit={false}
            />
            <Pressable
              style={[styles.buttonPrimary, { paddingHorizontal: 16 }, busy && { opacity: 0.7 }]}
              onPress={send}
              disabled={busy || !input.trim()}
            >
              <Text style={styles.buttonPrimaryText}>{busy ? '...' : '전송'}</Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}
