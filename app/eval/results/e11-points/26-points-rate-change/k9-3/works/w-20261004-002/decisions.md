## t-01 intake — 2026-10-04 08:39 (사람 승인)
없음

## t-02 fix — 2026-10-04 08:40 (자동 승인)
- [AI] 회수 포인트 = 환불 전 적립 기준 − 환불 후 적립 기준(각각 버림) — 팀 지식 docs/knowledge/points/earn-base.md: 환불 회수도 같은 적립 기준. 저장된 earned는 재계산하지 않음(stored-earned-not-recalculated.md)
- [AI] 기준 브랜치에 없는 earnFromAmounts를 earn.js에 새로 추가 — earn-base.md의 새 적립·회수 경로는 이 함수를 쓴다는 규칙

## t-03 verify — 2026-10-04 08:42 (사람 승인)
- [사람] 리뷰 지적 1번(테스트 추가)과 2번(저장된 earned에서 남은 적립을 빼도록 수정)을 반영 — 사람이 반영할 지적을 골랐고, 저장된 points.earned는 재계산하지 않는다는 규칙을 말함
- [AI] alreadyRefunded 연속 환불 테스트는 pointsRecovered를 고정하지 않고 refundAmount만 단언 — 이전 회수분이 중복될 수 있어 잘못된 값을 고정하지 않으려 함
