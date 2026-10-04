## t-01 intake — 2026-10-03 12:29 (사람 승인)
- [AI] 환불 금액의 기준은 팀 지식의 회계 규칙(줄별 할인 후 부가세 원 단위 버림 합산)으로 한다 — 요청에 회계팀 기대값이 없고, 팀 지식이 반품 전표에도 적용된다고 명시함

## t-02 fix — 2026-10-03 12:29 (자동 승인)
- [AI] 부가세는 과세 줄마다 net에 원 단위 버림으로 계산해 합산한다 — 팀 지식 docs/knowledge/vat-floor-per-line.md, discount-before-vat.md
- [AI] creditNoteTotals는 이미 저장된 totals를 반환하므로 고치지 않았다 — 팀 지식 docs/knowledge/issued-invoice-keeps-stored-totals.md, 코드가 이미 규칙대로임

## t-03 verify — 2026-10-03 12:31 (사람 승인)
- [사람] 리뷰 지적 1(면세 혼합 테스트 추가, 사소)을 반영하지 않는다 — 사람이 '반영하지 않음'을 선택
