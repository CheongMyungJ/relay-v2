## t-01 intake — 2026-10-04 16:00 (사람 승인)
- [AI] 팀 지식의 부가세 규정(줄마다 버림)을 제약으로 옮기고 사람에게 다시 묻지 않음 — 팀 지식 vat-per-line-floor.md는 반품 전표(creditTotals)에도 같은 규정이라고 적혀 있음

## t-02 fix — 2026-10-04 16:01 (자동 승인)
- [AI] 반품 전표 부가세를 줄마다 버림(`lineVat`)으로 계산하고, `lineVat`를 `src/invoice/total.js`에 추가 — docs/knowledge/invoice/vat-per-line-floor.md 규칙. 기준 브랜치에 lineVat이 없어 새로 추가
- [AI] 청구서 `computeTotals`는 고치지 않음 — intent 비목표

## t-03 verify — 2026-10-04 16:03 (사람 승인)
- [사람] 리뷰 지적 1번(사소, 보조 테스트가 수정 전에도 통과)을 반영하지 않음 — 사람이 반영하지 않음을 선택. 저장 금액 유지 완료조건의 보호 장치로 의미가 있음
