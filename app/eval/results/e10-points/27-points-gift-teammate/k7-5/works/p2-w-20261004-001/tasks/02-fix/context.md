# relay task 컨텍스트

앱이 task를 시작할 때 쓴 파일이다. 스킬의 절차를 따르고, 필요한 값은 이 파일에서 읽는다.

## task 정보

- work_id: w-20261004-001
- task_id: t-02
- 업무 유형: 버그 수정 (`bugfix`)
- node: fix (원인 분석과 수정)
- skill: fix
- 승인된 intent 버전: 1
- task 디렉터리: /tmp/relay-eval/e10-points/27-points-gift-teammate-k7-5/relay-home-2/projects/shop-mate1-0989a7/works/w-20261004-001/tasks/02-fix
- 작업 브랜치: relay/w-20261004-001
- 기준 브랜치: main
- 기준 커밋: 071a409a523f24935776050ac0d36ddbc4d1448e

## 승인 방식

자동 승인 (task를 시작할 때의 설정. 설정은 바로 적용되고, 자동 승인 여부는 턴이 끝날 때의 설정으로 정한다)

## 마무리 안내 문구

산출물과 handoff를 썼습니다. 오른쪽 패널에서 확인하고 [승인]을 누르세요. 자동 승인이 켜져 있으면 조건을 만족할 때 카운트다운 뒤 승인되고, 멈추려면 [취소]를 누르세요. 고칠 점은 여기에 말해 주세요.

## 질문 방식

초안 우선 (`draft_first`)

## 팀 지식

레포의 `docs/knowledge/`에 팀이 앞선 일에서 남긴 지식이다. 사람이 알려 준 규칙과 사실, 앞선 조사에서 알아낸 것이다.

- 이 일에 해당하는 항목은 팀이 이미 아는 사실이다. 같은 내용을 사람에게 다시 묻지 않는다. 사람이 정한 규칙과 관례는 수정 방향을 정할 때 따르고 `decisions`에 남긴다(`by: ai`, `why`에 항목 경로). 실패 유형은 먼저 확인해 볼 가설로 쓰고, 이 코드에서 확인한 뒤에만 원인으로 삼는다.
- 규칙이 이번 경우에도 통하는지는 규칙의 말로 판단한다. 말이 이번 경우를 덮으면 그대로 따른다. 확인하려고 같은 규칙을 다시 묻거나 가정으로 남겨 사람에게 되묻지 않는다.
- 항목에 적힌 코드의 위치나 모양은 다른 Work의 것이라 지금 코드와 다를 수 있다. 다르면 지금 코드를 보고, 규칙과 사실은 그대로 따른다. 규칙이 사람의 지금 말과 어긋날 때만 묻는다. 해당하지 않는 항목은 무시한다.

### 항목

#### docs/knowledge/gift-points-hands-off.md

```markdown
# 선물하기 적립(src/gift/gift-points.js)은 다른 팀과 같이 보고 있어 손대지 않는다

- 종류: 규칙
- 적용: src/gift/gift-points.js, 공유 함수 percentOf(src/money.js)
- 출처: 사람이 알려 줌, relay Work w-20261004-001, 2026-10-04

선물하기 적립은 다른 팀과 함께 보는 중이라 일반 주문 수정에서 바꾸지 않는다.
`percentOf`는 gift-points.js와 refund.js가 공유하므로 고치면 선물하기 적립도 바뀐다. 일반 주문은 earn.js 안에서만 계산한다.
(선물하기는 지금 배송비 포함·반올림 기준이 남아 있다. 바꾸려면 그 팀과 먼저 정한다.)
```

#### docs/knowledge/no-recalc-saved-points.md

