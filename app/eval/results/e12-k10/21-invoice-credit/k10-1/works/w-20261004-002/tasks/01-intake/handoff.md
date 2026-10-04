---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "반품 전표도 청구서와 같은 줄별 버림 부가세 규칙을 목표로 삼는다"
    why: "팀 지식 vat-per-line-floor.md의 규칙이 반품 전표를 명시적으로 덮는다"
    by: ai
assumptions:
  - "반품 줄의 할인 계산(비율 할인 반올림, 금액 할인 수량 비례 반올림)은 요청 범위 밖이라 그대로 둔다"
  - "CN-0112 기대값 19,180원은 팀 규칙을 손으로 적용해 얻은 값이다 (줄별 부가세 923 + 612 + 207 = 1,742원, 공급가액 17,438원)"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "팀 지식의 `floorPercentOf`는 앞 Work(w-20261004-001)에서 만들었고 머지 대기라 이 브랜치의 `src/money.js`에 아직 없다. 앞 Work에서 고쳤을 수 있음, 머지 대기"
  - "공급가액이 음수인 줄의 부가세는 정해지지 않았다 (팀 지식 '아직 정하지 않은 것')"
recommended_next: null
knowledge_candidates: []
---
## 요약
반품 전표 CN-0112의 환불 합계가 회계팀 계산과 2원 어긋나는 버그의 의도 초안을 썼다. 목표는 반품 전표 부가세를 줄별 버림 규칙으로 맞추는 것이다.
## 다음 task가 알아야 할 것
- `src/invoice/credit-note.js` `creditTotals`가 부가세를 과세 합계에 한 번 `Math.round`로 구한다. 현재 CN-0112는 1,744원, 합계 19,182원이다 (추정이며 fix에서 확인 필요).
- 참고할 팀 지식: `docs/knowledge/billing/vat-per-line-floor.md` (기준 브랜치에 아직 없음)
- `creditLineAmounts`가 줄별 `net`(공급가액)을 이미 준다.
- 테스트 명령: `npm test`, 기존 테스트 `test/credit-note.test.js`
