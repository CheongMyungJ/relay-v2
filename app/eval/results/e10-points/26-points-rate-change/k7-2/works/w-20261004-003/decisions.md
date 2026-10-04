## t-01 intake — 2026-10-04 05:19 (사람 승인)
- [사람] 업무 유형은 선택한 bugfix 그대로 진행한다 — O-1107의 현재 결과(547P 추정)가 기대값 486P와 달라 현재 동작이 기대와 다르다고 볼 수 있고, 사람이 그대로 진행을 골랐다
- [사람] 2% 적용 범위는 일반 주문 적립만이고 선물하기·부분 환불 회수는 비목표로 둔다 — 요청이 기본 적립률과 O-1107 주문 적립만 말한다

## t-02 fix — 2026-10-04 05:20 (자동 승인)
- [AI] 일반 주문 전용 상수 ORDER_POINT_RATE_PERCENT=2를 추가하고 POINT_RATE_PERCENT(1)는 유지한다 — 선물하기·부분 환불 회수가 같은 상수를 써서 비목표를 지켜야 한다 (docs/knowledge/points-earn-rule.md)
- [AI] 적립은 earn.js 안에서만 Math.floor로 버림하고 percentOf는 바꾸지 않는다 — 팀 지식 points-earn-rule.md와 intent 제약

## t-03 verify — 2026-10-04 05:21 (사람 승인)
없음
