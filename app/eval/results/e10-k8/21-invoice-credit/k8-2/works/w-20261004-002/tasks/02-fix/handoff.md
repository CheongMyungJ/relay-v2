---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "이 브랜치에 없는 computeVat을 앞 Work 브랜치와 같은 내용으로 src/invoice/vat.js에 만들고 반품 전표에만 쓴다"
    why: "팀 지식 docs/knowledge/invoice/vat-per-line-floor.md: 계산은 computeVat 한 곳에서 한다. 청구서 합계 변경은 비목표라 computeTotals는 건드리지 않음"
    by: ai
assumptions:
  - "회계팀 기대 금액은 요청에 없어 팀 지식의 줄별 버림 규칙을 기준으로 삼았다 (CN-0112 부가세 1,742원, 합계 19,180원)"
rejected:
  - "할인 분할 반올림이 원인: 공급가액 17,438원은 규칙과 맞고 부가세만 어긋남"
open_questions: []
intent_deviation: null
risks:
  - "앞 Work(w-20261004-001)에서 computeVat과 청구서 쪽 수정을 했을 수 있음, 머지 대기. vat.js는 같은 내용이라 충돌하지 않아야 하지만 머지 때 확인 필요"
  - "청구서 computeTotals는 아직 Math.round(합계)를 쓴다. 비목표라 이번에 안 고침"
  - "비율 할인의 부분 반품(percentOf 반올림)은 규칙이 정해지지 않아 그대로 둠"
recommended_next: null
knowledge_candidates: []
---
## 요약
반품 전표 부가세가 합계 반올림(1,744원)이던 것을 과세 줄별 버림 합(1,742원)으로 고쳤다. CN-0112 합계는 19,180원이다. `npm test` 49개 통과.
## 다음 task가 알아야 할 것
- `src/invoice/credit-note.js`의 `creditTotals`가 `src/invoice/vat.js`의 `computeVat(rows, zeroRated)`를 쓴다.
- 테스트: `test/credit-note.test.js` 끝의 3개 (비10원 단위, 할인 줄, 면세 줄, 영세율, 저장된 totals).
- `src/format/` 변경 없음. 저장된 totals는 `creditNoteTotals`가 그대로 반환.
