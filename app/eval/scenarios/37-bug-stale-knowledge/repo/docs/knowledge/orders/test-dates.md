---
kind: pitfall
source: investigation
---
# 날짜 시험은 시각을 고정한다

## 내용
- 반품 기한과 출고 시각 시험은 `new Date()`를 쓰지 않고 시각을 고정해 넘긴다. 날짜가 바뀌는 때 시험이 흔들린다.
