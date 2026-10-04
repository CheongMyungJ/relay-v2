---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "경리 합계는 56,278원으로 두고 목표 금액으로 삼는다"
    why: "사람이 답함: 경리 합계는 56,278원"
    by: human
  - what: "반품 전표 `creditTotals`의 수정을 이번 Work 범위에 넣는다"
    why: "`npm test`가 기준 커밋에서 7건 실패하고 원인이 credit-note.js이다. 완료조건 `npm test 통과`를 만족하려면 고쳐야 하고, 팀 지식도 이 코드를 공용 함수로 바꿀 대상으로 적어 둠"
    by: ai
assumptions:
  - "56,280원은 코드 밖(영업팀이 본 옛 발행본, 다른 시스템 등)에서 나온 값일 것이라고 가정함. 확인 안 됨"
rejected:
  - "src/format에서 견적 출력 경로 찾기: 견적을 그리는 렌더러가 없다. renderInvoice는 청구서 전용"
open_questions: []
intent_deviation:
  summary: "요청은 견적 합계 계산이 틀렸다고 하지만, 현재 코드는 Q-0457을 56,278원으로 계산해 경리 합계와 같다"
  evidence: "createQuote, quoteTotals 직접 호출과 CLI 모두 supply 52691, vat 3587, total 56278. test/vat-rule.test.js:55도 56,278을 단언함"
risks:
  - "56,280원의 출처가 없어, 견적 쪽에서는 코드 변경 없이 테스트 보강만 남을 수 있다"
  - "credit-note.js 수정은 요청 밖이다. 사람이 범위에서 빼려면 npm test 실패 7건이 남는다"
recommended_next: null
knowledge_candidates:
  - "56,280원은 영업팀이 전한 Q-0457 합계이고 출처를 알 수 없다. 코드는 56,278원으로 경리와 같다 (사람)"
---
## 요약
영업팀에 확인할 수 없는 상황이라 56,280원은 출처 없이 둔다. 견적 계산은 이미 경리와 같은 56,278원이다. 그래서 의도를 "견적 합계를 테스트로 고정"과 "깨진 npm test 복구"로 잡았다. 견적 출력 텍스트는 src/format에 없고, 부가세 처리는 청구서와 견적이 `sumLineVat`을 같이 쓴다.
## 다음 task가 알아야 할 것
- 기준 커밋에서 `npm test` 58건 중 7건 실패(반품 전표 관련). 원인: `src/invoice/credit-note.js:94`가 `VAT_RATE_PERCENT`를 import하지 않아 ReferenceError. 같은 파일은 `sumLineVat`을 import하고 안 씀
- `creditTotals`(credit-note.js:88~96)를 `sumLineVat(rows, note.zeroRated)`로 바꾸는 것이 팀 지식의 방향 (내 추측: 이것만으로 7건이 풀릴 것, 확인 안 됨)
- 견적: `src/invoice/quote.js` `quoteTotals`는 `sumLineVat`을 씀. 결과 52,691 / 3,587 / 56,278. `test/vat-rule.test.js:55`가 이미 검증
- 견적 출력: `src/cli.js:49~50`이 JSON만 찍음. `src/format/invoice-text.js`는 청구서 전용
- 참고 지식: `docs/knowledge/billing/vat-per-line-floor.md`, `docs/knowledge/billing/credit-note-stored-amounts.md`
