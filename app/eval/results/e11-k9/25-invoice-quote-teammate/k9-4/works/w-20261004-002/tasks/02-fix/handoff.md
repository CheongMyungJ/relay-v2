---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "반품 전표 부가세를 과세 줄별 내림 합산(sumLineVat)으로 바꾸고 vat.js를 새로 만든다"
    why: "docs/knowledge/invoice/vat-per-line-floor.md 규칙. 기준 브랜치에 vat.js가 없다"
    by: ai
  - what: "returnedDiscount의 반올림은 바꾸지 않는다"
    why: "청구서 할인과 같은 방식이고 규칙은 부가세만 다룬다"
    by: ai
assumptions:
  - "회계팀 정답은 팀 지식 규칙으로 계산한 19,180원이다"
rejected:
  - "할인 반올림이 원인: 바꾸지 않아도 규칙 값이 나옴"
open_questions: []
intent_deviation: null
risks:
  - "앞 Work(w-20261004-001)에서 src/invoice/vat.js를 만들었을 수 있음, 머지 대기: 머지 때 충돌 가능, 같은 이름 lineVat/sumLineVat 사용"
  - "청구서(total.js)와 견적서는 아직 예전 반올림 방식 (범위 밖)"
  - "수정 전 확인 때 경로 한정 git stash를 한 번 썼다가 바로 pop함, 남은 stash 없음"
recommended_next: null
knowledge_candidates: []
---
## 요약
CN-0112 환불 합계를 19,182원에서 19,180원(부가세 1,744→1,742)으로 고쳤다. 부가세를 과세 줄별 내림 합산으로 계산한다.
## 다음 task가 알아야 할 것
- `src/invoice/credit-note.js` `creditTotals`: `sumLineVat` 사용. `src/invoice/vat.js` 신규.
- 테스트: test/credit-note.test.js 끝의 2개, `npm test` 50개 통과.
- `src/format/`은 건드리지 않았다.
