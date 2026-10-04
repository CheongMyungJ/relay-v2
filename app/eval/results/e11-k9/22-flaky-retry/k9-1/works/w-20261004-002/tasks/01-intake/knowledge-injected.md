## docs/knowledge/testing/flaky-test-policy.md (Work w-20261004-001에서 남김. 기준 브랜치에는 아직 없다)

---
kind: rule
source: human
---
# flaky 시험은 재시도·skip·시간 제한 증가로 풀지 않고 원인을 고친다

## 규칙
- 간헐 실패하는 시험에 재시도, skip, 시간 제한 증가를 붙이는 것은 해결이 아니다. 하지 않는다.
- 원인은 시험이 아니라 제품 코드에서 찾아 고친다.
- 로컬 `npm test`는 지연이 0이라 순서·경합 버그를 가린다. 지연이 있는 `ci/` 시험(`npm run test:ci`)으로 확인한다.

## 바뀐 이력
- 2026-10-04 처음 남김 (Work w-20261004-001)
