import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';

import { Icon } from '@/components/Icon';
import { blurFocusedForModal } from '@/components/RatingModal';
import { api, ApiError } from '@/lib/api';
import { getCurrentCoords } from '@/lib/geolocation';
import { Brand, Cafe, CafeStats, CafeType, CAFE_TYPE_LABEL, fmtPercent } from '@/lib/types';
import { colors, radius, spacing, styles } from '@/lib/theme';

type Mode = 'create' | 'edit';

const TYPE_OPTIONS: { key: CafeType; label: string; emoji: string }[] = [
  { key: 'FRANCHISE_CAFE', label: '프렌차이즈 카페', emoji: '☕' },
  { key: 'INDIVIDUAL_CAFE', label: '개인 카페', emoji: '🏠' },
  { key: 'FRANCHISE_BAKERY', label: '프렌차이즈 베이커리', emoji: '🥐' },
  { key: 'INDIVIDUAL_BAKERY', label: '개인 베이커리', emoji: '🥖' },
];

export default function OwnerCafesScreen() {
  const [cafes, setCafes] = useState<Cafe[]>([]);
  const [stats, setStats] = useState<Record<number, CafeStats>>({});
  const [q, setQ] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [mode, setMode] = useState<Mode>('create');
  const [editId, setEditId] = useState<number | null>(null);

  const [cafeType, setCafeType] = useState<CafeType | null>(null);
  const [brand, setBrand] = useState<Brand | null>(null);
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const [data, statsArr] = await Promise.all([
        api<Cafe[]>('/api/owner/cafes'),
        api<CafeStats[]>('/api/owner/dashboard/by-cafe').catch(() => [] as CafeStats[]),
      ]);
      setCafes(data);
      const m: Record<number, CafeStats> = {};
      statsArr.forEach((s) => { m[s.cafeId] = s; });
      setStats(m);
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setRefreshing(false);
    }
  }, []);

  const filteredCafes = useMemo(() => {
    const trimmed = q.trim().toLowerCase();
    if (!trimmed) return cafes;
    return cafes.filter((c) =>
      c.name.toLowerCase().includes(trimmed)
      || (c.address ?? '').toLowerCase().includes(trimmed)
      || (c.brandName ?? '').toLowerCase().includes(trimmed),
    );
  }, [cafes, q]);

  useFocusEffect(useCallback(() => {
    load();
  }, [load]));

  function notify(msg: string) {
    if (Platform.OS === 'web') window.alert(msg);
    else Alert.alert('안내', msg);
  }

  function reset() {
    setCafeType(null);
    setBrand(null);
    setName('');
    setAddress('');
    setLatitude(null);
    setLongitude(null);
  }

  function openCreate() {
    blurFocusedForModal();
    setMode('create');
    setEditId(null);
    reset();
    setModalOpen(true);
  }

  function openEdit(cafe: Cafe) {
    setMode('edit');
    setEditId(cafe.id);
    setCafeType(cafe.cafeType);
    setBrand(
      cafe.brandKey
        ? {
            key: cafe.brandKey,
            name: cafe.brandName ?? '',
            type: cafe.cafeType,
            letter: cafe.brandLetter ?? '',
            color: cafe.brandColor ?? colors.textMuted,
            tagline: '',
          }
        : null,
    );
    setName(cafe.name);
    setAddress(cafe.address);
    setLatitude(cafe.latitude ?? null);
    setLongitude(cafe.longitude ?? null);
    blurFocusedForModal();
    setModalOpen(true);
  }

  async function submit() {
    if (!cafeType) {
      notify('매장 종류를 선택해주세요');
      return;
    }
    const isFranchise = cafeType === 'FRANCHISE_CAFE' || cafeType === 'FRANCHISE_BAKERY';
    if (isFranchise && !brand) {
      notify('프렌차이즈는 브랜드를 선택해야 합니다');
      return;
    }
    if (!name.trim() || !address.trim()) {
      notify('매장명과 주소를 입력해주세요');
      return;
    }
    setBusy(true);
    try {
      const payload = {
        name: name.trim(),
        address: address.trim(),
        cafeType,
        brandKey: isFranchise ? brand!.key : null,
        latitude,
        longitude,
      };
      if (mode === 'edit' && editId != null) {
        await api(`/api/owner/cafes/${editId}`, { method: 'PUT', body: payload });
        notify('매장 정보 수정 완료');
      } else {
        await api('/api/owner/cafes', { method: 'POST', body: payload });
        notify('매장 등록 완료');
      }
      setModalOpen(false);
      await load();
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function confirmDelete(cafe: Cafe) {
    const proceed = Platform.OS === 'web'
      ? window.confirm(`"${cafe.name}"을(를) 정말 삭제할까요? (등록된 시프트가 있으면 삭제 불가)`)
      : await new Promise<boolean>((resolve) => {
          Alert.alert('매장 삭제', `"${cafe.name}"을(를) 정말 삭제할까요?`, [
            { text: '취소', style: 'cancel', onPress: () => resolve(false) },
            { text: '삭제', style: 'destructive', onPress: () => resolve(true) },
          ]);
        });
    if (!proceed) return;
    try {
      await api(`/api/owner/cafes/${cafe.id}`, { method: 'DELETE' });
      notify('매장 삭제 완료');
      await load();
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : (e as Error).message;
      notify(msg);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.surfaceAlt }}>
      <FlatList
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: 110 }}
        showsVerticalScrollIndicator={false}
        data={filteredCafes}
        keyExtractor={(c) => String(c.id)}
        ListHeaderComponent={
          <View style={{ marginBottom: spacing.lg }}>
            <Text style={styles.h2}>내 매장</Text>
            <Text style={[styles.subtitle, { marginTop: 4 }]}>
              프렌차이즈 / 개인 / 베이커리 — 4종류 매장 등록 가능
            </Text>
            {cafes.length > 0 ? (
              <View style={{ marginTop: 12 }}>
                <TextInput
                  style={[styles.input, { marginBottom: 0 }]}
                  value={q}
                  onChangeText={setQ}
                  placeholder="매장명·주소·브랜드 검색"
                  placeholderTextColor={colors.textLight}
                />
                {q.trim() ? (
                  <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 4 }}>
                    {filteredCafes.length}건 일치 (전체 {cafes.length}건 중)
                  </Text>
                ) : null}
              </View>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          <View style={{ paddingTop: 60, alignItems: 'center' }}>
            <Text style={{ fontSize: 36, marginBottom: 8 }}>🏪</Text>
            <Text style={styles.bodyMuted}>등록된 매장이 없어요</Text>
            <Pressable
              style={[styles.buttonPrimary, { marginTop: 16, paddingHorizontal: 24 }]}
              onPress={openCreate}
            >
              <Text style={styles.buttonPrimaryText}>첫 매장 등록</Text>
            </Pressable>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]}
            onPress={() => router.push(`/cafe/${item.id}` as never)}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <BrandAvatar
                letter={item.brandLetter ?? '☕'}
                color={item.brandColor ?? colors.primary}
              />
              <View style={{ flex: 1 }}>
                <Text style={styles.title}>{item.name}</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
                  <Text style={[styles.bodyMuted, { fontSize: 12 }]}>
                    {CAFE_TYPE_LABEL[item.cafeType] ?? item.cafeType}
                  </Text>
                  {item.brandName ? (
                    <Text style={[styles.bodyMuted, { fontSize: 12 }]}>· {item.brandName}</Text>
                  ) : null}
                </View>
                <Text style={[styles.bodyMuted, { marginTop: 2 }]}>{item.address}</Text>
              </View>
              <Icon name="chevron-forward" size={18} color={colors.textLight} />
            </View>

            <CafeMiniStats stats={stats[item.id]} />

            <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
              <Pressable
                style={[styles.buttonSecondary, { flex: 1, flexDirection: 'row', gap: 6 }]}
                onPress={() => openEdit(item)}
              >
                <Icon name="create-outline" size={15} color={colors.text} />
                <Text style={styles.buttonSecondaryText}>편집</Text>
              </Pressable>
              <Pressable
                style={[
                  styles.buttonSecondary,
                  { flex: 1, flexDirection: 'row', gap: 6, borderColor: colors.dangerSoft },
                ]}
                onPress={() => confirmDelete(item)}
              >
                <Icon name="trash-outline" size={15} color={colors.danger} />
                <Text style={[styles.buttonSecondaryText, { color: colors.danger }]}>삭제</Text>
              </Pressable>
            </View>
          </Pressable>
        )}
      />

      {/* FAB */}
      <Pressable
        onPress={openCreate}
        style={({ pressed }) => [
          {
            position: 'absolute',
            right: 20,
            bottom: 96,
            width: 56,
            height: 56,
            borderRadius: 28,
            backgroundColor: colors.primary,
            alignItems: 'center',
            justifyContent: 'center',
            shadowColor: '#000',
            shadowOpacity: 0.2,
            shadowRadius: 8,
            shadowOffset: { width: 0, height: 4 },
            elevation: 6,
          },
          pressed && { opacity: 0.85 },
        ]}
      >
        <Icon name="add" size={30} color="#fff" />
      </Pressable>

      <Modal
        visible={modalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setModalOpen(false)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.4)',
            alignItems: 'center',
            justifyContent: 'center',
            padding: spacing.lg,
          }}
        >
          <View
            style={{
              backgroundColor: colors.surface,
              borderRadius: radius.lg,
              padding: spacing.xl,
              width: '100%',
              maxWidth: 460,
              maxHeight: '90%',
            }}
          >
            <RegisterForm
              mode={mode}
              cafeType={cafeType}
              setCafeType={(t) => {
                setCafeType(t);
                setBrand(null); // 종류 변경 시 브랜드 초기화
              }}
              brand={brand}
              setBrand={setBrand}
              name={name}
              setName={setName}
              address={address}
              setAddress={setAddress}
              latitude={latitude}
              longitude={longitude}
              setLatitude={setLatitude}
              setLongitude={setLongitude}
              busy={busy}
              onCancel={() => setModalOpen(false)}
              onSubmit={submit}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

