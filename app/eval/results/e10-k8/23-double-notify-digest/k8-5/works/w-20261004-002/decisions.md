## t-01 intake — 2026-10-04 06:24 (사람 승인)
- [사람] 재시도는 유지하고 중복 방지는 성공 발송을 다시 보내지 않는 쪽으로 푼다 — 팀 지식 keep-retry-for-real-failures 규칙과 요청의 '실제로 못 보낸 요약은 다시 보내야 한다'

## t-02 fix — 2026-10-04 06:26 (자동 승인)
- [AI] 느린 성공은 성공으로 두고 digest.slow 지표로만 남긴다 — 팀 지식 docs/knowledge/retry/success-is-never-timeout.md. 코드에서 같은 원인을 확인함
- [AI] 재시도 횟수·정책은 건드리지 않았다 — 팀 지식 docs/knowledge/retry/keep-retry-for-real-failures.md
- [AI] 발송 키에서 runId를 빼고 claim/release로 동시 실행도 막는다 — 같은 날짜 요약은 실행과 관계없이 한 번만 가야 한다는 요청

## t-03 verify — 2026-10-04 06:27 (사람 승인)
- [사람] 리뷰 지적 중 차단·권장(1번)만 반영하고 사소(2번)는 반영하지 않음 — 사람이 '차단·권장만 반영'을 고름
