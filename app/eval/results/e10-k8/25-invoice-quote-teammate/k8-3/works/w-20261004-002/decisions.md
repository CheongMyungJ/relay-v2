## t-01 intake — 2026-10-04 05:48 (사람 승인)
- [AI] 반품 전표의 부가세도 팀 지식의 줄별 원 단위 버림 규칙을 따르는 것을 기대 동작으로 삼는다 — 팀 지식 vat-per-line-floor.md가 반품 전표(creditTotals)도 같은 규칙이라고 적고 있어 사람에게 다시 묻지 않음

## t-02 fix — 2026-10-04 05:51 (자동 승인)
- [AI] 이 브랜치에 `lineVat`가 없어 `creditTotals` 안에서 줄별 `Math.floor(net*10/100)`를 직접 계산했다 — 팀 지식 docs/knowledge/billing/vat-per-line-floor.md의 규칙을 따름. `lineVat`는 앞 Work(w-20261004-001) 머지 대기라 total.js를 건드리면 충돌할 수 있음

## t-03 verify — 2026-10-04 05:52 (사람 승인)
- [사람] 리뷰 지적 1(사소, lineVat 미사용)을 반영하지 않음 — 앞 Work 머지 대기라 total.js와 충돌 위험. 머지 뒤 교체
