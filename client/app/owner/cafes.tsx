import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';

import { Image as ExpoImage } from 'expo-image';

import { GradientButton } from '@/components/Gradient';
import { Icon } from '@/components/Icon';
import KakaoMapThumbnail from '@/components/KakaoMapThumbnail';
import KakaoPlaceSearchModal, { KakaoPlace as KakaoPlaceData } from '@/components/KakaoPlaceSearchModal';
import { blurFocusedForModal } from '@/components/RatingModal';
import { api, ApiError } from '@/lib/api';
import { getCurrentCoords } from '@/lib/geolocation';
import { deleteImage, pickAndUploadImage } from '@/lib/imageUpload';
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
  const params = useLocalSearchParams<{ autoCreate?: string; edit?: string }>();
  const [cafes, setCafes] = useState<Cafe[]>([]);
  const [stats, setStats] = useState<Record<number, CafeStats>>({});
  const [q, setQ] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [mode, setMode] = useState<Mode>('create');
  const [editId, setEditId] = useState<number | null>(null);
  const [autoTriggered, setAutoTriggered] = useState(false);
  const [onboardingMode, setOnboardingMode] = useState(false);

  const [cafeType, setCafeType] = useState<CafeType | null>(null);
  const [brand, setBrand] = useState<Brand | null>(null);
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [openHours, setOpenHours] = useState('');
  const [seatCount, setSeatCount] = useState('');
  const [phone, setPhone] = useState('');
  const [description, setDescription] = useState('');
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

  // autoCreate=1 쿼리 — OnboardingSteps 1단계에서 진입한 경우 모달 자동 오픈
  useEffect(() => {
    if (params.autoCreate === '1' && !autoTriggered) {
      setAutoTriggered(true);
      setOnboardingMode(true);
      openCreate();
    }
  }, [params.autoCreate, autoTriggered]);

  // edit={cafeId} 쿼리 — cafe 상세에서 "매장 정보 수정" 진입 시 해당 매장 편집 모달 자동 오픈
  useEffect(() => {
    if (params.edit && !autoTriggered && cafes.length > 0) {
      const target = cafes.find((c) => c.id === Number(params.edit));
      if (target) {
        setAutoTriggered(true);
        openEdit(target);
      }
    }
  }, [params.edit, autoTriggered, cafes]);

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
    setOpenHours('');
    setSeatCount('');
    setPhone('');
    setDescription('');
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
    setOpenHours(cafe.openHours ?? '');
    setSeatCount(cafe.seatCount != null ? String(cafe.seatCount) : '');
    setPhone(cafe.phone ?? '');
    setDescription(cafe.description ?? '');
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
      const seatNum = seatCount.trim() === '' ? null : Number(seatCount);
      if (seatNum != null && (Number.isNaN(seatNum) || seatNum < 0)) {
        notify('좌석 수는 0 이상의 숫자여야 합니다');
        setBusy(false);
        return;
      }
      const payload = {
        name: name.trim(),
        address: address.trim(),
        cafeType,
        brandKey: isFranchise ? brand!.key : null,
        latitude,
        longitude,
        openHours: openHours.trim() || null,
        seatCount: seatNum,
        phone: phone.trim() || null,
        description: description.trim() || null,
      };
      if (mode === 'edit' && editId != null) {
        await api(`/api/owner/cafes/${editId}`, { method: 'PUT', body: payload });
        notify('매장 정보 수정 완료');
      } else {
        await api('/api/owner/cafes', { method: 'POST', body: payload });
        notify('매장 등록 완료');
      }
      setModalOpen(false);
      // 온보딩 흐름 — 매장 첫 등록 후 자동으로 시프트 화면(2단계)으로 복귀
      if (onboardingMode && mode === 'create') {
        setOnboardingMode(false);
        router.replace('/owner/shifts');
        return;
      }
      await load();
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const [busyImageCafeId, setBusyImageCafeId] = useState<number | null>(null);
  async function handleUploadCafeImage(cafe: Cafe) {
    setBusyImageCafeId(cafe.id);
    try {
      const url = await pickAndUploadImage(`/api/owner/cafes/${cafe.id}/image`);
      // 로컬 cafes 갱신
      setCafes((prev) => prev.map((c) => c.id === cafe.id ? { ...c, imageUrl: url } : c));
    } catch (e) {
      const msg = (e as Error).message;
      if (msg !== 'cancelled') notify(msg);
    } finally {
      setBusyImageCafeId(null);
    }
  }
  async function handleDeleteCafeImage(cafe: Cafe) {
    setBusyImageCafeId(cafe.id);
    try {
      await deleteImage(`/api/owner/cafes/${cafe.id}/image`);
      setCafes((prev) => prev.map((c) => c.id === cafe.id ? { ...c, imageUrl: null } : c));
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setBusyImageCafeId(null);
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
            <Text style={[styles.bodyMuted, { marginBottom: 16 }]}>등록된 매장이 없어요</Text>
            <View style={{ minWidth: 200 }}>
              <GradientButton
                onPress={openCreate}
                label="첫 매장 등록"
                size="md"
              />
            </View>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]}
            onPress={() => router.push(`/cafe/${item.id}` as never)}
          >
            {/* 매장 사진 (있을 때만) */}
            {item.imageUrl ? (
              <ExpoImage
                source={{ uri: item.imageUrl }}
                style={{
                  width: '100%',
                  height: 120,
                  borderRadius: radius.md,
                  marginBottom: 12,
                  backgroundColor: colors.surfaceMuted,
                }}
                contentFit="cover"
              />
            ) : null}

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
                  { flex: 1, flexDirection: 'row', gap: 6 },
                  busyImageCafeId === item.id && { opacity: 0.6 },
                ]}
                onPress={() => item.imageUrl ? handleDeleteCafeImage(item) : handleUploadCafeImage(item)}
                disabled={busyImageCafeId === item.id}
              >
                <Text style={{ fontSize: 14 }}>{item.imageUrl ? '🗑️' : '📸'}</Text>
                <Text style={styles.buttonSecondaryText}>
                  {busyImageCafeId === item.id ? '...' : item.imageUrl ? '사진 삭제' : '사진 추가'}
                </Text>
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
              openHours={openHours}
              setOpenHours={setOpenHours}
              seatCount={seatCount}
              setSeatCount={setSeatCount}
              phone={phone}
              setPhone={setPhone}
              description={description}
              setDescription={setDescription}
              busy={busy}
              onCancel={() => {
                setModalOpen(false);
                setOnboardingMode(false);
              }}
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
  openHours,
  setOpenHours,
  seatCount,
  setSeatCount,
  phone,
  setPhone,
  description,
  setDescription,
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
  openHours: string;
  setOpenHours: (s: string) => void;
  seatCount: string;
  setSeatCount: (s: string) => void;
  phone: string;
  setPhone: (s: string) => void;
  description: string;
  setDescription: (s: string) => void;
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
  const [kakaoOpen, setKakaoOpen] = useState(false);

  function handleKakaoSelect(p: KakaoPlaceData) {
    if (p.placeName) setName(p.placeName);
    const addr = p.roadAddressName ?? p.addressName;
    if (addr) setAddress(addr);
    if (p.latitude != null) setLatitude(p.latitude);
    if (p.longitude != null) setLongitude(p.longitude);
    if (p.phone) setPhone(p.phone);
  }

  return (
    <ScrollView showsVerticalScrollIndicator={false}>
      <Text style={[styles.h2, { marginBottom: 4 }]}>
        {mode === 'edit' ? '매장 정보 수정' : '매장 등록'}
      </Text>
      <Text style={[styles.subtitle, { marginBottom: 12 }]}>
        매장 종류와 정보를 입력해주세요
      </Text>

      {/* Kakao 매장 검색 — 이름·주소·좌표·전화 한 번에 자동 입력 */}
      {mode === 'create' ? (
        <Pressable
          onPress={() => {
            blurFocusedForModal();
            setKakaoOpen(true);
          }}
          style={({ pressed }) => [
            {
              flexDirection: 'row',
              alignItems: 'center',
              gap: 10,
              padding: 12,
              borderRadius: radius.md,
              borderWidth: 1.5,
              borderStyle: 'dashed',
              borderColor: colors.primary,
              backgroundColor: colors.primarySoft,
              marginBottom: 16,
            },
            pressed && { opacity: 0.85 },
          ]}
        >
          <Text style={{ fontSize: 22 }}>🔍</Text>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 13, fontWeight: '800', color: colors.primaryDark }}>
              카카오 지도에서 매장 찾기
            </Text>
            <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 2 }}>
              매장명·주소·좌표·전화번호 한 번에 자동 입력
            </Text>
          </View>
          <Icon name="chevron-forward" size={18} color={colors.primary} />
        </Pressable>
      ) : null}

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
          <View style={{ gap: 10 }}>
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
            <KakaoMapThumbnail
              latitude={latitude}
              longitude={longitude}
              placeName={name || '내 매장'}
              address={address}
              height={180}
              showGateRadius
              interactive
              onCoordsChange={(lat, lng) => {
                setLatitude(lat);
                setLongitude(lng);
              }}
            />
            {Platform.OS === 'web' ? (
              <Text style={{ fontSize: 10, color: colors.textMuted, textAlign: 'center' }}>
                지도에서 마커를 드래그하거나 빈 곳을 탭해 위치를 미세조정하세요
              </Text>
            ) : null}
            {/* 위치 변경 액션 — Web/Native 공통 */}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              <Pressable
                onPress={() => setKakaoOpen(true)}
                style={({ pressed }) => [
                  {
                    flexGrow: 1,
                    flexBasis: '30%',
                    paddingVertical: 8,
                    paddingHorizontal: 10,
                    borderRadius: radius.md,
                    backgroundColor: colors.surface,
                    borderWidth: 1,
                    borderColor: colors.border,
                    alignItems: 'center',
                    flexDirection: 'row',
                    justifyContent: 'center',
                    gap: 4,
                  },
                  pressed && { opacity: 0.7 },
                ]}
              >
                <Text style={{ fontSize: 13 }}>🔍</Text>
                <Text style={{ fontSize: 11, fontWeight: '700', color: colors.text }}>검색으로 변경</Text>
              </Pressable>
              <Pressable
                onPress={fillCurrentLocation}
                disabled={busyLoc}
                style={({ pressed }) => [
                  {
                    flexGrow: 1,
                    flexBasis: '30%',
                    paddingVertical: 8,
                    paddingHorizontal: 10,
                    borderRadius: radius.md,
                    backgroundColor: colors.surface,
                    borderWidth: 1,
                    borderColor: colors.border,
                    alignItems: 'center',
                    flexDirection: 'row',
                    justifyContent: 'center',
                    gap: 4,
                    opacity: busyLoc ? 0.6 : 1,
                  },
                  pressed && { opacity: 0.7 },
                ]}
              >
                <Text style={{ fontSize: 13 }}>📍</Text>
                <Text style={{ fontSize: 11, fontWeight: '700', color: colors.text }}>
                  {busyLoc ? '...' : '현재 위치'}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => Linking.openURL(`https://map.kakao.com/link/map/${encodeURIComponent(name || '매장')},${latitude},${longitude}`)}
                style={({ pressed }) => [
                  {
                    flexGrow: 1,
                    flexBasis: '30%',
                    paddingVertical: 8,
                    paddingHorizontal: 10,
                    borderRadius: radius.md,
                    backgroundColor: colors.surface,
                    borderWidth: 1,
                    borderColor: colors.border,
                    alignItems: 'center',
                    flexDirection: 'row',
                    justifyContent: 'center',
                    gap: 4,
                  },
                  pressed && { opacity: 0.7 },
                ]}
              >
                <Text style={{ fontSize: 13 }}>🗺</Text>
                <Text style={{ fontSize: 11, fontWeight: '700', color: colors.text }}>카카오맵 확인</Text>
              </Pressable>
            </View>
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

      {/* 추가 정보 — 워커가 매장 카드에서 보는 정보 */}
      <Text style={[styles.subtitle, { marginBottom: 4, fontWeight: '700', marginTop: 4 }]}>
        매장 추가 정보 (선택)
      </Text>
      <Text style={{ fontSize: 11, color: colors.textMuted, marginBottom: 10 }}>
        워커가 매장 상세 페이지에서 보게 될 정보입니다. 비워두면 노출되지 않습니다.
      </Text>

      <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textMuted, marginBottom: 4 }}>
        🕒 영업시간
      </Text>
      <TextInput
        style={styles.input}
        value={openHours}
        onChangeText={setOpenHours}
        placeholder="예: 07:00-22:00 / 평일 08-21 주말 09-22"
        placeholderTextColor={colors.textLight}
      />

      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textMuted, marginBottom: 4 }}>
            🪑 좌석 수
          </Text>
          <TextInput
            style={styles.input}
            value={seatCount}
            onChangeText={setSeatCount}
            keyboardType="number-pad"
            placeholder="예: 24"
            placeholderTextColor={colors.textLight}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textMuted, marginBottom: 4 }}>
            ☎️ 매장 전화
          </Text>
          <TextInput
            style={styles.input}
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            placeholder="예: 02-1234-5678"
            placeholderTextColor={colors.textLight}
          />
        </View>
      </View>

      <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textMuted, marginBottom: 4 }}>
        📝 매장 소개 (워커에게 어필 — 손님유형/POS/식사휴게/유의사항 등)
      </Text>
      <TextInput
        style={[styles.input, { minHeight: 80, textAlignVertical: 'top' }]}
        value={description}
        onChangeText={setDescription}
        placeholder="예: 회전형 매장, POS는 OKPOS, 식사 30분 제공. 라떼아트 가능자 환영"
        placeholderTextColor={colors.textLight}
        multiline
      />

      <View style={{ flexDirection: 'row', gap: 8, marginTop: 16 }}>
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

      {/* 카카오 매장 검색 모달 */}
      <KakaoPlaceSearchModal
        visible={kakaoOpen}
        onClose={() => setKakaoOpen(false)}
        onSelect={handleKakaoSelect}
        initialQuery={name}
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
