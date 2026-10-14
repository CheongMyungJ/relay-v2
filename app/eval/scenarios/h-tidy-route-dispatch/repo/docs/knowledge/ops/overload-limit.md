---
kind: pitfall
source: human
anchor: loadFactor
---
# 부하가 1 이상인 기사에게는 새 주문을 주지 않는다

## 내용
- `loadFactor`가 1 이상인 기사는 `assignOrders`에서 후보에서 뺀다. 이 기사에게 더 주면 정거장이 `MAX_STOPS`를 넘어간다.
- 부하는 정거장 칸 수를 12로 나눈 값이고 냉장 주문은 2칸으로 센다. 후보가 모두 1 이상이면 주문은 `unassigned`에 남고, 억지로 배정하지 않는다.

## 바뀐 이력
- 2026-06-25 처음 남김 (Work w-20260625-001)
