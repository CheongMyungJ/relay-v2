## t-01 intake — 2026-10-03 13:10 (사람 승인)
- [사람] 실패한 요약은 재시도, 하루 건너뛰기 금지를 완료조건과 제약에 넣는다 — 요청 원문의 명시 조건

## t-02 fix — 2026-10-03 13:11 (자동 승인)
- [AI] 성공한 요약 발송은 경과 시간과 무관하게 성공으로 보고, 요약 키에서 runId를 뺀다 — docs/knowledge/successful-send-is-never-timeout.md 규칙과 intent 원하는 결과(수신자당 하루 한 통, 실패는 재시도)

## t-04 fix — 2026-10-03 13:16 (자동 승인)
- [AI] 요약 키에서 runId를 빼고 기간+사용자로 고정, 요약 메일에 고정 Message-ID 헤더를 붙인다 — 사람 추가 지시(기간+사용자 고정 멱등 키/Message-ID, 재시도 유지)
- [AI] 성공한 발송은 경과 시간과 무관하게 성공으로 처리 — docs/knowledge/successful-send-is-never-timeout.md

## t-05 verify — 2026-10-03 13:18 (사람 승인)
- [사람] 리뷰 지적 1(Message-ID 인코딩 충돌)만 반영하고 2(주석 배치)는 반영하지 않는다 — 사람이 1번만 고름
