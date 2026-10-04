---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "리뷰 지적 중 1번(권장)만 반영하고 2번(사소)은 반영하지 않는다"
    why: "사람이 '차단·권장만 반영'을 골랐다"
    by: human
assumptions: []
rejected:
  - "2번 가독성 변수 추출: 사람이 반영하지 않기로 함"
open_questions: []
intent_deviation: null
risks:
  - "앞 Work(w-20261004-001)에서 고쳤을 수 있음, 머지 대기: earnBase/earnOn이 머지되면 remainingEarn을 그쪽으로 합쳐야 하고 refund.js 머지 충돌 가능성이 있다"
  - "alreadyRefunded에 같은 sku를 여러 줄 넘기면 오류 없이 잘못 계산된다(입력 검증 없음, 범위 밖)"
recommended_next: null
knowledge_candidates: []
---
## 요약
리뷰 지적 2건 중 사람이 고른 1건(다회 환불 테스트에 합계 344P 단언 추가)만 반영했다. 단언을 넣자 테스트의 중복 sku 입력 버그가 드러나 sku별 누적 수량으로 고쳤다. 완료조건 5개는 모두 통과(`npm test` 22개 통과, R-0311 = 132P).
새 지식: docs/knowledge/orders/already-refunded-format.md — alreadyRefunded 입력 형식 함정을 다룬 기존 항목이 없다.
## 다음 task가 알아야 할 것
- 커밋: 6f3bca8, 01dcaa4(테스트만 변경), 지식 파일 커밋 별도
- `src/orders/refund.js`의 `remainingEarn`이 earn.js와 별도로 적립 규정을 구현한다. 앞 Work 머지 뒤 통합 필요
- 수정 전 refund.js로 되돌리면 새 테스트 2개가 실패한다(확인함)
