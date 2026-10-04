## t-01 intake — 2026-10-04 12:06 (사람 승인)
- [AI] 반품 전표도 청구서와 같은 줄별 버림 부가세 규칙을 목표로 삼는다 — 팀 지식 vat-per-line-floor.md의 규칙이 반품 전표를 명시적으로 덮는다

## t-02 fix — 2026-10-04 12:07 (자동 승인)
- [AI] `floorPercentOf`를 추가하지 않고 `creditTotals`에 `Math.floor` 식을 인라인으로 썼다 — 도우미는 앞 Work(w-20261004-001)에서 만들어 머지 대기라 이 브랜치에 없고, 따로 만들면 머지 때 충돌할 수 있다 (docs/knowledge/billing/vat-per-line-floor.md)

## t-03 verify — 2026-10-04 12:08 (사람 승인)
- [사람] 리뷰 지적 1(사소, 부가세 식 가독성)은 반영하지 않는다 — 동작·규칙 문제가 아니고 머지 뒤 floorPercentOf로 바꿀 때 다시 고쳐진다
