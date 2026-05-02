export type CafeType = 'FRANCHISE_CAFE' | 'INDIVIDUAL_CAFE' | 'FRANCHISE_BAKERY' | 'INDIVIDUAL_BAKERY';

export const CAFE_TYPE_LABEL: Record<CafeType, string> = {
  FRANCHISE_CAFE: '프렌차이즈 카페',
  INDIVIDUAL_CAFE: '개인 카페',
  FRANCHISE_BAKERY: '프렌차이즈 베이커리',
  INDIVIDUAL_BAKERY: '개인 베이커리',
};

export type Brand = {
  key: string;
  name: string;
  type: CafeType;
  letter: string;
  color: string;
  tagline: string;
};

export type Cafe = {
  id: number;
  name: string;
  address: string;
  cafeType: CafeType;
  brandKey?: string | null;
  brandLetter?: string | null;
  brandColor?: string | null;
  brandName?: string | null;
};

export type Shift = {
  id: number;
  cafeId: number;
  cafeName: string;
  cafeAddress: string;
  startAt: string;
  endAt: string;
  hourlyWage: number;
  headcount: number;
  status: 'OPEN' | 'MATCHED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELED';
  description?: string;
  createdAt: string;
  matchedAt?: string | null;
  matchingMinutes?: number | null;
  jobRole?: JobRole | null;
  minSkill?: SkillLevel | null;
  requirements?: string[];
};

export type WorkerShift = Omit<Shift, 'matchedAt' | 'matchingMinutes'> & {
  myApplicationStatus: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'WITHDRAWN' | null;
  cafeType?: CafeType;
  brandKey?: string | null;
  brandLetter?: string | null;
  brandColor?: string | null;
  brandName?: string | null;
  cafeAvgRating?: number | null;
  cafeRatingsCount?: number | null;
  cafeNoShowRate?: number | null;
};

export type WorkerStats = {
  workerId: number;
  workerName: string;
  totalMatches: number;
  completedMatches: number;
  noShowCount: number;
  totalWorkedMinutes: number;
  totalEarnings: number;
  avgRating: number | null;
  rehireRate: number | null;
  noShowRate: number | null;
  ratingsCount: number;
  scoreDistribution?: number[];
};

export type CafeDetail = {
  id: number;
  name: string;
  address: string;
  cafeType: CafeType;
  brandKey?: string | null;
  brandLetter?: string | null;
  brandColor?: string | null;
  brandName?: string | null;
  ownerName: string;
  avgRating: number | null;
  ratingsCount: number | null;
  noShowRate: number | null;
  totalCompletedShifts: number;
  recentReviews: Rating[];
  openShifts: Shift[];
  ownerView?: CafeOwnerView | null;
};

export type CafeOwnerView = {
  openShifts: number;
  matchedShifts: number;
  completedShifts: number;
  monthGross: number;
  monthFee: number;
  monthWorkerNet: number;
  monthCompletedMatches: number;
  regulars: RegularWorker[];
};

export type RegularWorker = {
  workerId: number;
  workerName: string;
  matchCount: number;
  avgRating: number | null;
};

export type WorkerProfile = {
  id: number;
  name: string;
  stats: WorkerStats;
  scoreDistribution: number[];
  recentReviews: Rating[];
  recentMatches: WorkerMatchSummary[];
};

export type WorkerMatchSummary = {
  matchId: number;
  shiftId: number;
  cafeId: number;
  cafeName: string;
  workDate: string;
  status: 'MATCHED' | 'CHECKED_IN' | 'CHECKED_OUT' | 'NO_SHOW' | 'CANCELED';
};

export type ContractData = {
  matchId: number;
  employerName: string;
  employerPhone: string;
  employerCafeName: string;
  employerCafeAddress: string;
  workerName: string;
  workerPhone: string;
  workerBankAccount: string;
  workStartAt: string;
  workEndAt: string;
  workplaceAddress: string;
  jobDescription: string;
  hourlyWage: number;
  workMinutes: number;
  grossAmount: number;
  withholdingTax: number;
  netAmount: number;
  classification: string;
  taxClause: string;
  issuedAt: string;
};

export type WithholdingReceipt = {
  matchId: number;
  employerName: string;
  employerCafeName: string;
  workerName: string;
  workerPhone: string;
  workDate: string;
  grossAmount: number;
  taxableAmount: number;
  withholdingTax: number;
  localIncomeTax: number;
  netAmount: number;
  taxClause: string;
  issuedAt: string;
};

export type MonthlyStatementRow = {
  matchId: number;
  shiftId?: number;
  cafeId?: number;
  workerId?: number;
  workerName: string;
  cafeName: string;
  workDate: string;
  gross: number;
  withholding: number;
  net: number;
};

