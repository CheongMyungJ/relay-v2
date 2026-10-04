---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "리뷰 지적 2건(모두 사소)을 반영하지 않음"
    why: "1번은 사람이 범위에서 뺀 환불 회수라 코드 변경 대상이 아니고, 2번은 giftPoints가 earnPoints를 그대로 써서 위험이 낮음"
    by: human
  - what: "order/gift 테스트의 기대값 변경 2건을 약화 아님으로 판단"
    why: "1%→2% 정책 변경에 맞춘 값이며 검증 범위는 같음"
    by: ai
assumptions: []
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "환불 회수는 percentOf(반올림)+1% 고정이라 earn-rule.md의 '적립 전후 차이' 규칙과 다름. 정산팀 협의 전까지 의도됨"
  - "앞 Work(w-20261004-001)에서 고쳤을 수 있음, 머지 대기. src/points/earn.js와 docs/knowledge/points/earn-rule.md 충돌 가능"
  - "재현 테스트를 수정 전 코드에 직접 돌려 실패를 확인하지는 않음"
recommended_next: null
knowledge_candidates: []
---
## 요약
리뷰 결과 차단·권장 지적은 없고 사소 2건은 반영하지 않았다. 완료조건 7개 모두 통과(`npm test` 21 pass, O-1107 486P, R-0311 환불 출력 기준 커밋과 동일, `src/format/` 무변경). 바뀐 테스트 파일 2건은 약화 아님.
고친 지식: docs/knowledge/points/earn-rule.md — 적립률 2% 반영, 환불 회수 계산 미준수 지점을 '아직 규칙을 따르지 않는 곳'에 기록
새 지식: docs/knowledge/points/refund-recover-rate.md — 환불 회수 비율 분리(`REFUND_RECOVER_RATE_PERCENT` 1%)를 다루는 기존 항목이 없음
확인한 지식: docs/knowledge/format/receipt-text-fixed.md — 이번 Work는 src/format/을 건드리지 않아 그대로 둠
## 다음 task가 알아야 할 것
- 검증 명령: `npm test`, `node src/cli.js examples/O-1107.json`(486P), `node src/cli.js examples/R-0311.json --order examples/O-1077.json`(-131P)
- 코드: `src/points/earn.js`(`earnBase`/`pointsOf`), `src/config.js`(`POINT_RATE_PERCENT=2`, `REFUND_RECOVER_RATE_PERCENT=1`)
- 지식 커밋: docs/knowledge/points/ 2개 파일
