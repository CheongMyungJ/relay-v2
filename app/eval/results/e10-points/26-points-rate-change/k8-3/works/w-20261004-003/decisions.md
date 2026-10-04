## t-01 intake — 2026-10-04 05:39 (사람 승인)
- [사람] 적립 기준 금액(상품 − 쿠폰 − 사용 포인트, 배송비 제외)과 원 단위 버림을 이번 범위에 포함한다 — O-1107이 486P가 되려면 필요하다. 이 브랜치의 earnPoints는 배송비 포함 결제 금액을 반올림해 규정과 다르다
- [사람] 환불 회수 동작은 그대로 두고, 회수 비율을 1%로 고정하는 데 필요한 refund.js 최소 수정은 허용한다 — 회수에 새 비율을 쓸지는 정산팀과 따로 정한다. 적립률 상수를 바꾸면 refund.js가 따라 바뀌므로 분리가 필요하다

## t-02 fix — 2026-10-04 05:40 (자동 승인)
- [AI] 환불 회수용 상수 POINT_RECOVER_RATE_PERCENT=1을 config에 추가하고 refund.js가 이를 쓰게 했다 — intent 제약: 회수를 1%로 고정하는 refund.js 최소 수정 허용
- [AI] 선물하기 적립은 earnPoints를 호출하게 했다 — 팀 지식 docs/knowledge/points/earn-base-and-rounding.md: 계산은 earnPoints 한 곳

## t-03 verify — 2026-10-04 05:41 (사람 승인)
없음
