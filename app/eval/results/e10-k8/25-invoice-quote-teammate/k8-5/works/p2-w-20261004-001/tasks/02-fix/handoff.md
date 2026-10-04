---
status: "awaiting_approval"
blocked_reason:
decisions:
  - what: "반품 전표의 중복 lineVat/sumLineVat을 지우고 total.js 것을 쓴다"
    why: "docs/knowledge/billing/vat-per-line-floor.md: 계산은 total.js의 lineVat/sumLineVat을 공유한다"
    by: ai
assumptions:
  - "경리 계산 금액이 없어 규정 계산값 56,278원을 기준으로 삼았다"
rejected:
  - "lineGross/lineDiscount/isTaxableLine 오류: 손계산이 코드 출력과 일치"
open_questions: []
intent_deviation:
  summary: "Q-0457은 기준 커밋에서 이미 규정값(56,278)이다. 요청의 56,280은 ee0adc0 이전 코드의 값"
  evidence: "git checkout ee0adc0~1 에서 56,280, 현재 56,278"
risks:
  - "거래처에 이미 56,280원 견적서를 보냈다면 새로 발행해야 한다(저장된 totals는 재계산하지 않음)"
  - "credit-note.js를 고쳤으나 반품 계산 결과는 그대로(중복 제거만)"
recommended_next: null
knowledge_candidates:
  - "머지로 같은 함수가 두 브랜치에서 각각 추가되면 중복 선언 SyntaxError가 나 npm test가 파일 단위로 깨진다. 머지 뒤에는 npm test를 돌려 확인한다."
---
## 요약
Q-0457은 이미 줄별 버림이 적용돼 56,278원이다(옛 값 56,280). npm test 실패는 머지로 중복된 credit-note.js 함수 때문이어서 제거했고, Q-0457 테스트를 추가했다. 54개 통과.
## 다음 task가 알아야 할 것
- 규정값: 부가세 995+841+886+865=3,587, 합계 56,278
- `src/invoice/credit-note.js` 중복 제거, `test/quote.test.js` 끝에 Q-0457 테스트
- 명령: `npm test`
