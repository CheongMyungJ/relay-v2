---
kind: pitfall
source: agent
---
# 만료 시험은 시각을 넘겨 준다

## 내용
- `couponExpired`는 `now`를 인자로 받는다. 시험에서 `new Date()`를 그대로 쓰면 날짜가 바뀌는 때 시험이 흔들린다. 시각은 늘 고정해 넘긴다.
