# relay task 컨텍스트

앱이 task를 시작할 때 쓴 파일이다. 스킬의 절차를 따르고, 필요한 값은 이 파일에서 읽는다.

## task 정보

- work_id: w-20261004-001
- task_id: t-03
- 업무 유형: 버그 수정 (`bugfix`)
- node: verify (리뷰와 검증)
- skill: verify
- 승인된 intent 버전: 1
- task 디렉터리: /tmp/relay-eval/e10-points/27-points-gift-teammate-k7-3/relay-home-2/projects/shop-mate1-ae42bd/works/w-20261004-001/tasks/03-verify
- 작업 브랜치: relay/w-20261004-001
- 기준 브랜치: main
- 기준 커밋: dc4000eaca40cb3bbf926e38cf12ab0d00280fd8

## 승인 방식

수동 승인 (의도 승인, Work 완료는 늘 수동)

## 마무리 안내 문구

산출물과 handoff를 썼습니다. 오른쪽 패널에서 확인하고 [완료만], [push] 중 하나를 누르세요. [이 단계 끝나면 멈춤]이 켜져 있거나 이전 단계를 추천했으면 [승인하고 멈춤]을 누르고, 전달은 멈춘 뒤 Work 완료 화면에서 고르세요. 고칠 점은 여기에 말해 주세요.

## 질문 방식

초안 우선 (`draft_first`)

## 팀 지식

레포의 `docs/knowledge/`에 팀이 앞선 일에서 남긴 지식이다. 사람이 알려 준 규칙과 사실, 앞선 조사에서 알아낸 것이다.

- 이 일에 해당하는 항목은 팀이 이미 아는 사실이다. 같은 내용을 사람에게 다시 묻지 않는다. 리뷰할 때 변경이 그 항목을 어기는지도 본다.
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

### 지식 남기기 (이 단계에서 할 일)

공통 종료 절차의 커밋 전에, 이 Work에서 알게 된 것 가운데 다음 일에도 쓸 사실을 레포의 `docs/knowledge/`에 남기고 코드와 함께 커밋한다. 팀이 PR로 함께 보고, 다음 일의 에이전트가 읽는다. 재료는 아래 지식 후보, Work 요청 원문(`request.md`), intent의 `비목표`와 `제약`, 결정 로그의 사람 결정(`by: human`), 이 task에서 사람이 한 말이다.

- 남길 것: 사람이 알려 준 규칙, 관례, 업무 사실(언제 무엇을 왜 바꿨나 등), 코드만 보고는 다시 알기 어려운 사실, 다시 겪을 만한 실패 유형과 그 위치.
- 사람이 요청이나 답에서 이번 일을 넘어 통하는 규칙을 말했으면(예: "금액은 늘 원 단위로 내림한다", "외부 API 응답은 캐시하지 않는다"), intent에 이번 Work의 비목표나 제약으로 들어가 있어도 지식으로 남긴다. 다음 일의 사람은 같은 말을 다시 하지 않아도 되어야 한다.
- 규칙과 사실, 그 까닭을 쓴다. 코드의 지금 모양(어느 함수가 무엇을 쓰는지)은 이 Work가 바꿨을 수 있고 기준 브랜치에는 아직 없을 수 있으니 "관련 위치"로만 적고 "이렇게 되어 있다"고 쓰지 않는다.
- 남기지 않을 것: 이번 일에만 해당하는 것, 코드와 커밋에 이미 드러난 것, 비밀(토큰, 비밀번호, 내부 주소)과 개인정보. "이 규칙이 저기에도 통하는지 모른다"처럼 모른다는 것만 담은 항목은 만들지 않는다(다음 일이 같은 것을 다시 묻게 만든다).
- 지식 후보 가운데 "(사람)"이 붙은 것은 이번 일에만 해당하지 않는 한 모두 남긴다.
- 사람이 알려 준 규칙은 하나도 빠뜨리지 않는다. 규칙이 여럿이면(예: 계산 규칙과 적용 순서) 항목을 나눈다.
- 한 항목에 파일 하나. 파일 이름은 내용을 나타내는 영어 소문자와 `-` (예: `no-cache-external-api.md`). 같은 내용의 파일이 이미 있으면 새로 만들지 말고 그 파일을 고친다.
- 무엇이 맞고 무엇이 틀린지, 예와 수치를 적는다. 다음 사람이 이 파일만 읽고 따를 수 있어야 한다.
- 위 항목 가운데 "기준 브랜치에는 아직 없다"고 적힌 것은 이 worktree에 파일이 없다. 그 항목을 고쳐야 할 때만 같은 경로에 앞 내용을 모두 살려 고친 파일을 쓰고(머지하면 이 Work의 파일이 남는다), 고칠 것이 없으면 그 파일을 만들지 않는다.
- 남긴 파일은 handoff의 `## 요약` 끝에 "남긴 지식: <경로>"로 적는다. 남길 것이 없으면 "남긴 지식: 없음 (까닭)"으로 적는다. 앱이 이 줄을 확인한다.