function CafeMiniStats({ stats }: { stats?: CafeStats }) {
  if (!stats) return null;
  const noShowRate = stats.noShowRate ?? 0;
  const noShowPct = Math.min(noShowRate * 100, 100);
  return (
    <View
      style={{
        marginTop: 12,
        padding: 10,
        borderRadius: radius.md,
        backgroundColor: colors.surfaceAlt,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
      }}
    >
      <View style={{ alignItems: 'center', minWidth: 60 }}>
        <Text style={{ fontSize: 16, fontWeight: '900', color: colors.primary }}>
          {stats.monthCompletedMatches ?? 0}
        </Text>
        <Text style={{ fontSize: 10, color: colors.textMuted, marginTop: 2 }}>이번달 매칭</Text>
      </View>
      <View style={{ width: 1, height: 32, backgroundColor: colors.border }} />
      <View style={{ alignItems: 'center', minWidth: 50 }}>
        <Text style={{ fontSize: 14, fontWeight: '900', color: colors.warn }}>
          {stats.avgRating != null ? `★ ${stats.avgRating.toFixed(1)}` : '★ —'}
        </Text>
        <Text style={{ fontSize: 10, color: colors.textMuted, marginTop: 2 }}>
          평점 ({stats.ratingsCount ?? 0})
        </Text>
      </View>
      <View style={{ width: 1, height: 32, backgroundColor: colors.border }} />
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <Text style={{ fontSize: 10, color: colors.textMuted }}>노쇼율</Text>
          <Text
            style={{
              fontSize: 11,
              fontWeight: '800',
              color: noShowRate > 0 ? colors.danger : colors.success,
            }}
          >
            {fmtPercent(noShowRate)}
          </Text>
        </View>
        <View
          style={{
            marginTop: 4,
            height: 6,
            borderRadius: 3,
            backgroundColor: colors.surfaceMuted,
            overflow: 'hidden',
          }}
        >
          <View
            style={{
              width: `${noShowPct}%`,
              height: '100%',
              backgroundColor: noShowRate > 0 ? colors.danger : colors.success,
            }}
          />
        </View>
      </View>
    </View>
  );
}

