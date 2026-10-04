## t-01 intake — 2026-10-04 05:28 (사람 승인)
- [사람] 기대 금액은 팀 지식의 줄별 절사 규칙에 맞춘 값(CN-0112 합계 19,180원)으로 한다 — 사람이 회계팀 계산 CN-0112 환불 합계 19,180원이라고 알려 줌
- [사람] 이미 저장된 반품 전표 totals는 고치지 않고 새 계산부터 적용한다 — 사람이 '새 계산부터 적용'을 선택. 저장된 totals 고정 규칙과 같다

## t-02 fix — 2026-10-04 05:29 (자동 승인)
- [AI] 반품 전표 부가세를 줄마다 Math.floor 후 합산으로 바꾸고 청구서(total.js)는 건드리지 않는다 — docs/knowledge/invoice/vat-per-line-floor.md 규칙과 intent 비목표
- [AI] 저장된 totals는 재계산하지 않는다(creditNoteTotals 그대로) — docs/knowledge/invoice/issued-invoice-totals-frozen.md

## t-03 verify — 2026-10-04 05:30 (사람 승인)
- [사람] 리뷰 지적 3건(모두 사소)을 반영하지 않는다 — 사람이 '반영하지 않음'을 골랐다
- [AI] 저장된 totals 고정 규칙에 반품 전표를 더해 같은 경로에서 고친다 — 사람이 t-01에서 저장된 반품 전표 totals는 재계산하지 않는다고 알려 줌
