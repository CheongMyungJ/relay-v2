---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "리뷰 지적 중 1번(테스트 제목 불일치)만 반영하고 2번(percentOf 미사용)은 반영하지 않음"
    why: "사람이 1번만 반영을 골랐다"
    by: human
assumptions:
  - "G-0213의 기대값 218P는 규정에서 계산한 값이며 사람이 확인하지 않음"
rejected:
  - "percentOf 제거: 사람이 반영하지 않기로 함. fix 단계에서 영향 범위를 줄이려고 남긴 것"
open_questions: []
intent_deviation: null
risks:
  - "부분 환불 시 쿠폰·사용 포인트 안분 방식은 규정이 없어 기존 방식 유지"
  - "이미 저장된 적립 값은 재계산하지 않음(비목표)"
  - "percentOf는 쓰이지 않는 코드로 남음"
recommended_next: null
knowledge_candidates: []
---
## 요약
리뷰 지적 2건(모두 사소) 중 테스트 제목 불일치만 고쳐 커밋했다(bf54801). 8개 완료조건 모두 통과. `npm test` 25개 통과, O-1042 237P, G-0213 218P, R-0311 131P, `src/format/` 변경 없음.
새 지식: docs/knowledge/points/earn-rule.md — 적립 규정과 부분 환불 안분 미정 사항을 담은 기존 항목이 없었다
## 다음 task가 알아야 할 것
- 산출물: `verification.md`, `pr.md` (task 디렉터리)
- 바뀐 테스트 파일은 새 파일 `test/points-earn.test.js`뿐이며 약화 아님.
- 환불 회수는 환불 상품 금액 ≤ 상품−쿠폰−사용 포인트(`src/orders/refund.js:30` 가드)라 회수가 적립을 넘지 않는다.
- 부분 환불 안분은 `docs/knowledge/points/earn-rule.md`에 미정으로 기록.
