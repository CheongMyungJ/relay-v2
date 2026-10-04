---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "리뷰 지적 1(영세율·면세 혼합 반품 전표 테스트 추가, 사소)을 반영하지 않는다"
    why: "사람이 반영하지 않기로 함"
    by: human
  - what: "대신 고친 뒤 INV-2047, CN-0112, Q-0457을 실제로 돌려 규칙 값과 비교한다"
    why: "사람의 요청"
    by: human
assumptions:
  - "회계팀 정답은 팀 지식 규칙으로 계산한 CN-0112 19,180원이다"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "청구서(total.js)와 견적서(quote.js)는 예전 방식이라 INV-2047은 규칙 값과 3원(5,801 vs 5,798), Q-0457은 2원(3,589 vs 3,587, taxType를 넣었을 때) 다르다. 앞 Work(w-20261004-001)에서 고쳤을 수 있음, 머지 대기"
  - "src/invoice/vat.js는 앞 Work(w-20261004-001)에서도 만들었을 수 있음, 머지 때 충돌 가능"
  - "영세율·면세 혼합 반품 전표 테스트 없음"
  - "examples/Q-0457.json 줄에 taxType가 없어 그대로 계산하면 전부 면세로 나옴"
recommended_next: null
knowledge_candidates: []
---
## 요약
리뷰 결과 차단·권장 지적은 없고 사소 1건(영세율·면세 테스트 없음)은 사람이 반영하지 않기로 했다. 완료조건 6개 모두 통과. CN-0112는 부가세 1,742 / 합계 19,180으로 규칙 값과 일치하고, INV-2047 청구서와 Q-0457 견적서는 범위 밖이라 예전 방식 그대로여서 규칙 값과 각각 3원, 2원 다르다.
남긴 지식: 없음 (이 Work는 기존 팀 지식 vat-per-line-floor 규칙을 따랐을 뿐 새로 알게 된 규칙이 없고, 청구서·견적서 미준수는 앞 Work가 다룸)
## 다음 task가 알아야 할 것
- `src/invoice/credit-note.js:91` `creditTotals`: `sumLineVat` 사용. `src/invoice/vat.js` 신규.
- 재확인 명령: `npm test` (50개 통과), 확인 스크립트는 `createCreditNote` + `creditNoteTotals`.
- `src/invoice/total.js:27`, `src/invoice/quote.js:31`은 아직 예전 반올림 방식(범위 밖).
