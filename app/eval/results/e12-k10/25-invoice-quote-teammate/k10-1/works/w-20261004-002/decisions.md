## t-01 intake — 2026-10-04 12:17 (사람 승인)
- [AI] 부가세 규정은 팀 지식(줄별 원 단위 버림 합산)을 제약으로 옮기고 사람에게 다시 묻지 않음 — 팀 지식 vat-per-line-floor.md가 반품 전표(credit-note.js)를 명시적으로 포함함
- [AI] 청구서·견적 계산은 비목표로 둠 — 요청이 반품 전표 환불 금액만 다룸

## t-02 fix — 2026-10-04 12:18 (자동 승인)
- [AI] `vatOfLines(rows, percent, zeroRated)`를 src/money.js에 새로 만들고 반품 전표만 사용하게 함 — 팀 지식 docs/knowledge/billing/vat-per-line-floor.md 규칙. 이 브랜치에 함수가 없었음. 청구서·견적은 비목표

## t-03 verify — 2026-10-04 12:19 (사람 승인)
- [사람] 리뷰 지적 중 권장 1번(vatOfLines 단위 테스트)만 반영, 사소 2번은 반영하지 않음 — 사람이 '차단·권장만 반영'을 선택