function BrandAvatar({ letter, color }: { letter: string; color: string }) {
  return (
    <View
      style={{
        width: 44,
        height: 44,
        borderRadius: 12,
        backgroundColor: color,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ color: '#fff', fontWeight: '900', fontSize: 13 }}>{letter}</Text>
    </View>
  );
}

function RegisterForm({
  mode,
  cafeType,
  setCafeType,
  brand,
  setBrand,
  name,
  setName,
  address,
  setAddress,
  latitude,
  longitude,
  setLatitude,
  setLongitude,
  busy,
  onCancel,
  onSubmit,
}: {
  mode: Mode;
  cafeType: CafeType | null;
  setCafeType: (t: CafeType) => void;
  brand: Brand | null;
  setBrand: (b: Brand | null) => void;
  name: string;
  setName: (s: string) => void;
  address: string;
  setAddress: (s: string) => void;
  latitude: number | null;
  longitude: number | null;
  setLatitude: (n: number | null) => void;
  setLongitude: (n: number | null) => void;
  busy: boolean;
  onCancel: () => void;
  onSubmit: () => void;
}) {
  const [busyLoc, setBusyLoc] = useState(false);
  const fillCurrentLocation = async () => {
    setBusyLoc(true);
    try {
      const c = await getCurrentCoords();
      setLatitude(c.latitude);
      setLongitude(c.longitude);
    } catch (e) {
      const msg = (e as Error).message || '위치 가져오기 실패';
      if (Platform.OS === 'web') window.alert(msg);
      else Alert.alert('위치 오류', msg);
    } finally {
      setBusyLoc(false);
    }
  };
  const isFranchise = cafeType === 'FRANCHISE_CAFE' || cafeType === 'FRANCHISE_BAKERY';
  const [pickerOpen, setPickerOpen] = useState(false);

  return (
    <ScrollView showsVerticalScrollIndicator={false}>
      <Text style={[styles.h2, { marginBottom: 4 }]}>
        {mode === 'edit' ? '매장 정보 수정' : '매장 등록'}
      </Text>
      <Text style={[styles.subtitle, { marginBottom: 16 }]}>
        매장 종류와 정보를 입력해주세요
      </Text>

      {/* Step 1: 매장 종류 */}
      <Text style={[styles.subtitle, { marginBottom: 8, fontWeight: '700' }]}>1. 매장 종류</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
        {TYPE_OPTIONS.map((opt) => {
          const selected = cafeType === opt.key;
          return (
            <Pressable
              key={opt.key}
              onPress={() => setCafeType(opt.key)}
              style={[
                {
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                  borderRadius: radius.md,
                  borderWidth: 1.5,
                  borderColor: selected ? colors.primary : colors.border,
                  backgroundColor: selected ? colors.primarySoft : colors.surface,
                  flexDirection: 'row',
                  gap: 6,
                  alignItems: 'center',
                },
              ]}
            >
              <Text style={{ fontSize: 16 }}>{opt.emoji}</Text>
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: '700',
                  color: selected ? colors.primaryDark : colors.text,
                }}
              >
                {opt.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Step 2: 브랜드 (프렌차이즈만) */}
      {isFranchise ? (
        <>
          <Text style={[styles.subtitle, { marginBottom: 8, fontWeight: '700' }]}>2. 브랜드</Text>
          <Pressable
            onPress={() => {
              blurFocusedForModal();
              setPickerOpen(true);
            }}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 10,
              padding: 12,
              borderRadius: radius.md,
              borderWidth: 1.5,
              borderColor: brand ? colors.primary : colors.border,
              backgroundColor: brand ? colors.primarySoft : colors.surfaceAlt,
              marginBottom: 16,
            }}
          >
            {brand ? (
              <BrandAvatar letter={brand.letter} color={brand.color} />
            ) : (
              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  backgroundColor: colors.surfaceMuted,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text style={{ color: colors.textLight, fontSize: 18 }}>🔍</Text>
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text }}>
                {brand ? brand.name : '브랜드 선택'}
              </Text>
              <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }}>
                {brand ? brand.tagline : '검색해서 골라주세요'}
              </Text>
            </View>
            <Icon name="chevron-forward" size={18} color={colors.textMuted} />
          </Pressable>
        </>
      ) : null}

      {/* Step 3: 매장명 + 주소 */}
      <Text style={[styles.subtitle, { marginBottom: 8, fontWeight: '700' }]}>
        {isFranchise ? '3. 지점명' : '2. 매장명'}
      </Text>
      <TextInput
        style={styles.input}
        value={name}
        onChangeText={setName}
        placeholder={isFranchise ? `예: ${brand?.name ?? '메가커피'} 양재점` : '예: 우리집 카페'}
        placeholderTextColor={colors.textLight}
      />

      <Text style={[styles.subtitle, { marginBottom: 8, fontWeight: '700' }]}>
        {isFranchise ? '4. 주소' : '3. 주소'}
      </Text>
      <TextInput
        style={styles.input}
        value={address}
        onChangeText={setAddress}
        placeholder="예: 서울 서초구 양재대로 123"
        placeholderTextColor={colors.textLight}
      />

      <Text style={[styles.subtitle, { marginBottom: 8, fontWeight: '700' }]}>
        {isFranchise ? '5. 매장 좌표 (GPS 출근 게이트)' : '4. 매장 좌표 (GPS 출근 게이트)'}
      </Text>
      <View
        style={{
          padding: 12,
          borderRadius: radius.md,
          backgroundColor: colors.surfaceAlt,
          borderWidth: 1,
          borderColor: colors.border,
          marginBottom: 16,
        }}
      >
        {latitude != null && longitude != null ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={{ fontSize: 16 }}>📍</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 12, fontWeight: '700', color: colors.text }}>
                {latitude.toFixed(6)}, {longitude.toFixed(6)}
              </Text>
              <Text style={{ fontSize: 10, color: colors.textMuted, marginTop: 2 }}>
                워커가 이 매장 반경 100m 안에서만 출근 체크인 가능
              </Text>
            </View>
            <Pressable
              onPress={() => {
                setLatitude(null);
                setLongitude(null);
              }}
              hitSlop={8}
            >
              <Text style={{ fontSize: 18, color: colors.textMuted, paddingHorizontal: 4 }}>×</Text>
            </Pressable>
          </View>
        ) : (
          <View>
            <Text style={{ fontSize: 11, color: colors.textMuted, marginBottom: 8 }}>
              좌표 미입력 시 GPS 게이트가 적용되지 않습니다 (어디서나 체크인 가능)
            </Text>
            <Pressable
              onPress={fillCurrentLocation}
              disabled={busyLoc}
              style={({ pressed }) => [
                {
                  paddingVertical: 10,
                  paddingHorizontal: 14,
                  borderRadius: radius.md,
                  backgroundColor: colors.primary,
                  alignItems: 'center',
                  opacity: busyLoc ? 0.7 : 1,
                },
                pressed && { opacity: 0.85 },
              ]}
            >
              <Text style={{ fontSize: 12, fontWeight: '800', color: '#fff' }}>
                {busyLoc ? '위치 가져오는 중...' : '📍 현재 위치로 채우기'}
              </Text>
            </Pressable>
          </View>
        )}
      </View>

      <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
        <Pressable
          style={[styles.buttonSecondary, { flex: 1 }]}
          onPress={onCancel}
          disabled={busy}
        >
          <Text style={styles.buttonSecondaryText}>취소</Text>
        </Pressable>
        <Pressable
          style={[styles.buttonPrimary, { flex: 1 }, busy && { opacity: 0.7 }]}
          onPress={onSubmit}
          disabled={busy}
        >
          <Text style={styles.buttonPrimaryText}>
            {busy ? (mode === 'edit' ? '수정 중...' : '등록 중...') : mode === 'edit' ? '저장' : '등록'}
          </Text>
        </Pressable>
      </View>

      {/* 브랜드 선택 모달 */}
      <BrandPicker
        visible={pickerOpen}
        type={cafeType}
        onClose={() => setPickerOpen(false)}
        onSelect={(b) => {
          setBrand(b);
          setPickerOpen(false);
        }}
      />
    </ScrollView>
  );
}