export type MonthlyStatement = {
  month: string;
  employerName: string;
  totalMatches: number;
  totalGross: number;
  totalWithholding: number;
  totalNet: number;
  totalPlatformFee: number;
  rows: MonthlyStatementRow[];
};

export type OwnerShift = Shift & {
  minutesUntilStart: number | null;
  applicationsCount: number;
  pendingApplicationsCount: number;
  matchId?: number | null;
  matchedWorkerName?: string | null;
  matchStatus?: 'MATCHED' | 'CHECKED_IN' | 'CHECKED_OUT' | 'NO_SHOW' | 'CANCELED' | null;
  ratingScore?: number | null;
  willRehire?: boolean | null;
  workerRatedOwner?: boolean | null;
  payoutStatus?: 'REQUESTED' | 'SCHEDULED' | 'COMPLETED' | 'FAILED' | null;
  payoutApprovedAt?: string | null;
  payoutAutoApproved?: boolean | null;
  payoutCompletedAt?: string | null;
};

export type RatingDirection = 'OWNER_TO_WORKER' | 'WORKER_TO_OWNER';

export type Rating = {
  id: number;
  matchId: number;
  direction: RatingDirection;
  workerId: number;
  workerName: string;
  ownerId: number;
  ownerName: string;
  cafeId: number;
  cafeName: string;
  score: number;
  willRehire: boolean;
  comment?: string | null;
  createdAt: string;
};

export type OwnerDashboard = {
  totalShifts: number;
  openShifts: number;
  matchedShifts: number;
  inProgressShifts: number;
  completedShifts: number;
  pendingApplications: number;
  avgMatchingMinutes: number | null;
  matchingSlaRate: number | null;
};

export type NotificationItem = {
  type:
    | 'NEW_APPLICATION'
    | 'NEEDS_RATING'
    | 'WORKER_RATING'
    | 'NEW_MATCH'
    | 'NO_SHOW'
    | 'APPLICATION_REJECTED'
    | 'APPLICATION_AUTO_WITHDRAWN'
    | 'OWNER_RATING'
    | 'PAYOUT_COMPLETED'
    | 'PAYOUT_REQUESTED'
    | 'NOSHOW_REPORTED'
    | 'SHIFT_CANCELED';
  title: string;
  subtitle: string;
  route: string;
  targetId: number | null;
  at: string;
  severity: 'info' | 'warn' | 'success';
  unread: boolean;
};

export type CafeStats = {
  cafeId: number;
  cafeName: string;
  brandKey?: string | null;
  brandLetter?: string | null;
  brandColor?: string | null;
  totalShifts: number;
  openShifts: number;
  matchedShifts: number;
  completedShifts: number;
  monthGross: number;
  monthFee: number;
  monthWorkerNet: number;
  avgRating?: number | null;
  ratingsCount?: number | null;
  noShowRate?: number | null;
  prevMonthGross?: number;
  prevMonthCompletedMatches?: number;
  monthCompletedMatches?: number;
};

export type ShiftApplication = {
  id: number;
  shiftId: number;
  workerId: number;
  workerName: string;
  appliedAt: string;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'WITHDRAWN';
};

export type ShiftMatch = {
  id: number;
  shiftId: number;
  workerId: number;
  workerName: string;
  cafeId?: number | null;
  cafeName?: string | null;
  cafeAddress?: string | null;
  shiftStartAt?: string | null;
  shiftEndAt?: string | null;
  hourlyWage?: number | null;
  matchedAt: string;
  checkInAt?: string | null;
  checkOutAt?: string | null;
  status: 'MATCHED' | 'CHECKED_IN' | 'CHECKED_OUT' | 'NO_SHOW' | 'CANCELED';
  ownerRatedWorker?: boolean | null;
  workerRatedOwner?: boolean | null;
  payoutStatus?: 'REQUESTED' | 'SCHEDULED' | 'COMPLETED' | 'FAILED' | null;
  payoutApprovedAt?: string | null;
  payoutAutoApproved?: boolean | null;
  payoutCompletedAt?: string | null;
};

export type JobRole =
  | 'BARISTA'
  | 'HALL'
  | 'CASHIER'
  | 'BAKER'
  | 'KITCHEN'
  | 'OPENING'
  | 'CLOSING';

export const JOB_ROLE_LABEL: Record<JobRole, { label: string; emoji: string; desc: string }> = {
  BARISTA: { label: '바리스타', emoji: '☕', desc: '음료 제조·라떼아트' },
  HALL: { label: '홀/서빙', emoji: '🍽️', desc: '주문·서빙·청소' },
  CASHIER: { label: '캐셔', emoji: '💳', desc: 'POS·결제·응대' },
  BAKER: { label: '베이커', emoji: '🥐', desc: '빵·진열·포장' },
  KITCHEN: { label: '주방 보조', emoji: '🧽', desc: '설거지·재료 준비' },
  OPENING: { label: '오픈 전담', emoji: '🌅', desc: '개점·세팅' },
  CLOSING: { label: '마감 전담', emoji: '🌙', desc: '청소·정산·마감' },
};

