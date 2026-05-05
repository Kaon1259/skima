// 점주측 근로계약서 라우트는 공유 화면을 그대로 재사용 — useAuth() 가 OWNER 감지해서
// 사업주 확인 ack 버튼을 자동 노출. 별도 view-only 페이지 유지하면 ack 동선 누락됨.
export { default } from '@/app/contract/[matchId]';