```markdown
# 이미 적립된 포인트는 다시 계산하지 않고 주문에 저장된 값을 쓴다

- 종류: 규칙
- 적용: src/orders/order.js, src/orders/refund.js, 포인트 적립 계산 전반
- 출처: 사람이 알려 줌, relay Work w-20261004-001, 2026-10-04

적립 계산 규칙을 바꿔도 이미 저장된 주문의 `points.earned`는 재계산하거나 바꾸지 않는다.
영수증·환불·포인트 내역은 주문을 만들 때 저장한 값을 쓴다. 새 규칙은 새로 만드는 주문에만 적용된다.
```

#### docs/knowledge/receipt-text-unchanged.md

```markdown
# 영수증 글자(src/format/)는 앱과 메일이 그대로 보여 주므로 바뀌면 안 된다

- 종류: 규칙
- 적용: src/format/
- 출처: 사람이 알려 줌, relay Work w-20261004-001, 2026-10-04

영수증 출력 문자열은 앱과 메일이 그대로 보여 준다. 계산 버그를 고칠 때도 형식 코드는 건드리지 않고 계산 쪽에서 고친다.
```

#### docs/knowledge/regular-order-points-rule.md

```markdown
# 일반 주문 적립은 배송비를 뺀 결제 금액에 적립률을 곱하고 원 단위로 버린다

- 종류: 규칙
- 적용: src/points/earn.js (일반 주문 O-), POINT_RATE_PERCENT(src/config.js)
- 출처: 조사로 알아냄(고객센터 기준 237P에서 역산), relay Work w-20261004-001, 2026-10-04

적립 = floor((상품 - 쿠폰 - 사용 포인트) × 적립률 / 100). 배송비는 뺀다.
예: O-1042는 23,770원 × 1% = 237.7 → 237P. 배송비 포함 26,770원 반올림은 268P로 틀리다.
배송비만 빼고 반올림하면 238, 포함하고 버림하면 267이라 둘 다 필요하다.
환불 회수(src/orders/refund.js의 부분 환불)는 아직 반올림이라 1P 어긋날 수 있다.
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
선물하기 주문의 적립 예정 포인트를 일반 주문과 같은 기준으로 계산한다. 고객센터 기준으로 G-0213은 218P여야 하는데 지금은 249P로 나온다.

## 비목표
- `percentOf`(src/money.js)와 일반 주문 적립(src/points/earn.js)은 바꾸지 않는다.
- 환불 회수(src/orders/refund.js)의 반올림은 고치지 않는다.
- 선물 메시지 카드, 받는 사람 정보, 영수증 글자(src/format/)는 바꾸지 않는다.
- 이미 저장된 주문의 `points.earned`는 재계산하거나 바꾸지 않는다.

## 원하는 결과
선물하기 적립이 일반 주문 기준(배송비를 뺀 결제 금액 × 적립률, 원 단위 버림)으로 계산된다. 변경은 src/gift/gift-points.js 안에서만 한다. 기준은 일반 주문 쪽 코드(동료가 고객센터와 맞춰 둔 것)다. 새로 만드는 선물 주문부터 적용된다.

## 완료조건
- [ ] 재현 절차가 더 이상 실패하지 않는다 (examples/G-0213.json으로 선물 주문을 만들면 적립이 218P)
- [ ] `npm test`가 통과한다
- [ ] 기존 테스트를 약화하거나 삭제하지 않는다
- [ ] 일반 주문 적립 결과(earnPoints)와 같은 상품·금액의 선물 주문 적립 결과가 같다
- [ ] src/gift/gift-points.js 외의 소스 파일(src/money.js, src/format/ 등)은 바뀌지 않는다
- [ ] 선물 메시지와 받는 사람 정보, 영수증 출력은 수정 전과 같다

## 제약
- (팀 지식 docs/knowledge/gift-points-hands-off.md) 선물하기 적립은 다른 팀과 같이 보는 중이고, `percentOf`는 gift-points.js와 refund.js가 공유하므로 고치지 않는다. 사람이 이번 Work에서 gift-points.js 수정을 허용했다.
- (팀 지식 docs/knowledge/no-recalc-saved-points.md) 이미 적립된 포인트는 다시 계산하지 않고 주문에 저장된 값을 쓴다.
- (팀 지식 docs/knowledge/receipt-text-unchanged.md) 형식 코드(src/format/)는 건드리지 않고 계산 쪽에서 고친다.

## 추가 의견
- (사람 추정, 확인 안 됨) src/gift/gift-points.js 쪽 문제로 보인다.
- 다른 팀과 선물하기 적립 변경을 합의했는지는 사람도 모른다. 사람이 수정을 허용했다.
```

