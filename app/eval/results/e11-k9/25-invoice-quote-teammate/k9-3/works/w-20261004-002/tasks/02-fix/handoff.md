---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "`src/invoice/vat.js`를 이 브랜치에 새로 만들어 반품 전표가 쓰게 했다"
    why: "팀 지식 docs/knowledge/billing/vat-per-line-floor.md가 공용 함수 위치를 vat.js의 lineVat/sumLineVat으로 정했고 이 브랜치에 없음"
    by: ai
assumptions:
  - "손계산 참고값 1,742/19,180이 맞다고 보았고 코드 결과가 일치함을 확인했다"
rejected:
  - "할인 안분(returnedDiscount) 오류: 줄별 공급가액이 손계산과 같고 비목표"
open_questions: []
intent_deviation: null
risks:
  - "앞 Work(w-20261004-001)에서 vat.js를 이미 만들었을 수 있음, 머지 대기. 머지 시 src/invoice/vat.js 충돌 가능"
  - "청구서(total.js)·견적서(quote.js)는 아직 Math.round 방식이다. 범위 밖이라 두었고 앞 Work에서 고쳤을 수 있음, 머지 대기"
  - "저장된 totals가 있는 CN은 재계산하지 않으므로 이미 발행된 전표는 그대로다(의도된 동작)"
recommended_next: null
knowledge_candidates:
  - "반품 전표 부가세 계산은 src/invoice/credit-note.js creditTotals에서 vat.js sumLineVat을 쓴다. CN-0112는 vat 1,742 / 합계 19,180"
---
## 요약
CN-0112 환불 금액이 어긋난 원인은 반품 전표가 과세분 합계에 부가세를 한 번 반올림한 것이었다. 줄별 버림 합산으로 고쳐 1,742/19,180이 나온다. 테스트 52개 통과.
## 다음 task가 알아야 할 것
- 수정: `src/invoice/credit-note.js` creditTotals, 신규 `src/invoice/vat.js`
- 재현 테스트: `test/credit-note.test.js` 끝 4개
- 명령: `npm test`
- 머지 시 vat.js 충돌 여부 확인
