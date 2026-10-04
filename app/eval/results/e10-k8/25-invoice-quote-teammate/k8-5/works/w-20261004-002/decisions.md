## t-01 intake — 2026-10-04 06:32 (사람 승인)
- [AI] 부가세 규칙은 팀 지식(vat-per-line-floor)을 제약으로 옮기고 사람에게 다시 묻지 않는다 — 사람이 정한 회계팀 규정이고 반품 전표에도 적용된다고 적혀 있다

## t-02 fix — 2026-10-04 06:33 (자동 승인)
- [AI] 부가세는 줄마다 원 단위 버림으로 계산해 합산한다 — 팀 지식 docs/knowledge/billing/vat-per-line-floor.md의 회계팀 규정
- [AI] lineVat/sumLineVat을 total.js가 아니라 credit-note.js에 둔다 — 기준 브랜치 total.js에 없고, 청구서·견적서 수정은 비목표이며 앞 Work와의 충돌을 피한다

## t-03 verify — 2026-10-04 06:36 (사람 승인)
- [사람] 리뷰 지적 1(영세율 반품 전표 테스트 없음, 사소)은 반영하지 않는다 — 사람이 반영하지 않음을 골랐다
