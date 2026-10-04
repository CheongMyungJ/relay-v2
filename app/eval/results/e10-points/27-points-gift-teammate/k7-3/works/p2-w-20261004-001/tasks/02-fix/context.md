# relay task 컨텍스트

앱이 task를 시작할 때 쓴 파일이다. 스킬의 절차를 따르고, 필요한 값은 이 파일에서 읽는다.

## task 정보

- work_id: w-20261004-001
- task_id: t-02
- 업무 유형: 버그 수정 (`bugfix`)
- node: fix (원인 분석과 수정)
- skill: fix
- 승인된 intent 버전: 1
- task 디렉터리: /tmp/relay-eval/e10-points/27-points-gift-teammate-k7-3/relay-home-2/projects/shop-mate1-ae42bd/works/w-20261004-001/tasks/02-fix
- 작업 브랜치: relay/w-20261004-001
- 기준 브랜치: main
- 기준 커밋: dc4000eaca40cb3bbf926e38cf12ab0d00280fd8

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

#### docs/knowledge/earn-points-rule.md

```markdown
# 적립 포인트는 (상품 금액 - 쿠폰 - 사용 포인트)의 1%를 원 미만 버림한다

- 종류: 규칙
- 적용: src/points/earn.js
- 출처: 사람이 알려 줌(고객센터 기준 237P), 조사로 알아냄, relay Work w-20261004-001, 2026-10-04

- 배송비는 적립 대상이 아니다. 쿠폰 할인과 사용 포인트는 뺀다. 1%의 원 미만은 반올림이 아니라 버린다.
- 예: O-1042는 28,270 - 3,000 - 1,500 = 23,770 → 237.7 → 237P. 배송비 포함(268P)이나 반올림(238P)은 틀리다.
- 이 기준은 O-1042 한 건에서 역산했다. 일반 주문 적립(`earnPoints`)에 적용했다.
- 부분 환불 회수(`src/orders/refund.js`)는 아직 반올림(`percentOf`)이라 기준이 다르다.
```

#### docs/knowledge/gift-points-do-not-touch.md

```markdown
# 선물하기 적립(src/gift/gift-points.js)은 다른 팀과 함께 보고 있어 손대지 않는다

- 종류: 규칙
- 적용: src/gift/gift-points.js
- 출처: 사람이 알려 줌, relay Work w-20261004-001, 2026-10-04

- 일반 주문 적립 버그를 고칠 때 선물하기 적립 코드는 수정하지 않는다. 다른 팀과 협의가 필요하다.
- 선물하기 적립은 여전히 `percentOf(total)`(배송비 포함, 반올림)이라 같은 기준 문제가 남아 있을 수 있다 (예: G-0213 249P).
```

#### docs/knowledge/keep-earned-points-stored.md

```markdown
# 이미 적립된 포인트는 다시 계산하지 않고 주문에 저장된 값을 쓴다

- 종류: 규칙
- 적용: src/orders/order.js, src/orders/refund.js, src/points/
- 출처: 사람이 알려 줌, relay Work w-20261004-001, 2026-10-04

- 주문을 만들 때 계산한 `order.points.earned`는 저장값이다. 이미 적립된 주문은 계산 기준이 바뀌어도 다시 계산하지 않고 저장값을 그대로 쓴다.
- 예: 전체 취소의 회수 포인트는 `order.points.earned`를 쓴다.
- 계산 기준을 고치면 앞으로 만드는 주문에만 적용된다.
```

#### docs/knowledge/receipt-text-unchanged.md

```markdown
# 영수증 글자(src/format/)는 바뀌면 안 된다

- 종류: 규칙
- 적용: src/format/
- 출처: 사람이 알려 줌, relay Work w-20261004-001, 2026-10-04

- 영수증 출력 글자 형식은 계산 버그를 고칠 때도 그대로 둔다. 금액 계산을 고쳐 숫자가 달라지는 것은 괜찮지만 줄 이름, 간격, 단위 표기는 바꾸지 않는다.
- 확인: 수정 전후 `node src/cli.js examples/O-1042.json` 출력을 비교해 값이 바뀐 줄만 다른지 본다.
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
선물하기 주문 G-0213(`examples/G-0213.json`)의 적립 예정 포인트가 고객센터 계산(218P)과 같게 나오도록 고친다. 같은 상품을 일반 주문으로 샀을 때와도 같아야 한다.

## 비목표
- 이미 적립된 포인트는 다시 계산하지 않는다. 저장된 `order.points.earned` 값을 그대로 쓴다. 바뀐 기준은 앞으로 만드는 주문에만 적용된다.
- 선물 메시지 카드, 받는 사람 정보는 바꾸지 않는다.
- 영수증 글자(`src/format/`)의 줄 이름, 간격, 단위 표기는 바꾸지 않는다.
- 부분 환불 회수(`src/orders/refund.js`)의 계산 기준은 바꾸지 않는다.

## 원하는 결과
- G-0213의 적립 예정이 249P가 아니라 218P로 나온다.
- 선물하기 적립이 일반 주문 적립과 같은 기준으로 계산된다.
- 메시지 카드, 받는 사람 정보, 영수증 글자 형식, 이미 적립된 포인트는 그대로다.

## 완료조건
- [ ] `node src/cli.js examples/G-0213.json`의 적립 예정이 218P로 나온다 (재현 절차가 더 이상 실패하지 않는다)
- [ ] `npm test`가 통과한다
- [ ] 기존 테스트를 약화하거나 삭제하지 않는다
- [ ] 선물하기 적립 기준을 확인하는 테스트가 추가되어 있다 (G-0213 = 218P)
- [ ] 수정 전후 `node src/cli.js examples/G-0213.json` 출력을 비교하면 값이 바뀐 줄만 다르다
- [ ] 선물하기 주문의 메시지 카드와 받는 사람 정보 검증은 그대로 동작한다
- [ ] 이미 만들어진 주문의 `order.points.earned`를 다시 계산하는 코드가 추가되지 않는다

## 제약
- (팀 지식 `docs/knowledge/receipt-text-unchanged.md`) 영수증 글자 형식은 그대로 둔다. 숫자가 달라지는 것은 괜찮다.
- (팀 지식 `docs/knowledge/keep-earned-points-stored.md`) 이미 적립된 포인트는 다시 계산하지 않고 주문에 저장된 값을 쓴다.
- (팀 지식 `docs/knowledge/gift-points-do-not-touch.md`) `src/gift/gift-points.js`는 다른 팀과 협의가 필요해 수정하지 않는 것이 원래 규칙이다. 이번 Work는 사람이 수정을 허용했다. 협의가 끝났는지는 확인되지 않았다.

## 추가 의견
- 사람은 협의 여부를 확인하지 못했고, 일반 주문 쪽은 동료가 고객센터와 맞췄다고 들었다. 그 동료는 휴가 중이다. 사람이 수정을 허용했다.
```

