# relay task 컨텍스트

앱이 task를 시작할 때 쓴 파일이다. 스킬의 절차를 따르고, 필요한 값은 이 파일에서 읽는다.

## task 정보

- work_id: w-20261004-001
- task_id: t-02
- 업무 유형: 버그 수정 (`bugfix`)
- node: fix (원인 분석과 수정)
- skill: fix
- 승인된 intent 버전: 1
- task 디렉터리: /tmp/relay-eval/e10-points/27-points-gift-teammate-k8-3/relay-home-2/projects/shop-mate1-adbe19/works/w-20261004-001/tasks/02-fix
- 작업 브랜치: relay/w-20261004-001
- 기준 브랜치: main
- 기준 커밋: 34153308db0130a19ed945054f1b617521d293fe

## 승인 방식

자동 승인 (task를 시작할 때의 설정. 설정은 바로 적용되고, 자동 승인 여부는 턴이 끝날 때의 설정으로 정한다)

## 마무리 안내 문구

산출물과 handoff를 썼습니다. 오른쪽 패널에서 확인하고 [승인]을 누르세요. 자동 승인이 켜져 있으면 조건을 만족할 때 카운트다운 뒤 승인되고, 멈추려면 [취소]를 누르세요. 고칠 점은 여기에 말해 주세요.

## 질문 방식

초안 우선 (`draft_first`)

## 팀 지식

레포의 `docs/knowledge/`에 팀이 앞선 일에서 남긴 지식이다. 사람이 알려 준 규칙과 사실, 앞선 조사에서 알아낸 것이다.

- 이 일에 해당하는 항목은 팀이 이미 아는 사실이다. 같은 내용을 사람에게 다시 묻지 않는다. 사람이 정한 규칙과 관례는 수정 방향을 정할 때 따르고 `decisions`에 남긴다(`by: ai`, `why`에 항목 경로). 실패 유형은 먼저 확인해 볼 가설로 쓰고, 이 코드에서 확인한 뒤에만 원인으로 삼는다.
- 항목의 `## 규칙`(또는 `## 내용`)만 규칙과 사실이다. `## 아직 규칙을 따르지 않는 곳`은 아직 고치지 않은 코드, 곧 고칠 대상이다. 그 절이 없는 옛 형식의 항목은 글 전체를 읽는다.
- 규칙이 이번 경우에도 통하는지는 규칙의 말로 판단한다. 말이 이번 경우를 덮으면 그대로 따른다. 확인하려고 같은 규칙을 다시 묻거나 가정으로 남겨 사람에게 되묻지 않는다.
- 항목에 적힌 코드의 위치나 모양은 다른 Work의 것이라 지금 코드와 다를 수 있다. 다르면 지금 코드를 보고, 규칙과 사실은 그대로 따른다. 규칙이 사람의 지금 말과 어긋날 때만 묻는다. 해당하지 않는 항목은 무시한다.

### 항목

#### docs/knowledge/format/receipt-text-frozen.md

```markdown
---
kind: rule
source: human
---
# 영수증 글자(src/format/)는 바꾸지 않는다

## 규칙
- 금액이나 포인트 계산을 고치는 일에서도 `src/format/`의 영수증 글자는 바뀌면 안 된다. 값만 바뀌고 글자 모양은 그대로여야 한다.

## 바뀐 이력
- 2026-10-04 처음 남김 (Work w-20261004-001)
```

#### docs/knowledge/gift/gift-points-hands-off.md

```markdown
---
kind: rule
source: human
anchor: giftPoints
---
# 선물하기 적립(src/gift/gift-points.js)은 다른 팀과 같이 보는 중이라 건드리지 않는다

## 규칙
- `src/gift/gift-points.js`는 수정하지 않는다. 그래서 공용 `percentOf`(`src/money.js`)도 바꾸지 않고, 일반 주문 적립은 `src/points/earn.js`에서만 계산한다.

## 아직 규칙을 따르지 않는 곳
- `src/gift/gift-points.js`: 일반 주문 적립과 달리 배송비 포함 반올림이다. 같은 규칙으로 맞출지는 다른 팀과 정해야 한다.

## 바뀐 이력
- 2026-10-04 처음 남김 (Work w-20261004-001)
```