## Work 요청 원문

경로: /tmp/relay-eval/e10-points/27-points-gift-teammate-k7-5/relay-home-2/projects/shop-mate1-0989a7/works/w-20261004-001/request.md

## 결정 로그

```markdown
## t-01 intake — 2026-10-04 06:39 (사람 승인)
- [사람] 이번 Work에서 src/gift/gift-points.js 수정을 허용한다. 다른 파일은 건드리지 않는다 — 팀 지식은 손대지 말라고 하지만, 사람이 이 일을 gift-points.js 수정으로 맡았다고 명시적으로 허용함
- [사람] 적립 기준은 일반 주문 코드(earn.js)를 따른다. G-0213은 218P — 사람이 적립 규칙을 자세히 모르고, 동료가 고객센터와 맞춘 일반 주문 코드를 기준으로 하라고 함
```

## 누적 기각 목록

없음

## 직전 handoff (t-01 intake)

```markdown
---
status: "awaiting_approval"
blocked_reason:
decisions:
  - what: "이번 Work에서 src/gift/gift-points.js 수정을 허용한다. 다른 파일은 건드리지 않는다"
    why: "팀 지식은 손대지 말라고 하지만, 사람이 이 일을 gift-points.js 수정으로 맡았다고 명시적으로 허용함"
    by: human
  - what: "적립 기준은 일반 주문 코드(earn.js)를 따른다. G-0213은 218P"
    why: "사람이 적립 규칙을 자세히 모르고, 동료가 고객센터와 맞춘 일반 주문 코드를 기준으로 하라고 함"
    by: human
assumptions:
  - "다른 팀과의 합의 여부는 확인되지 않았다. 사람의 허용을 따라 진행한다"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "선물하기 적립은 다른 팀이 같이 보는 중이라 이번 변경이 그 팀의 작업과 충돌할 수 있다"
  - "환불 회수(refund.js)는 반올림이라 선물 주문 환불 시 1P 어긋날 수 있다. 이번 범위 밖이다"
recommended_next: null
knowledge_candidates:
  - "선물하기 적립 계산(src/gift/gift-points.js)을 일반 주문 기준(배송비 제외, 원 단위 버림)으로 맞추는 것은 사람이 이번 Work에서 허용했다. 다른 팀과의 합의 여부는 사람도 모른다 (사람)"
---
## 요약
G-0213의 적립을 일반 주문과 같은 기준으로 맞추는 버그 수정 intent를 작성했다. 범위는 gift-points.js 안으로 한정했고, 사람이 수정을 허용했다.
## 다음 task가 알아야 할 것
- `src/gift/gift-points.js:5`: `percentOf(order.amounts.total, ...)`로 배송비를 포함하고 반올림한다.
- `src/points/earn.js:5`: 일반 주문 기준은 `floor((total - shipping) * 비율 / 100)`이다.
- G-0213: 상품 24,860 − 쿠폰 2,000 − 포인트 1,000 = 21,860원. 1%는 218P. 배송비를 포함하면 249P다.
- `percentOf`는 refund.js와 공유하므로 건드리지 않는다.
- 참고 팀 지식: docs/knowledge/regular-order-points-rule.md
- 테스트: `npm test`, 선물 테스트는 test/gift.test.js
```

## 필요한 산출물

없음