## Work 요청 원문

경로: /tmp/relay-eval/e10-points/27-points-gift-teammate-k7-3/relay-home-2/projects/shop-mate1-ae42bd/works/w-20261004-001/request.md

## 결정 로그

```markdown
## t-01 intake — 2026-10-04 05:52 (사람 승인)
- [사람] src/gift/gift-points.js 수정을 이번 Work에서 허용한다 — 팀 지식은 수정 금지(다른 팀 협의 필요)지만, 사람이 근거를 확인한 뒤 수정 허용을 직접 골랐다
```

## 누적 기각 목록

없음

## 직전 handoff (t-01 intake)

```markdown
---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "src/gift/gift-points.js 수정을 이번 Work에서 허용한다"
    why: "팀 지식은 수정 금지(다른 팀 협의 필요)지만, 사람이 근거를 확인한 뒤 수정 허용을 직접 골랐다"
    by: human
assumptions:
  - "선물하기 적립도 일반 주문과 같은 기준((상품 금액 - 쿠폰 - 사용 포인트)의 1%, 원 미만 버림)을 쓴다. 근거는 고객센터 218P 한 건이다"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "다른 팀과의 협의가 끝났는지 확인되지 않았다. 협의 대상 팀과 담당자도 레포에 없다. 사람은 이 상태로 수정을 허용했다"
  - "일반 주문 기준은 O-1042 한 건에서 역산했다. 선물하기에 같은 기준을 쓰라는 규정은 레포에 없다"
  - "부분 환불 회수(src/orders/refund.js)는 아직 반올림(percentOf)이라 기준이 다르다. 선물하기 주문을 환불하면 회수 포인트와 적립 포인트의 기준이 어긋날 수 있다"
recommended_next: null
knowledge_candidates:
  - "선물하기 적립(src/gift/gift-points.js)은 사람이 허용해 이번 Work에서 수정하기로 했다. 다른 팀과의 협의 여부는 확인되지 않았다 (사람)"
  - "고객센터가 G-0213의 적립 기준을 218P로 계산한다. 선물하기도 일반 주문과 같은 기준을 쓰는 것으로 본다 (사람)"
---
## 요약
G-0213 적립 예정이 249P로 나오는 문제를 고치는 intent 초안을 썼다. 목표는 218P다. 협의 여부가 확인되지 않은 gift-points.js 수정은 사람이 허용했다.
## 다음 task가 알아야 할 것
- 참고(내 추정, 확인 안 됨): `src/gift/gift-points.js:6`은 `percentOf(order.amounts.total, 1)`이다. total에는 배송비 3,000원이 들어 있고 반올림한다. 24,860 × 1% = 248.6 → 249P이다. 일반 주문 기준으로는 (24,860 - 2,000 - 1,000) × 1% = 218.6 → 218P이다.
- 일반 주문 기준 구현은 `src/points/earn.js`의 `earnPoints`이다. 선물하기 주문 생성은 `src/gift/gift-order.js`이고 `order.points.earned`를 `giftPoints(order)`로 채운다.
- 기존 테스트는 `test/gift.test.js`에서 30,000원 무료 배송 주문의 300P를 확인한다. `npm test`로 실행한다.
- 영수증 비교는 `node src/cli.js examples/G-0213.json`을 수정 전후로 돌려 본다.
- 참고 지식: `docs/knowledge/earn-points-rule.md`, `gift-points-do-not-touch.md`, `keep-earned-points-stored.md`, `receipt-text-unchanged.md`.
```

## 필요한 산출물

없음
