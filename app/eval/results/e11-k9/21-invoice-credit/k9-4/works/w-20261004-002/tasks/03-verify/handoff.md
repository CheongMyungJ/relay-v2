---
status: awaiting_approval
blocked_reason:
decisions: []
assumptions:
  - "회계팀 기준은 팀 지식의 품목별 버림 합산이라고 가정함 (CN-0112 기대값 19,180원)"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "앞 Work(w-20261004-001)에서 고쳤을 수 있음, 머지 대기: lineVat 정의와 computeTotals 변경. 머지 때 src/invoice/total.js의 lineVat이 충돌할 수 있어 하나로 합쳐야 함"
  - "computeTotals는 아직 Math.round 합계 기준이라 청구서 부가세는 그대로임(비목표)"
  - "금액 할인의 부분 반품 분할(returnedDiscount)은 Math.round 그대로, 규칙 미정"
recommended_next: null
knowledge_candidates: []
---
## 요약
리뷰 지적은 없었고 코드는 바꾸지 않았다. 완료조건 8개가 모두 통과했다. CN-0112 환불 합계는 19,180원(vat 1742)이고 `npm test`는 48개 통과다. 바뀐 테스트 파일은 test/credit-note.test.js 하나이며 추가만 있어 약화는 아니다.
남긴 지식: 없음 (이번 Work에서 새로 알게 된 규칙이나 사실이 없다. 기존 vat-per-line-floor.md의 규칙은 그대로 적용됐고 고칠 내용도 없다. 그 파일은 기준 브랜치에 아직 없어 만들지 않는다)
## 다음 task가 알아야 할 것
- 검증 명령: `npm test` (48 pass)
- 변경: src/invoice/total.js:16-20 `lineVat`, src/invoice/credit-note.js `creditTotals`
- 머지 시 앞 Work의 `lineVat`과 합쳐야 함
