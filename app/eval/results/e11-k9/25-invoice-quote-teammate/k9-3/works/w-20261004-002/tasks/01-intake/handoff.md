---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "부가세 기준은 팀 지식의 줄별 버림 규칙으로 한다"
    why: "회계팀 규칙(팀 지식 vat-per-line-floor.md, 사람이 정한 규칙)이 반품 전표에도 적용된다고 규칙에 명시됨"
    by: ai
assumptions:
  - "회계팀 계산과의 차이는 부가세 계산 방식에서 온다고 보고 초안을 썼다. 원인 확정은 fix의 일이다"
  - "청구서·견적서 수정은 이번 범위가 아니라고 보았다"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "`src/invoice/vat.js`(lineVat/sumLineVat)는 이 브랜치에 없다. 앞 Work(w-20261004-001)에서 만들었을 수 있으며 머지 대기 중이다. 청구서·견적서도 아직 줄별 버림이 아니다(앞 Work에서 고쳤을 수 있음, 머지 대기)"
  - "손계산 참고값 19,180원은 비율 할인 반올림 방식에 따라 1원 달라질 수 있다"
recommended_next: null
knowledge_candidates: []
---
## 요약
반품 전표 CN-0112의 환불 금액이 회계팀 계산과 어긋나는 버그의 의도 초안을 썼다. 부가세를 줄별 버림 합산으로 맞추는 것이 목표이다.
## 다음 task가 알아야 할 것
- 참고(원인 아님, 가설): `src/invoice/credit-note.js` `creditTotals`의 vat가 과세분 합에 `Math.round`를 쓴다. 현재 CN-0112는 공급가액 17,438 + vat 1,744 = 19,182로 요청의 금액과 같다.
- 줄별 버림으로 손계산하면 vat 923+612+207 = 1,742, 합계 19,180이다.
- 팀 지식 `docs/knowledge/billing/vat-per-line-floor.md`, `docs/knowledge/billing/issued-invoice-totals-frozen.md`는 기준 브랜치에 아직 없다(레포에 `docs/` 없음).
- `src/invoice/vat.js`가 이 브랜치에 없어 공용 함수를 새로 만들지 앞 Work 머지를 기다릴지 fix에서 정해야 한다.
- 테스트: `npm test`(`node --test`), 관련 파일 `test/credit-note.test.js`.