#### docs/knowledge/points/earn-base-and-rounding.md

```markdown
---
kind: rule
source: investigation
anchor: earnPoints
---
# 적립 예정 포인트는 배송비를 뺀 결제 금액의 1%이고 1P 미만은 버린다

## 규칙
- `earnPoints`(`src/points/earn.js`)는 `amounts.total - amounts.shipping`에 `POINT_RATE_PERCENT`%를 곱하고 `Math.floor`로 버린다.
- O-1042: 결제 26,770원 − 배송비 3,000원 = 23,770원 → 237P (반올림이면 238P). 기대값 237P는 고객센터 계산으로 요청에 적혀 있었고, 규칙은 이 한 건에서 역산했다. 다른 주문의 고객센터 값으로는 확인하지 못했다.

## 아직 규칙을 따르지 않는 곳
- `src/orders/refund.js`: 환불 회수 포인트는 `percentOf` 반올림이라 적립(버림)과 1P 어긋날 수 있다.
- `src/gift/gift-points.js`: 배송비 포함 반올림이다. 다른 팀과 같이 보는 중이라 수정 금지.

## 바뀐 이력
- 2026-10-04 처음 남김 (Work w-20261004-001)
```

#### docs/knowledge/points/stored-points-not-recalculated.md

```markdown
---
kind: rule
source: human
---
# 이미 적립된 포인트는 주문에 저장된 값을 쓰고 다시 계산하지 않는다

## 규칙
- 영수증, 환불, 포인트 내역은 주문에 저장된 `points.earned`를 그대로 쓴다. 적립 규칙이 바뀌어도 이미 적립된 값을 다시 계산하지 않는다.
- 적립 계산(`earnPoints`)은 주문을 만들 때(`createOrder`) 한 번만 한다.

## 바뀐 이력
- 2026-10-04 처음 남김 (Work w-20261004-001)
```

### 지식 후보 남기기

handoff의 `knowledge_candidates`에, 이 task에서 알게 된 것 가운데 다음 일에도 쓸 사실을 한 줄에 하나씩 적는다. 다음 verify가 이것을 보고 레포에 지식으로 남긴다.

- 남길 것: 사람이 알려 준 규칙, 관례, 업무 사실(예: 업무 규정, 팀이 정한 방식, 언제 무엇을 왜 바꿨나), 코드만 보고는 다시 알기 어려운 사실, 다시 겪을 만한 실패 유형과 그 위치. 사람이 말한 것은 뜻을 살려 그대로 적고 끝에 "(사람)"을 붙인다.
- 사람이 요청이나 답에서 "늘 이렇게 한다", "이건 해결이 아니다"처럼 이번 일을 넘어 통하는 규칙을 말했으면, 이번 Work의 비목표나 제약으로 옮겼더라도 후보로 적는다.
- 남기지 않을 것: 이번 일에만 해당하는 것, 코드와 커밋에 이미 드러난 것, 비밀(토큰, 비밀번호, 내부 주소)과 개인정보. "이 규칙이 저기에도 통하는지 모른다"처럼 모른다는 것만 담은 메모도 후보가 아니다.
- 사람의 지금 말이 위 항목과 어긋나면(값이나 규칙이 바뀌었으면) "고칠 지식: <경로> — <새 내용> (사람)"으로 후보에 적는다. verify가 그 항목을 고친다.

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
선물하기 주문 G-0213(`examples/G-0213.json`)의 적립 예정 포인트(현재 249P)가 같은 상품을 일반 주문으로 샀을 때와 같은 기준(배송비를 뺀 결제 금액의 1%, 1P 미만 버림)으로 나오게 고친다.

## 비목표
- `src/gift/gift-points.js`와 공용 `percentOf`(`src/money.js`)는 수정하지 않는다.
- 선물 메시지 카드, 받는 사람 정보, 영수증 글자(`src/format/`)는 바꾸지 않는다.
- 이미 적립된 포인트(주문에 저장된 `points.earned`)는 다시 계산하지 않는다.
- 환불 회수 포인트(`src/orders/refund.js`)는 이번 범위가 아니다.

## 원하는 결과
G-0213의 적립 예정 포인트가 일반 주문과 같은 규칙(`earnPoints` 기준)으로 계산된다. 값만 바뀌고 영수증 글자 모양은 그대로다.

