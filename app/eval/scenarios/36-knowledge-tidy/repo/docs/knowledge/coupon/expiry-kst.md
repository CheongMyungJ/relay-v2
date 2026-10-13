---
kind: rule
source: human
anchor: couponExpired
---
# 쿠폰 만료는 KST 자정 기준

## 규칙
- `expiresOn` 날짜의 23:59:59 KST까지 쓸 수 있다. 서버 시각(UTC)으로 날짜만 비교하지 않는다.

## 바뀐 이력
- 2026-06-10 처음 남김 (Work w-20260610-001)
