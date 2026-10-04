---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "반품 전표 부가세를 과세 줄마다 할인 후 금액에 Math.floor로 구해 합산한다"
    why: "팀 지식 docs/knowledge/invoice/vat-per-line-floor.md의 규칙"
    by: ai
assumptions:
  - "줄 할인(비율 반올림, 금액 할인 안분)의 반올림은 규칙 밖이라 바꾸지 않았다"
  - "회계팀이 기대하는 CN-0112 값은 규칙대로 계산한 19,180원(부가세 1,742원)이라고 가정했다"
rejected:
  - "줄 할인 반올림이 원인: 규칙 밖이고 CN-0112 차이는 부가세 계산만으로 설명된다"
open_questions: []
intent_deviation: null
risks:
  - "앞 Work(w-20261004-001)에서 청구서 쪽 규칙을 고쳤을 수 있음, 머지 대기"
  - "회계팀의 CN-0112 기대값을 직접 확인하지 못했다"
recommended_next: null
knowledge_candidates:
  - "고침: src/invoice/credit-note.js의 반품 전표 부가세가 과세 줄별 버림 합산 규칙을 따른다 (Work w-20261004-002). vat-per-line-floor.md의 '아직 규칙을 따르지 않는 곳'에서 뺀다"
---
## 요약
`creditTotals`의 부가세를 합계 기준 반올림에서 과세 줄별 버림 합산으로 고쳤다. CN-0112는 환불 합계 19,182원에서 19,180원(부가세 1,742원)이 된다. 테스트 3개를 추가했고 `npm test`는 49개 통과한다.
## 다음 task가 알아야 할 것
- 수정: `src/invoice/credit-note.js` `creditTotals`의 vat 줄
- 테스트: `test/credit-note.test.js` 끝부분 3개, 수정 전 2건 실패 확인
- `src/format/` 변경 없음
