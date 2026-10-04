## t-01 intake — 2026-10-04 04:48 (사람 승인)
- [AI] 부분 환불 회수는 팀 지식의 규칙(환불 전후 적립 차이, 적립 초과 금지)을 제약으로 따른다 — 팀 지식 refund-recovery-follows-earn-rule이 이번 요청(R-0311, 132P)을 그대로 덮음

## t-02 fix — 2026-10-04 04:50 (자동 승인)
- [AI] 회수를 환불 전후 적립 기준 금액의 적립 차이로 계산하고 저장된 적립으로 상한을 둔다 — docs/knowledge/refund-recovery-follows-earn-rule.md
- [AI] earn.js에 earnOn(base)(버림)를 추가하고 earnPoints는 그대로 둔다 — docs/knowledge/points-earn-excludes-shipping-floor.md. 이 브랜치에 earnOn이 없고 주문 적립 변경은 이번 범위 밖이다

## t-03 verify — 2026-10-04 04:51 (사람 승인)
- [사람] 회수를 저장된 적립 − 남은 상품으로 재계산한 적립으로 바꾼다 (이전 환불은 같은 식의 이전 회수를 뺌) — 사람이 정산 기준을 알려 줌: 저장 적립과 재계산값이 다른 주문에서 어긋남
- [AI] 사소 지적 2·3(index export, 이전 회수 이력)은 반영하지 않는다 — 범위 밖이고 영향이 작다
