# relay task 컨텍스트

앱이 task를 시작할 때 쓴 파일이다. 스킬의 절차를 따르고, 필요한 값은 이 파일에서 읽는다.

## task 정보

- work_id: w-20261004-002
- task_id: t-02
- 업무 유형: 버그 수정 (`bugfix`)
- node: fix (원인 분석과 수정)
- skill: fix
- 승인된 intent 버전: 1
- task 디렉터리: /tmp/relay-eval/e10-points/26-points-rate-change-k7-1/relay-home/projects/shop-5ea5c6/works/w-20261004-002/tasks/02-fix
- 작업 브랜치: relay/w-20261004-002
- 기준 브랜치: main
- 기준 커밋: b454f0f2fe51a835597898f2aaca56b793f1875d

## 승인 방식

자동 승인 (task를 시작할 때의 설정. 설정은 바로 적용되고, 자동 승인 여부는 턴이 끝날 때의 설정으로 정한다)

## 마무리 안내 문구

산출물과 handoff를 썼습니다. 오른쪽 패널에서 확인하고 [승인]을 누르세요. 자동 승인이 켜져 있으면 조건을 만족할 때 카운트다운 뒤 승인되고, 멈추려면 [취소]를 누르세요. 고칠 점은 여기에 말해 주세요.

## 질문 방식

초안 우선 (`draft_first`)

## 팀 지식

레포의 `docs/knowledge/`에 팀이 앞선 일에서 남긴 지식이다. 사람이 알려 준 규칙과 사실, 앞선 조사에서 알아낸 것이다.

- 이 일에 해당하는 항목은 팀이 이미 아는 사실이다. 같은 내용을 사람에게 다시 묻지 않는다. 사람이 정한 규칙과 관례는 수정 방향을 정할 때 따르고 `decisions`에 남긴다(`by: ai`, `why`에 항목 경로). 실패 유형은 먼저 확인해 볼 가설로 쓰고, 이 코드에서 확인한 뒤에만 원인으로 삼는다.
- "기준 브랜치에는 아직 없다"고 적힌 항목은 머지를 기다리는 앞 Work에서 왔다. 그 Work가 고친 코드는 이 브랜치에 아직 없다. 같은 규칙을 어기는 코드가 이번 요청 밖에서 보이면 앞 Work가 이미 고친 곳일 수 있으니, 범위를 넓히지 말고 handoff의 `risks`에 "앞 Work(<id>)에서 고쳤을 수 있음, 머지 대기"로 적는다.
- 규칙이 이번 경우에도 통하는지는 규칙의 말로 판단한다. 말이 이번 경우를 덮으면 그대로 따른다. 확인하려고 같은 규칙을 다시 묻거나 가정으로 남겨 사람에게 되묻지 않는다.
- 항목에 적힌 코드의 위치나 모양은 다른 Work의 것이라 지금 코드와 다를 수 있다. 다르면 지금 코드를 보고, 규칙과 사실은 그대로 따른다. 규칙이 사람의 지금 말과 어긋날 때만 묻는다. 해당하지 않는 항목은 무시한다.

### 항목

#### docs/knowledge/points-earn-excludes-shipping-floor.md (Work w-20261004-001에서 남김. 기준 브랜치에는 아직 없다)

```markdown
# 적립 포인트는 (상품 − 쿠폰 − 사용 포인트)의 적립률을 소수점 버림한 값이다

- 종류: 규칙
- 적용: src/points/earn.js (earnOn, earnPoints), 주문·선물하기 적립
- 출처: 사람이 알려 줌, relay Work w-20261004-001, 2026-10-04

배송비는 적립 대상이 아니고, 반올림하지 않고 버림한다. 고객센터 적립 안내 기준이다.
예: O-1042 = 28,270 − 3,000 − 1,500 = 23,770원의 1% = 237.7 → 237P (결제 금액 26,770 기준 반올림 268P는 틀림).
적립 계산은 earnOn/earnPoints 한 곳에 두고 주문, 선물하기, 환불 회수가 이를 쓴다. 따로 복제하지 않는다.
```

