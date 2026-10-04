---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "청구서·견적용 공용 함수는 만들지 않고 creditTotals 안에서 줄별 버림을 계산했다"
    why: "이 브랜치에는 lineVat/sumLineVat이 없고(앞 Work 머지 대기), 청구서·견적은 이번 범위가 아니다"
    by: ai
assumptions: []
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "앞 Work(w-20261004-001)에서 total.js의 lineVat/sumLineVat을 만들었을 수 있음, 머지 대기. 머지 뒤 creditTotals를 그 함수로 바꿀 수 있음"
  - "청구서·견적(src/invoice/total.js)은 여전히 합계 반올림이지만 사람이 범위에서 뺌"
recommended_next: null
knowledge_candidates: []
---
## 요약
`creditTotals`의 부가세를 과세 줄마다 원 단위 버림으로 계산해 합하게 고쳤다. CN-0112 환불 합계가 19,182원에서 19,180원이 됐다.
## 다음 task가 알아야 할 것
- 수정 위치: `src/invoice/credit-note.js`의 `creditTotals`
- 재현 테스트: `test/credit-note.test.js` 마지막 테스트 (수정 전 실패 확인)
- `npm test`: 49개 통과
- 저장된 `totals`는 `creditNoteTotals`가 그대로 쓰므로 영향 없음
