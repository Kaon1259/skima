import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Animated, Platform, Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';

import { colors, radius, spacing } from '@/lib/theme';

type ToastSeverity = 'info' | 'warn' | 'success' | 'danger';

type Toast = {
  id: number;
  title: string;
  subtitle?: string;
  severity?: ToastSeverity;
  /** 탭 시 이동 — 라우트 string */
  route?: string;
  /** ms — 자동 닫힘 (기본 4500) */
  ttl?: number;
};

type Ctx = {
  push: (t: Omit<Toast, 'id'>) => void;
};

const ToastContext = createContext<Ctx | null>(null);

export function useToast(): Ctx {
  const v = useContext(ToastContext);
  if (!v) {
    return {
      push: () => {
        if (__DEV__) console.warn('useToast: ToastProvider 가 마운트되지 않음');
      },
    };
  }
  return v;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const idRef = useRef(0);

  const push = useCallback((t: Omit<Toast, 'id'>) => {
    const id = ++idRef.current;
    const item: Toast = { id, ttl: 4500, severity: 'info', ...t };
    setToasts((prev) => [...prev, item]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((x) => x.id !== id));
    }, item.ttl);
  }, []);

  return (
    <ToastContext.Provider value={{ push }}>
      {children}
      <ToastHost toasts={toasts} onClose={(id) => setToasts((p) => p.filter((x) => x.id !== id))} />
    </ToastContext.Provider>
  );
}

function ToastHost({
  toasts,
  onClose,
}: {
  toasts: Toast[];
  onClose: (id: number) => void;
}) {
  if (toasts.length === 0) return null;
  return (
    <View
      pointerEvents="box-none"
      style={[
        {
          position: 'absolute',
          top: Platform.OS === 'web' ? 12 : 56,
          left: 0,
          right: 0,
          alignItems: 'center',
          zIndex: 9999,
        },
        // web 에서만 viewport 고정 — 스크롤 시에도 상단 고정
        Platform.OS === 'web' ? ({ position: 'fixed' } as any) : null,
      ]}
    >
      {toasts.map((t) => (
        <ToastCard key={t.id} toast={t} onClose={() => onClose(t.id)} />
      ))}
    </View>
  );
}

const SEVERITY_COLORS: Record<ToastSeverity, { bg: string; fg: string; border: string }> = {
  info: { bg: colors.infoSoft, fg: colors.info, border: colors.info },
  warn: { bg: colors.warnSoft, fg: colors.warn, border: colors.warn },
  success: { bg: colors.successSoft, fg: colors.success, border: colors.success },
  danger: { bg: colors.dangerSoft, fg: colors.danger, border: colors.danger },
};

function ToastCard({ toast, onClose }: { toast: Toast; onClose: () => void }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const ty = useRef(new Animated.Value(-20)).current;
  const c = SEVERITY_COLORS[toast.severity ?? 'info'];

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 220, useNativeDriver: true }),
      Animated.timing(ty, { toValue: 0, duration: 220, useNativeDriver: true }),
    ]).start();
  }, [opacity, ty]);

  return (
    <Animated.View
      style={{
        opacity,
        transform: [{ translateY: ty }],
        marginTop: 8,
        marginHorizontal: spacing.lg,
        maxWidth: 460,
        width: '92%',
      }}
    >
      <Pressable
        onPress={() => {
          if (toast.route) router.push(toast.route as never);
          onClose();
        }}
        style={({ pressed }) => [
          {
            paddingHorizontal: 14,
            paddingVertical: 12,
            borderRadius: radius.md,
            backgroundColor: c.bg,
            borderLeftWidth: 4,
            borderLeftColor: c.border,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            shadowColor: '#000',
            shadowOpacity: 0.12,
            shadowRadius: 8,
            shadowOffset: { width: 0, height: 4 },
            elevation: 4,
          },
          pressed && { opacity: 0.85 },
        ]}
      >
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 13, fontWeight: '800', color: c.fg }}>{toast.title}</Text>
          {toast.subtitle ? (
            <Text style={{ fontSize: 11, color: colors.text, marginTop: 2 }} numberOfLines={2}>
              {toast.subtitle}
            </Text>
          ) : null}
        </View>
        <Pressable hitSlop={10} onPress={onClose}>
          <Text style={{ fontSize: 18, color: colors.textMuted, paddingHorizontal: 4 }}>×</Text>
        </Pressable>
      </Pressable>
    </Animated.View>
  );
}
