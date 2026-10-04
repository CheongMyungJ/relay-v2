## t-01 intake — 2026-10-04 05:17 (사람 승인)
- [사람] 재시도는 유지하고 중복만 없애는 것을 제약으로 둔다 — 요청(실제로 못 보낸 요약은 다시 보내야 함)과 팀 지식 retry-keeps-real-failures.md

## t-02 fix — 2026-10-04 05:19 (자동 승인)
- [AI] 느린 성공은 성공으로 보고(withDeadline이 오류를 던지지 않음), 발송 키에서 runId를 뺀다 — 팀 지식 docs/knowledge/notify/slow-success-is-success.md와 같은 원인이 이 코드에서도 확인됨. 재시도는 유지(retry-keeps-real-failures.md)

## t-03 verify — 2026-10-04 05:20 (사람 승인)
- [사람] 리뷰 지적 2(느린 성공 후 재실행 테스트)만 반영하고 1(죽은 설정 sendTimeoutMs)은 반영하지 않음 — 사람이 직접 고름. 1은 남은 위험에 기록
