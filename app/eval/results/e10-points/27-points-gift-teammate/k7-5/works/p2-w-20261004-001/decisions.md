## t-01 intake — 2026-10-04 06:39 (사람 승인)
- [사람] 이번 Work에서 src/gift/gift-points.js 수정을 허용한다. 다른 파일은 건드리지 않는다 — 팀 지식은 손대지 말라고 하지만, 사람이 이 일을 gift-points.js 수정으로 맡았다고 명시적으로 허용함
- [사람] 적립 기준은 일반 주문 코드(earn.js)를 따른다. G-0213은 218P — 사람이 적립 규칙을 자세히 모르고, 동료가 고객센터와 맞춘 일반 주문 코드를 기준으로 하라고 함

## t-02 fix — 2026-10-04 06:40 (자동 승인)
- [AI] giftPoints가 earnPoints를 호출해 일반 주문과 계산을 공유한다 — 완료조건: 같은 금액이면 일반 주문과 선물 적립이 같아야 한다. 변경이 gift-points.js 안에 머문다
- [AI] percentOf와 earn.js, refund.js는 건드리지 않는다 — 팀 지식 docs/knowledge/gift-points-hands-off.md, 비목표

## t-03 verify — 2026-10-04 06:41 (사람 승인)
없음