#### docs/knowledge/points-earn-saved-orders-not-recomputed.md (Work w-20261004-001에서 남김. 기준 브랜치에는 아직 없다)

```markdown
# 이미 저장된 주문의 적립값은 소급 수정하지 않는다

- 종류: 규칙
- 적용: 저장된 주문의 points.earned, 영수증, 전체 취소 회수
- 출처: 사람이 알려 줌, relay Work w-20261004-001, 2026-10-04

적립 계산 기준을 바꿔도 저장된 주문의 points.earned는 고치지 않는다. 영수증과 전체 취소(cancelOrder)는 저장값을 그대로 쓴다.
참고: examples/O-1077.json은 저장된 주문이라 `--order` 인자로 쓴다. 입력으로 바로 넣으면 pointsUsed가 없어 423P로 보인다(저장값 403P).
```

#### docs/knowledge/refund-recovery-follows-earn-rule.md (Work w-20261004-001에서 남김. 기준 브랜치에는 아직 없다)

```markdown
# 부분 환불의 포인트 회수는 적립과 같은 기준으로 계산하고 적립을 넘지 않는다

- 종류: 규칙
- 적용: src/orders/refund.js (createRefund)
- 출처: 사람이 알려 줌, relay Work w-20261004-001, 2026-10-04

회수가 적립보다 크면 안 된다. 상품 금액에 바로 적립률을 곱하지 않고, 환불 전후의 적립 기준 금액(남은 상품 − 쿠폰 − 사용 포인트)의 적립 차이로 회수한다.
예: O-1077(적립 403P)에서 13,130원 환불 → 403 − 271 = 132P. 줄마다 따로 곱하면 전체 회수가 473P가 되어 적립을 넘는다.
영수증 글자(src/format)와 이미 저장된 적립값은 건드리지 않는다.
```

### 지식 후보 남기기

handoff의 `knowledge_candidates`에, 이 task에서 알게 된 것 가운데 다음 일에도 쓸 사실을 한 줄에 하나씩 적는다. 다음 verify가 이것을 보고 레포에 지식으로 남긴다.

- 남길 것: 사람이 알려 준 규칙, 관례, 업무 사실(예: 업무 규정, 팀이 정한 방식, 언제 무엇을 왜 바꿨나), 코드만 보고는 다시 알기 어려운 사실, 다시 겪을 만한 실패 유형과 그 위치. 사람이 말한 것은 뜻을 살려 그대로 적고 끝에 "(사람)"을 붙인다.
- 사람이 요청이나 답에서 "늘 이렇게 한다", "이건 해결이 아니다"처럼 이번 일을 넘어 통하는 규칙을 말했으면, 이번 Work의 비목표나 제약으로 옮겼더라도 후보로 적는다.
- 남기지 않을 것: 이번 일에만 해당하는 것, 코드와 커밋에 이미 드러난 것, 비밀(토큰, 비밀번호, 내부 주소)과 개인정보. "이 규칙이 저기에도 통하는지 모른다"처럼 모른다는 것만 담은 메모도 후보가 아니다.

## 선택 가능한 다음 단계

- 기본 다음 단계: verify (리뷰와 검증)
- 이전 단계: intake (의도 정리)

## intent (버전 1)