function BrandPicker({
  visible,
  type,
  onClose,
  onSelect,
}: {
  visible: boolean;
  type: CafeType | null;
  onClose: () => void;
  onSelect: (b: Brand) => void;
}) {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [q, setQ] = useState('');

  useEffect(() => {
    if (!visible || !type) return;
    (async () => {
      try {
        const data = await api<Brand[]>(`/api/brands?type=${type}`);
        setBrands(data);
      } catch (e) {
        console.warn('brand load error', e);
      }
    })();
  }, [visible, type]);

  const filtered = useMemo(() => {
    const trimmed = q.trim().toLowerCase();
    if (!trimmed) return brands;
    return brands.filter(
      (b) =>
        b.name.toLowerCase().includes(trimmed) ||
        b.key.toLowerCase().includes(trimmed) ||
        b.tagline.toLowerCase().includes(trimmed),
    );
  }, [q, brands]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View
        style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.4)',
          justifyContent: 'flex-end',
        }}
      >
        <View
          style={{
            backgroundColor: colors.surface,
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            padding: spacing.xl,
            maxHeight: '80%',
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <Text style={[styles.h2]}>브랜드 선택</Text>
            <Pressable onPress={onClose}>
              <Text style={{ fontSize: 22, color: colors.textMuted }}>×</Text>
            </Pressable>
          </View>
          <TextInput
            style={[styles.input, { marginBottom: 12 }]}
            value={q}
            onChangeText={setQ}
            placeholder="브랜드명·태그 검색 (예: 메가, 베이글)"
            placeholderTextColor={colors.textLight}
          />
          <FlatList
            data={filtered}
            keyExtractor={(b) => b.key}
            showsVerticalScrollIndicator={false}
            ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: colors.border, marginVertical: 4 }} />}
            ListEmptyComponent={
              <Text style={[styles.bodyMuted, { textAlign: 'center', paddingVertical: 24 }]}>
                검색 결과가 없습니다
              </Text>
            }
            renderItem={({ item }) => (
              <Pressable
                onPress={() => onSelect(item)}
                style={({ pressed }) => [
                  {
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 12,
                    paddingVertical: 10,
                  },
                  pressed && { backgroundColor: colors.surfaceAlt },
                ]}
              >
                <BrandAvatar letter={item.letter} color={item.color} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text }}>{item.name}</Text>
                  <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }}>{item.tagline}</Text>
                </View>
                <Icon name="chevron-forward" size={18} color={colors.textMuted} />
              </Pressable>
            )}
          />
        </View>
      </View>
    </Modal>
  );
}