export type SkillLevel = 'L1_TRAINEE' | 'L2_BASIC' | 'L3_SKILLED' | 'L4_EXPERT';

export const SKILL_LEVEL_LABEL: Record<SkillLevel, { label: string; short: string; desc: string }> = {
  L1_TRAINEE: { label: '신입 OK', short: 'L1', desc: '교육 필요, 기본 응대만' },
  L2_BASIC: { label: '기본', short: 'L2', desc: 'POS·기본 음료·홀' },
  L3_SKILLED: { label: '숙련', short: 'L3', desc: '라떼아트·단독 운영' },
  L4_EXPERT: { label: '매니저급', short: 'L4', desc: '단독 마감·재고·교육' },
};

export const SKILL_LEVEL_ORDER: Record<SkillLevel, number> = {
  L1_TRAINEE: 1,
  L2_BASIC: 2,
  L3_SKILLED: 3,
  L4_EXPERT: 4,
};

export const REQUIREMENT_LABEL: Record<string, { label: string; emoji: string }> = {
  HEALTH_CERT: { label: '보건증', emoji: '🏥' },
  NIGHT_OK: { label: '야간 가능 (22시+)', emoji: '🌃' },
  SOLO_CLOSING: { label: '단독 마감', emoji: '🔐' },
  POS_EXPERIENCED: { label: 'POS 경험 1년+', emoji: '💻' },
  LATTE_ART: { label: '라떼아트', emoji: '🎨' },
  ENGLISH_OK: { label: '영어 응대', emoji: '🌐' },
  EARLY_MORNING: { label: '새벽 가능 (6시 전)', emoji: '🌅' },
};

export const REQUIREMENT_KEYS: string[] = Object.keys(REQUIREMENT_LABEL);

export type MyProfile = {
  id: number;
  username: string;
  name: string;
  role: 'WORKER' | 'OWNER' | 'ADMIN';
  selfReportedLevel?: SkillLevel | null;
  capableRoles?: JobRole[];
  certifications?: string[];
};

export type WorkerPoolEntry = {
  workerId: number;
  workerName: string;
  profileImage?: string | null;
  totalMatches: number;
  completedMatches: number;
  noShowCount: number;
  avgRatingByOwner?: number | null;
  ratingsCountByOwner?: number | null;
  rehireRateByOwner?: number | null;
  lastMatchAt?: string | null;
  lastCafeName?: string | null;
  lastCafeId?: number | null;
};

export type Payout = {
  id: number;
  matchId: number;
  workerId: number;
  cafeId?: number | null;
  cafeName?: string | null;
  workDate?: string | null;
  grossAmount: number;
  withholdingTax: number;
  platformFee: number;
  netAmount: number;
  triggerAt: string;
  approvedAt?: string | null;
  autoApproved?: boolean;
  completedAt?: string | null;
  status: 'REQUESTED' | 'SCHEDULED' | 'COMPLETED' | 'FAILED';
  elapsedMinutes?: number | null;
};

export type Kpi = {
  since: string;
  totalMatchedShifts: number;
  matchedWithinSla: number;
  matchingSlaRate: number;
  matchingSlaMinutes: number;
  totalCompletedPayouts: number;
  payoutsWithinSla: number;
  payoutSlaRate: number;
  payoutSlaMinutes: number;
  avgWorkerRating: number | null;
  rehireRate: number | null;
  noShowRate: number | null;
  totalRatings: number;
  totalNoShows: number;
};

export function fmtKRW(n: number): string {
  return n.toLocaleString('ko-KR') + '원';
}

export function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  const M = String(d.getMonth() + 1).padStart(2, '0');
  const D = String(d.getDate()).padStart(2, '0');
  const H = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${M}/${D} ${H}:${m}`;
}

export function fmtPercent(rate: number): string {
  return (rate * 100).toFixed(1) + '%';
}

export function fmtRelativeMinutes(minutes: number | null | undefined): string {
  if (minutes == null) return '';
  const m = Math.round(minutes);
  if (m <= 0) return '곧 시작';
  if (m < 60) return `${m}분 후 시작`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  if (h < 24) return rem === 0 ? `${h}시간 후 시작` : `${h}시간 ${rem}분 후 시작`;
  const d = Math.floor(h / 24);
  return `${d}일 후 시작`;
}
