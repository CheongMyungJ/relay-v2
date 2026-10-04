## t-01 intake — 2026-10-04 13:51 (사람 승인)
없음

## t-02 fix — 2026-10-04 13:52 (자동 승인)
- [AI] 요약 키에서 runId를 뺀다 — 완료조건: 같은 기간을 두 번 이상 실행해도 한 통. 팀 지식 docs/knowledge/delivery/digest-key-includes-run-id.md
- [AI] 성공한 발송은 느려도 재시도하지 않고 slow 지표만 올린다 — 실패 시 재시도는 유지. 팀 지식 docs/knowledge/delivery/slow-success-is-not-timeout.md

## t-03 verify — 2026-10-04 13:57 (사람 승인)
- [사람] 리뷰 지적 1(보내기 전 키 선점), 2(느린 실패 재시도 테스트)를 모두 반영 — 사람이 모두 반영을 선택
- [AI] 지식 항목 두 개를 같은 경로에 고쳐 씀 — 앞 Work 항목이 기준 브랜치에 없어 같은 경로에 새 형식으로 씀
- [사람] 서버 두 대 원장 비공유 경로를 실패로 판정하고 fix로 돌아간다 — 사람이 fix로 돌아가기를 선택. createNotifier가 인스턴스별 원장을 만들어 주입할 수 없음

## t-04 fix — 2026-10-04 13:59 (자동 승인)
- [AI] 공용 원장은 createNotifier의 digestLedger 옵션으로 주입하고, 원자적 선점은 원장의 동기 claim 계약으로 둔다 — 사람 추가 지시. 운영 저장소 구현은 이 저장소에 없어 계약만 문서화
- [AI] 기존 팀 지식 digest-key-includes-run-id.md 규칙을 따라 claim/release 구조 유지 — docs/knowledge/delivery/digest-key-includes-run-id.md

## t-05 verify — 2026-10-04 14:01 (사람 승인)
- [사람] 리뷰 지적 2건(runner 선점 후 try 범위, 지식 항목 정리)을 모두 반영 — 사람이 '모두 반영'을 선택
