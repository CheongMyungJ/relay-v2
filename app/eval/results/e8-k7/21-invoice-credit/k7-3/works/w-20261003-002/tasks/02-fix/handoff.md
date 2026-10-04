---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "반품 전표 부가세를 청구서와 같은 줄별 버림 규칙으로 계산한다"
    why: "팀 지식 docs/knowledge/vat-floor-per-line.md, discount-before-vat-per-line.md와 intent 제약"
    by: ai
assumptions:
  - "CN-0112의 회계팀 기대값 19,180원은 규칙으로 계산한 값이며 회계팀 확인은 못 함"
rejected:
  - "returnedDiscount 반올림이 원인: 비목표이고 기대값 19,180원이 이 반올림을 전제로 계산됨"
open_questions: []
intent_deviation: null
risks:
  - "examples/CN-0112.json 파일을 직접 읽는 테스트는 없음(같은 줄 데이터로 검증)"
  - "청구서 computeTotals는 이 브랜치에서 여전히 Math.round 합계 방식. 앞 Work(w-20261003-001)에서 고쳤을 수 있음, 머지 대기"
  - "저장된 기존 반품 전표의 totals는 재계산하지 않음(비목표)"
recommended_next: null
knowledge_candidates:
  - "반품 전표 부가세(`creditTotals`)도 청구서와 같이 과세 줄마다 Math.floor(줄 금액×세율/100) 후 합산한다. 면세 줄 제외, 영세율 0원 (사람)"
  - "CN-0112(INV-2047 반품)의 회계팀 기준 환불 합계는 부가세 1,742원, 합계 19,180원이다 (규칙으로 계산한 값, 회계팀 확인 전)"
---
## 요약
`creditTotals`의 부가세를 합계×세율 반올림에서 과세 줄별 버림 후 합산으로 바꿨다. CN-0112가 1,744/19,182원에서 1,742/19,180원이 된다. 테스트 3개를 추가했고 `npm test`는 49개 통과.
## 다음 task가 알아야 할 것
- 수정 위치: `src/invoice/credit-note.js` `creditTotals`의 vat 계산
- 테스트: `test/credit-note.test.js` 끝의 3개 추가, 기존 테스트는 변경 없음
- 실행: `npm test`(node --test)
- 청구서 `src/invoice/total.js` `computeTotals`는 비목표라 건드리지 않음
