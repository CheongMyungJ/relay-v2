## t-01 intake — 2026-10-04 15:52 (사람 승인)
- [AI] 부가세 기준을 팀 지식의 줄별 버림 규칙으로 삼는다 — 팀 지식 vat-per-line-floor.md가 규칙으로 덮는다. 사람에게 다시 묻지 않는다

## t-02 fix — 2026-10-04 15:53 (자동 승인)
- [AI] `lineVat`을 `src/invoice/total.js`에 새로 만들고 `creditTotals`만 쓰게 했다. `computeTotals`는 그대로 둔다 — 팀 지식 docs/knowledge/invoice/vat-per-line-floor.md는 lineVat 한 곳을 쓰라고 한다. 이 브랜치에는 lineVat이 없고, 의도의 비목표가 computeTotals 변경을 막는다
- [AI] 저장된 반품 전표는 재계산하지 않는다 — docs/knowledge/invoice/issued-invoice-stored-totals.md. creditNoteTotals가 저장값을 쓰므로 새로 만드는 전표에만 적용된다

## t-03 verify — 2026-10-04 15:54 (사람 승인)
- [사람] 리뷰 지적 1(사소, CN-0112 테스트가 합계를 19,180원으로 직접 단언)을 모두 반영 — 사람이 '모두 반영'을 골랐다
