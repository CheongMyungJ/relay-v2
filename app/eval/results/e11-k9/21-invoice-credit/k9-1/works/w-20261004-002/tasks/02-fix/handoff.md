---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "반품 전표 부가세를 과세 줄마다 net에 세율을 곱해 Math.floor한 값의 합으로 계산한다"
    why: "팀 지식 docs/knowledge/invoice/vat-per-line-floor.md의 규칙이고 intent 제약과 같다"
    by: ai
assumptions:
  - "회계팀의 CN-0112 기대 합계는 모르므로 규칙 적용 결과(19,180원)가 회계팀 계산과 같다고 가정함"
  - "returnedDiscount의 할인 반올림은 범위 밖으로 두었고 회계팀 계산과 같다고 가정함"
rejected:
  - "returnedDiscount 반올림이 원인: intake에서 범위 밖으로 정했고 부가세 규칙과 별개"
open_questions: []
intent_deviation: null
risks:
  - "앞 Work(w-20261004-001)에서 고쳤을 수 있음, 머지 대기 (청구서 쪽 부가세 계산, 이번 범위 밖이라 손대지 않음)"
  - "저장된 totals는 다시 계산하지 않으므로 이미 만든 전표의 금액은 그대로 틀린 채 남음(비목표)"
recommended_next: null
knowledge_candidates:
  - "반품 전표 부가세(creditTotals)는 이제 줄별 버림 규칙을 따른다. docs/knowledge/invoice/vat-per-line-floor.md의 '아직 규칙을 따르지 않는 곳'에서 credit-note.js 항목을 뺀다"
---
## 요약
`creditTotals`의 부가세를 과세 줄별 버림 합으로 고쳤다. CN-0112 환불 합계가 19,182원에서 19,180원(부가세 1,742원)으로 바뀌었다. 재현 테스트를 추가했고 `npm test`는 47개 모두 통과한다.
## 다음 task가 알아야 할 것
- 수정 위치: `src/invoice/credit-note.js`의 `creditTotals`
- 재현 테스트: `test/credit-note.test.js` 마지막 테스트 (수정 전 vat 1744로 실패 확인)
- 저장된 `totals`가 있으면 `creditNoteTotals`가 그대로 반환하는 경로는 건드리지 않았다
- `src/format/`은 변경 없음
