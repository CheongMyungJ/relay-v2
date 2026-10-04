---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "부가세는 줄별로 원 단위 내림해 합산하는 것을 기준으로 한다"
    why: "회계팀 계산 방식으로 사람이 선택함"
    by: human
  - what: "발행된 청구서는 재계산하지 않고, src/format/ 출력 형식은 유지한다"
    why: "사람이 비목표로 추가 요청함 (PDF 생성기가 서식 출력을 그대로 사용)"
    by: human
assumptions:
  - "INV-2031의 모든 줄이 과세이고 할인이 없다고 보고 기대 부가세를 2,641원으로 계산함"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "현재 코드는 공급가액 합에 한 번만 반올림하므로 다른 예제(INV-2047 등)와 테스트 기대값도 달라질 수 있음"
recommended_next: null
knowledge_candidates:
  - "PDF 생성기가 src/format/ 서식 모듈의 출력을 그대로 찍으므로 출력 형식을 바꾸면 안 된다 (사람)"
  - "이미 발행된 청구서는 재계산하지 않고 저장된 합계를 쓴다 (사람)"
  - "회계팀은 청구서 부가세를 줄별로 원 단위 내림해 합산한다 (사람)"
---
## 요약
청구서 합계가 회계팀보다 큰 문제의 의도를 정리했다. 기준은 줄별 부가세 내림이다.
## 다음 task가 알아야 할 것
- `src/invoice/total.js` `computeTotals`: `vat`를 과세분 합계에 한 번 반올림해 계산함
- INV-2031: 공급가액 26,438원, 현재 부가세 2,644원, 합계 29,082원. 기대는 2,641원, 29,079원
- 테스트 명령: `npm test`
