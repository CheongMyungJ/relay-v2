---
kind: rule
source: investigation
anchor: assignOrders
---
# 배정은 priorityOf 순서이고, 부하가 같으면 기사 id가 작은 쪽이다

## 규칙
- `assignOrders`가 주문을 `priorityOf` 순서로 처리하는 것은 바꾸지 않는다.
- 같은 구역에서 부하(`loadFactor`)가 같은 기사가 둘 이상이면 기사 id가 작은 쪽에 준다. 이 규칙이 없으면 같은 입력에서 결과가 실행마다 달라진다.

## 바뀐 이력
- 2026-06-19 처음 남김 (Work w-20260619-003)
