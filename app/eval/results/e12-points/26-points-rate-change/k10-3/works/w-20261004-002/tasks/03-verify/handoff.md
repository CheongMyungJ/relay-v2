---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "회수 포인트는 저장된 points.earned에서 남은 상품 기준 재계산 적립을 뺀다. 나눠 환불은 첫 환불만 earned에서 시작하고 이후는 환불 전 상품 기준 적립에서 시작한다"
    why: "사람이 정산팀 규정으로 알려 줌: 이미 적립된 값은 다시 계산하지 않는다. 합이 earned − 최종 적립이 되도록 한 일관 처리는 AI가 정함"
    by: human
  - what: "리뷰 지적 1(저장 earned 기준)과 2(쿠폰 주문 테스트)를 반영하고 3(부동소수점)은 반영하지 않음"
    why: "사람이 1번만 반영 선택(차단 지적 1은 사람이 직접 요청)"
    by: human
assumptions:
  - "나눠 환불에서 앞 환불이 저장값 차이를 이미 회수했다고 보고 두 번째부터는 환불 전 상품 기준 재계산을 쓴다"
rejected:
  - "매 환불마다 저장 earned − 남은 적립으로 누적 계산: 앞 환불 회수분과 중복 회수된다"
open_questions: []
intent_deviation:
  summary: "intent 버전 1의 원하는 결과는 환불 전후 재계산 적립의 차이인데 사람이 저장 earned 기준으로 바꾸라고 함"
  evidence: "R-0311은 두 방식 모두 132P. 저장 earned가 재계산과 다른 주문에서만 결과가 다르다"
risks:
  - "intent 문구와 코드 기준이 다르다(intent는 갱신 안 됨)"
  - "옛 기준 저장 주문은 첫 부분 환불에서 저장값 차이가 한 번에 회수됨"
  - "앞 Work(w-20261004-001)에서 고쳤을 수 있음, 머지 대기: earn.js에 같은 이름 earnBase/pointsForBase가 있으면 머지 충돌. earnPoints와 gift-points.js는 옛 반올림 기준"
recommended_next: null
knowledge_candidates: []
---
## 요약
부분 환불 회수 포인트를 저장된 earned − 남은 상품 기준 적립(버림)으로 계산하게 했다. R-0311은 132P, `npm test` 24개 통과. 리뷰 지적 1·2 반영, 3 보류.
고친 지식: docs/knowledge/points/partial-refund-recovery.md — 회수 규칙을 재계산 차이에서 저장 earned 기준으로 바꾸고 나눠 환불 처리와 취소 규칙을 적음
## 다음 task가 알아야 할 것
- `src/orders/refund.js:30` 근처: `pointsBefore`(refundedBefore가 0이면 `order.points.earned`).
- `src/points/earn.js`: `earnBase`, `pointsForBase`.
- 테스트: `test/refund-points.test.js` 4개. 커밋 43af7e9, 752d48e.
- 확인: `node src/cli.js examples/R-0311.json --order examples/O-1077.json`는 -132P.
