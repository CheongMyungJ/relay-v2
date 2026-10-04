## t-01 intake — 2026-10-04 09:04 (사람 승인)
- [AI] 견적서 부가세를 팀 지식의 줄별 버림 규칙으로 맞추는 것을 기대 동작으로 한다 — 팀 지식 vat-per-line-floor.md가 규칙이고, 견적서는 아직 따르지 않는 곳으로 적혀 있으며 이번 요청이 그 코드를 고치는 일이다

## t-02 fix — 2026-10-04 09:04 (자동 승인)
- [AI] 견적서 부가세를 할인 후 공급가액 줄마다 Math.floor로 계산해 합산한다 — 팀 지식 docs/knowledge/invoice/vat-per-line-floor.md 규칙. 청구서 computeTotals와 같은 식

## t-03 verify — 2026-10-04 09:06 (사람 승인)
- [사람] 리뷰 지적 1(quoteTotals와 computeTotals 식 중복, 사소)을 반영하지 않는다 — 합치려면 청구서 코드를 바꿔야 해 비목표와 충돌한다
