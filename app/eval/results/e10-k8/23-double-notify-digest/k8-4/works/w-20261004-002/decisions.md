## t-01 intake — 2026-10-04 06:02 (사람 승인)
- [AI] 요청 유형은 bugfix 그대로 두고 질문 없이 초안을 썼다 — 요청이 현재 동작이 틀렸다고 말하므로 유형과 맞다

## t-02 fix — 2026-10-04 06:03 (자동 승인)
- [AI] 요약 키에서 runId를 뺐다 — 재실행마다 키가 달라 중복 발송 (docs/knowledge/retry/digest-key-includes-run-id.md). 실행별 집계는 ledger 항목의 runId로 유지
- [AI] withDeadline은 성공이면 시간과 무관하게 성공으로 돌려준다 — docs/knowledge/retry/success-is-never-resent.md 규칙

## t-03 verify — 2026-10-04 06:05 (사람 승인)
- [사람] 리뷰 지적 1(권장, 동시 실행 중복)만 반영하고 2(사소, TTL 3일)는 반영하지 않음 — 사람이 '차단·권장만 반영'을 고름
