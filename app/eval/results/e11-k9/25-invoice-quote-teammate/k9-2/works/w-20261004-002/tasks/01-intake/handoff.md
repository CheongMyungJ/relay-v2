---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "반품 전표 부가세에 팀 규칙(과세 줄별 Math.floor 합)을 적용하는 것을 목표로 한다"
    why: "팀 지식 vat-per-line-floor.md가 반품 전표를 아직 규칙을 따르지 않는 곳으로 적고 있고, 이번 요청이 그 코드를 고치는 일이다"
    by: ai
assumptions:
  - "회계팀 계산이 팀 규칙(줄별 버림)과 같다고 가정한다. 회계팀 공식 기준은 확인되지 않았다"
  - "견적서(quote.js)는 요청에 없어 비목표로 둔다"
  - "반품 줄 할인 계산(returnedDiscount)은 요청에 없어 비목표로 둔다"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "부가세 외에 할인 반올림 등 다른 차이도 있을 수 있다. 회계팀 계산 내역을 보지 못했다"
  - "앞 Work(w-20261004-001)에서 청구서 쪽을 고쳤고 머지 대기라 이 브랜치에는 없다. 줄별 버림 코드를 거기서 재사용했을 수 있어 머지 순서에 따라 충돌할 수 있다"
recommended_next: null
knowledge_candidates: []
---
## 요약
반품 전표 부가세를 과세 줄별 버림 합으로 계산하도록 고치는 의도 초안을 썼다. 팀 지식의 규칙을 제약에 옮겼다.
## 다음 task가 알아야 할 것
- 대상: `src/invoice/credit-note.js`의 `creditTotals`. `vat`가 `Math.round(taxable * VAT_RATE_PERCENT / 100)`로 합계 기준 반올림이다.
- 참고(가설, 확인 안 됨): CN-0112를 손으로 보면 현재 vat 1,744, 합계 19,182. 줄별 버림이면 vat 1,742, 합계 19,180쯤이다. 할인 반올림(`percentOf`)에 따라 달라질 수 있으니 fix에서 확인한다.
- 테스트: `npm test`(`node --test`), 관련 파일 `test/credit-note.test.js`, `test/format.test.js`.
- 참고 지식: `docs/knowledge/invoice/vat-per-line-floor.md`(기준 브랜치에는 아직 없음, 앞 Work 머지 대기).