파일 형식:

```markdown
# <한 줄 제목: 규칙이나 사실>

- 종류: 규칙 | 사실 | 이력 | 실패 유형
- 적용: <관련 경로나 영역>
- 출처: <사람이 알려 줌 / 조사로 알아냄>, relay Work w-20261004-001, 2026-10-04

<본문: 5줄 안팎>
```

#### 앞 task들의 지식 후보

- t-01 intake: 선물하기 적립(src/gift/gift-points.js)은 사람이 허용해 이번 Work에서 수정하기로 했다. 다른 팀과의 협의 여부는 확인되지 않았다 (사람)
- t-01 intake: 고객센터가 G-0213의 적립 기준을 218P로 계산한다. 선물하기도 일반 주문과 같은 기준을 쓰는 것으로 본다 (사람)
- t-02 fix: 선물하기 적립(src/gift/gift-points.js)은 이제 earnPoints를 호출해 일반 주문과 같은 기준이다. 사람이 수정을 허용했고 다른 팀과의 협의 여부는 확인되지 않았다 (사람)
- t-02 fix: 배송비가 있는 주문에서만 적립 기준 차이(total vs 상품-쿠폰-포인트)가 드러난다. 무료 배송 테스트로는 놓치기 쉽다

## 선택 가능한 다음 단계

- 기본 다음 단계: Work 완료
- 이전 단계: intake (의도 정리), fix (원인 분석과 수정)

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

## t-02 fix — 2026-10-04 05:55 (자동 승인)
- [AI] giftPoints가 earnPoints를 호출하게 한다 — intent 목표: 일반 주문과 같은 기준. 기준을 한 곳에서 유지하고 팀 지식 earn-points-rule.md를 따른다(docs/knowledge/earn-points-rule.md)
```

## 누적 기각 목록

없음

## 직전 handoff (t-02 fix)

```markdown
---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "giftPoints가 earnPoints를 호출하게 한다"
    why: "intent 목표: 일반 주문과 같은 기준. 기준을 한 곳에서 유지하고 팀 지식 earn-points-rule.md를 따른다(docs/knowledge/earn-points-rule.md)"
    by: ai
assumptions:
  - "선물하기도 일반 주문과 같은 기준을 쓴다는 근거는 고객센터 218P 한 건이다"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "다른 팀과의 협의 여부는 확인되지 않은 채 사람이 gift-points.js 수정을 허용했다"
  - "부분 환불 회수(refund.js)는 여전히 반올림이라 선물하기 주문 환불 시 적립과 회수 기준이 어긋날 수 있다(비목표라 건드리지 않음)"
recommended_next: null
knowledge_candidates:
  - "선물하기 적립(src/gift/gift-points.js)은 이제 earnPoints를 호출해 일반 주문과 같은 기준이다. 사람이 수정을 허용했고 다른 팀과의 협의 여부는 확인되지 않았다 (사람)"
  - "배송비가 있는 주문에서만 적립 기준 차이(total vs 상품-쿠폰-포인트)가 드러난다. 무료 배송 테스트로는 놓치기 쉽다"
---
## 요약
선물하기 적립이 배송비 포함 결제 금액을 반올림하던 것을 일반 주문과 같은 `earnPoints`로 바꿔 G-0213이 218P로 나온다. 재현 테스트를 추가했고 `npm test` 25개 통과.
## 다음 task가 알아야 할 것
- `src/gift/gift-points.js`: `earnPoints(order)` 호출로 변경
- `test/gift.test.js`: G-0213 = 218P 테스트 추가
- `node src/cli.js examples/G-0213.json` 수정 전후 차이는 적립 예정 줄(249P → 218P)뿐
- 이미 만들어진 주문의 `order.points.earned` 재계산 코드는 추가하지 않음
```

## 필요한 산출물

- t-02 fix: /tmp/relay-eval/e10-points/27-points-gift-teammate-k7-3/relay-home-2/projects/shop-mate1-ae42bd/works/w-20261004-001/tasks/02-fix/fix.md