## 완료조건
- [ ] 재현 절차(G-0213의 적립 예정 포인트 확인)가 더 이상 실패하지 않는다
- [ ] `npm test`가 통과한다
- [ ] 기존 테스트를 약화하거나 삭제하지 않는다
- [ ] G-0213의 적립 예정 포인트가 `earnPoints` 규칙(배송비 제외, 1P 미만 버림)으로 계산한 값과 같다
- [ ] `src/gift/gift-points.js`, `src/money.js`, `src/format/`에 변경이 없다
- [ ] 이미 저장된 `points.earned` 값을 다시 계산하는 코드가 추가되지 않는다

## 제약
- (팀 지식 `docs/knowledge/gift/gift-points-hands-off.md`) `src/gift/gift-points.js`는 수정하지 않는다. 공용 `percentOf`도 바꾸지 않고, 일반 주문 적립은 `src/points/earn.js`에서만 계산한다. (사람이 이번에도 유지하기로 확인)
- (팀 지식 `docs/knowledge/format/receipt-text-frozen.md`) `src/format/`의 영수증 글자는 바뀌면 안 된다.
- (팀 지식 `docs/knowledge/points/stored-points-not-recalculated.md`) 적립 계산은 주문 생성 시 한 번만 하고, 저장된 값은 다시 계산하지 않는다.

## 추가 의견
- (사람 추정, 확인 안 됨) 요청은 포인트 계산이 `src/gift/gift-points.js`에 있다고 보고 있다. 단, 같은 파일을 고치라는 요청과 수정 금지 규칙이 충돌해 사람이 수정 금지 유지로 정했다.
```

## Work 요청 원문

경로: /tmp/relay-eval/e10-points/27-points-gift-teammate-k8-3/relay-home-2/projects/shop-mate1-adbe19/works/w-20261004-001/request.md

## 결정 로그

```markdown
## t-01 intake — 2026-10-04 05:47 (사람 승인)
- [사람] src/gift/gift-points.js를 수정하지 않고, 그 밖에서 해결 방법을 찾는다 — 요청은 이 파일 수정을 말하지만 팀 규칙은 수정 금지. 사람이 금지 유지를 택함
```

## 누적 기각 목록

- t-01 intake: gift-points.js 직접 수정: 팀 규칙으로 금지, 사람이 유지 확인

## 직전 handoff (t-01 intake)

```markdown
---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "src/gift/gift-points.js를 수정하지 않고, 그 밖에서 해결 방법을 찾는다"
    why: "요청은 이 파일 수정을 말하지만 팀 규칙은 수정 금지. 사람이 금지 유지를 택함"
    by: human
assumptions:
  - "G-0213의 기대값은 일반 주문과 같은 규칙(배송비 제외, 1P 미만 버림)의 값이다"
rejected:
  - "gift-points.js 직접 수정: 팀 규칙으로 금지, 사람이 유지 확인"
open_questions: []
intent_deviation: null
risks:
  - "gift-points.js와 percentOf를 못 건드리므로 호출 쪽에서 우회가 필요할 수 있고, 불가능하면 fix에서 blocked가 될 수 있다"
recommended_next: null
knowledge_candidates:
  - "선물하기 적립 수정 요청이 와도 gift-points.js는 이번에도 수정 금지로 유지하기로 했다 (사람)"
---
## 요약
G-0213 선물 적립 예정 포인트(249P)를 일반 주문 규칙으로 맞추는 버그 수정 의도를 정리했다. gift-points.js 수정 금지는 사람이 유지하기로 했다.
## 다음 task가 알아야 할 것
- `src/gift/gift-points.js`: `percentOf(order.amounts.total, ...)`, 배송비 포함 반올림. 수정 금지.
- `src/points/earn.js`: 기준 구현(배송비 제외, `Math.floor`).
- 테스트: `npm test` (`node --test`).
- 참고 지식: `docs/knowledge/points/earn-base-and-rounding.md`, `docs/knowledge/gift/gift-points-hands-off.md`
- giftPoints를 부르는 곳을 fix에서 찾아, 파일 밖에서 바로잡을 수 있는지 먼저 확인할 것.
```

## 필요한 산출물

없음
