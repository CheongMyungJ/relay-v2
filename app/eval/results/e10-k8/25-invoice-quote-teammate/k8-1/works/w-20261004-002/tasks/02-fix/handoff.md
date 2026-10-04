---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "부가세를 줄마다 Math.floor로 계산해 합산한다. 할인 계산(returnedDiscount)의 반올림은 바꾸지 않는다"
    why: "팀 지식 docs/knowledge/invoice/vat-per-line-floor.md. 할인 반올림은 규칙에 없고 비목표 범위를 넓히지 않기 위해"
    by: ai
assumptions:
  - "회계팀의 기대 금액은 요청에 없어 팀 지식 규칙으로 직접 계산한 19,180원을 기대값으로 본다"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "앞 Work(w-20261004-001)에서 같은 곳을 고쳤을 수 있음, 머지 대기. 머지 시 credit-note.js 충돌 가능"
  - "비율 할인(returnedDiscount)은 여전히 Math.round를 쓴다. 회계 규칙이 다르면 CN-0112 금액이 달라질 수 있다"
recommended_next: null
knowledge_candidates: []
---
## 요약
`creditTotals`의 부가세를 합계 반올림에서 줄별 버림 합산으로 고쳤다. CN-0112는 19,182원에서 19,180원이 된다. 재현 테스트를 추가했고 `npm test` 49개가 통과한다.
## 다음 task가 알아야 할 것
- 수정 위치: `src/invoice/credit-note.js`의 `creditTotals`
- 재현 테스트: `test/credit-note.test.js` 마지막 테스트
- CN-0112 기대값: supply 17,438, vat 1,742, total 19,180
- `src/format/`과 `creditNoteTotals`는 변경 없음