```markdown
---
schema_version: 1
version: 1
type: bugfix
---
## 목표
부분 환불(`createRefund`, `src/orders/refund.js`)에서 회수하는 포인트가 정산팀 계산과 맞도록 한다. 현재 O-1077의 부분 환불 R-0311은 131P를 회수하는데 정산팀 계산은 132P이다(1~2P 차이).

## 비목표
- 이미 저장된 주문의 적립값(`points.earned`)과 이미 처리한 환불을 다시 계산하거나 수정하지 않는다.
- 환불 금액(`refundAmount`)과 영수증 글자(`src/format/`)는 바꾸지 않는다.
- 전체 취소(`cancelOrder`)의 동작은 바꾸지 않는다.

## 원하는 결과
부분 환불의 포인트 회수가 정산팀 기준과 일치한다. R-0311(O-1077) 회수는 132P이다. 회수가 해당 주문의 적립을 넘지 않는다.

## 완료조건
- [ ] 재현 절차(examples/O-1077.json 주문에 examples/R-0311.json 환불)가 더 이상 실패하지 않는다. 회수 포인트가 132P이다
- [ ] `npm test`가 통과한다
- [ ] 기존 테스트를 약화하거나 삭제하지 않는다
- [ ] R-0311의 `refundAmount`는 수정 전과 같다
- [ ] 영수증 출력(`src/format/`)과 저장된 주문의 `points.earned`는 수정 전과 같다
- [ ] 부분 환불 회수 포인트가 해당 주문의 적립 포인트를 넘지 않는 경우를 확인하는 테스트가 있다

## 제약
- (팀 지식 `docs/knowledge/refund-recovery-follows-earn-rule.md`) 부분 환불의 회수는 적립과 같은 기준으로 계산하고 적립을 넘지 않는다. 상품 금액에 바로 적립률을 곱하지 않고, 환불 전후 적립 기준 금액(남은 상품 − 쿠폰 − 사용 포인트)의 적립 차이로 회수한다. 예: O-1077(적립 403P)에서 13,130원 환불 → 403 − 271 = 132P.
- (팀 지식 `docs/knowledge/points-earn-excludes-shipping-floor.md`) 적립 계산은 `earnOn`/`earnPoints` 한 곳에 두고 환불 회수가 이를 쓴다. 복제하지 않는다. 배송비 제외, 소수점 버림.
- (팀 지식 `docs/knowledge/points-earn-saved-orders-not-recomputed.md`) 저장된 주문의 `points.earned`는 소급 수정하지 않는다. O-1077은 저장된 주문이라 `--order` 인자로 쓴다.

## 추가 의견
- 요청에 원인 추정은 없음.
```

## Work 요청 원문

경로: /tmp/relay-eval/e10-points/26-points-rate-change-k7-1/relay-home/projects/shop-5ea5c6/works/w-20261004-002/request.md

## 결정 로그

```markdown
## t-01 intake — 2026-10-04 04:48 (사람 승인)
- [AI] 부분 환불 회수는 팀 지식의 규칙(환불 전후 적립 차이, 적립 초과 금지)을 제약으로 따른다 — 팀 지식 refund-recovery-follows-earn-rule이 이번 요청(R-0311, 132P)을 그대로 덮음
```

## 누적 기각 목록

없음

## 직전 handoff (t-01 intake)

```markdown
---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "부분 환불 회수는 팀 지식의 규칙(환불 전후 적립 차이, 적립 초과 금지)을 제약으로 따른다"
    why: "팀 지식 refund-recovery-follows-earn-rule이 이번 요청(R-0311, 132P)을 그대로 덮음"
    by: ai
assumptions:
  - "정산팀 기준은 팀 지식의 규칙과 같다(예시 132P가 일치)"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "팀 지식 3건은 기준 브랜치에 아직 없고 앞 Work(w-20261004-001)에서 왔다. 그 Work가 고친 earnOn/earnPoints는 이 브랜치에 없을 수 있음, 머지 대기"
recommended_next: null
knowledge_candidates: []
---
## 요약
부분 환불 회수 포인트가 정산팀 계산과 1~2P 어긋나는 버그의 의도 초안을 썼다. 목표는 R-0311 회수 132P, 환불 금액·영수증·저장된 적립값 불변이다.
## 다음 task가 알아야 할 것
- `src/orders/refund.js` createRefund 마지막 return의 `pointsRecovered`가 `percentOf(refundGoods, POINT_RATE_PERCENT)`로 환불 상품 금액에 바로 적립률을 곱한다(원인 확정 아님, 참고용 가설).
- 테스트: `npm test`(node --test), `test/refund.test.js`.
- 참고 팀 지식: docs/knowledge/refund-recovery-follows-earn-rule.md, points-earn-excludes-shipping-floor.md, points-earn-saved-orders-not-recomputed.md (모두 기준 브랜치에 아직 없음).
```

## 필요한 산출물

없음
