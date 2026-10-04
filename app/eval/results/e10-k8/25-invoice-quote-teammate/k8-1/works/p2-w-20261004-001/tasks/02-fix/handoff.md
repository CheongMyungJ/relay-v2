---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "소스는 바꾸지 않고 Q-0457 회귀 테스트만 추가한다"
    why: "현재 quoteTotals가 이미 줄별 버림이고 Q-0457이 56,278로 규칙과 일치함. 규칙은 docs/knowledge/invoice/vat-per-line-floor.md"
    by: ai
assumptions:
  - "거래처에 안내된 56,280은 bc008ff 이전 코드로 낸 견적서 값이다"
  - "경리 계산도 줄별 버림 규칙이라 56,278이 된다고 가정 (경리 금액은 모름)"
rejected:
  - "저장 합계나 서식 경로가 56,280을 만든다: 견적은 createQuote에서 계산한 값만 쓰고 src/format은 쓰이지 않음"
open_questions: []
intent_deviation: null
risks:
  - "이미 56,280으로 안내된 견적서는 다시 발급·안내해야 하는지 이 Work에서 정하지 않음"
  - "현재 코드에는 실패하는 수정 전 상태가 없어 재현 테스트는 옛 코드 사본에서만 실패를 확인함"
recommended_next: null
knowledge_candidates:
  - "견적 Q-0457의 옛 안내 합계 56,280은 합계 기준 반올림 방식의 값이고, 줄별 버림 규칙의 올바른 합계는 56,278이다"
---
## 요약
Q-0457 합계를 현재 코드로 계산하면 56,278이라 규칙과 같다. 56,280은 bc008ff 이전 견적 계산이 낸 값이다. 소스는 그대로 두고 회귀 테스트를 추가해 커밋했다.
## 다음 task가 알아야 할 것
- 회귀 테스트: `test/quote.test.js` 마지막 테스트, 옛 코드(bc008ff^)에서 실패 확인
- `npm test` 53개 통과, `src/format/`과 견적 번호·유효기간 코드는 변경 없음
- 기대값: supply 52,691 / vat 3,587 / total 56,278
