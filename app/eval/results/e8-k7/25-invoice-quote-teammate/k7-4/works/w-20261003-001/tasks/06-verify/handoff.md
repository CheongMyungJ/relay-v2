---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "리뷰 지적 1번(견적서 할인 줄 테스트 추가)만 반영하고 2번(부가세 합산 식 중복 정리)은 반영하지 않는다"
    why: "사람이 1번만 반영하기로 골랐다"
    by: human
assumptions: []
rejected:
  - "2번 부가세 합산 식 중복 정리: 사람이 반영하지 않기로 함"
open_questions: []
intent_deviation: null
risks:
  - "CN-0112는 INV-2047 예제를 issued로 바꿔 계산했고 실제 앱 흐름과는 확인하지 않음"
  - "반품 전표의 returnedDiscount는 기존 반올림 그대로(비목표)"
recommended_next: null
knowledge_candidates: []
---
## 요약
리뷰 지적은 사소 2건이고, 사람이 고른 1번(견적서 할인 줄 테스트)만 반영해 커밋했다. 완료조건 10개 모두 통과했다. `npm test` 55개 통과, INV-2031 29,079원, CN-0112 19,180원, Q-0457 56,278원을 직접 다시 확인했다. 변경된 테스트 파일은 새로 추가한 것뿐이라 약화가 아니다.
남긴 지식: docs/knowledge/vat-per-line-floor.md
## 다음 task가 알아야 할 것
- 검증 명령: `npm test`, `node src/cli.js examples/INV-2031.json --totals`, `node src/cli.js examples/CN-0112.json --invoice examples/INV-2047.json`, `node src/cli.js examples/Q-0457.json`
- `lineVat`: `src/invoice/tax-type.js`. 사용처는 `total.js`, `credit-note.js`, `quote.js`.
- 산출물: `verification.md`, `pr.md`
