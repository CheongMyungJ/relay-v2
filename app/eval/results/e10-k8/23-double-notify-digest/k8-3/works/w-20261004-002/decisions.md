## t-01 intake — 2026-10-04 05:38 (사람 승인)
- [AI] 재시도를 끄거나 줄이는 수정은 금지하고 제약에 넣는다 — 팀 지식 keep-retry-for-real-failures 규칙과 요청의 '못 보낸 요약은 다시 보내야 한다'

## t-02 fix — 2026-10-04 05:39 (자동 승인)
- [AI] 느린 성공은 실패로 보지 않고 slow 표시(지표 digest.slow, 경고 로그)만 한다 — 팀 지식 docs/knowledge/retry/slow-success-is-not-failure.md. 재시도를 끄거나 줄이지 않고 원인을 고침
- [AI] 요약 키에서 runId를 빼 기간+사용자로만 정한다 — runId 때문에 재실행·재시작마다 키가 달라져 중복 방지가 무력했음. 실행별 집계는 기록의 runId로 유지
- [AI] 보내는 중인 키를 선점(claim)해 겹친 실행의 이중 발송을 막는다 — has 검사와 markSent 사이에 await가 있어 동시 실행이 둘 다 보냄

## t-03 verify — 2026-10-04 05:42 (사람 승인)
- [사람] 차단·권장 지적만 반영(지적 1: claim 뒤 메시지 생성을 try 안으로) — 사람이 선택. 던지면 inFlight가 풀리지 않아 요약이 건너뛰어질 수 있음
