## t-01 intake — 2026-10-04 04:49 (사람 승인)
- [AI] 반품 전표 부가세는 팀 지식의 줄별 버림 규칙을 따르는 것으로 목표를 잡았다 — 팀 지식(사람이 정한 규칙)이 반품 전표(creditTotals)에도 같은 규칙을 쓰라고 명시함

## t-02 fix — 2026-10-04 04:50 (자동 승인)
- [AI] `lineVat`을 `src/invoice/total.js`에 새로 추가하고 반품 전표만 사용하게 했다 — docs/knowledge/accounting/vat-per-line-floor.md: 규칙은 lineVat 한 곳에 둔다. 청구서 쪽 계산은 비목표라 바꾸지 않았다

## t-03 verify — 2026-10-04 04:52 (사람 승인)
- [사람] 리뷰 지적 1(사소, 테스트의 동적 import)을 반영하지 않음 — 동작에 영향 없는 스타일 문제
