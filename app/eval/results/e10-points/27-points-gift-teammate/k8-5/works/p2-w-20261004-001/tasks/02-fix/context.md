# relay task 컨텍스트

앱이 task를 시작할 때 쓴 파일이다. 스킬의 절차를 따르고, 필요한 값은 이 파일에서 읽는다.

## task 정보

- work_id: w-20261004-001
- task_id: t-02
- 업무 유형: 버그 수정 (`bugfix`)
- node: fix (원인 분석과 수정)
- skill: fix
- 승인된 intent 버전: 1
- task 디렉터리: /tmp/relay-eval/e10-points/27-points-gift-teammate-k8-5/relay-home-2/projects/shop-mate1-30e229/works/w-20261004-001/tasks/02-fix
- 작업 브랜치: relay/w-20261004-001
- 기준 브랜치: main
- 기준 커밋: 45f5e22812e6a5e4e46794d8d4d65e061269b0df

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

#### docs/knowledge/points/earn-points-formula.md

```markdown
---
kind: rule
source: investigation
anchor: earnPoints
---
# 적립 포인트는 배송비를 뺀 결제 금액의 1%를 1P 미만 버림한 값이다

## 규칙
- 적립 포인트 = floor((결제 금액 `amounts.total` − 배송비 `amounts.shipping`) × `POINT_RATE_PERCENT` / 100). 고객센터 기준 O-1042는 237P (23770 × 1% = 237.7 → 237).
- 정책 문서는 없다. 237P를 고객센터 값에서 거꾸로 맞춘 식이므로, 다른 주문의 정답으로는 검증되지 않았다.
- 공유 도우미 `percentOf`(`src/money.js`)는 반올림이라 적립에 쓰지 않는다. 선물하기와 공유하므로 바꾸지 않는다.

## 아직 규칙을 따르지 않는 곳
- src/orders/refund.js: 부분 환불의 `pointsRecovered`가 `percentOf(refundGoods, POINT_RATE_PERCENT)`(상품 금액 기준, 반올림)라 적립 식과 다르다. 적립보다 1P 더 회수할 수 있다. 환불 정책 확인 후 고친다.

## 바뀐 이력
- 2026-10-04 처음 남김 (Work w-20261004-001)
```

#### docs/knowledge/points/gift-points-hands-off.md

```markdown
---
kind: rule
source: human
anchor: giftPoints
---
# 선물하기 적립(`giftPoints`)은 다른 팀과 협의 전에는 포인트 관련 일에서도 바꾸지 않는다

## 규칙
- `src/gift/gift-points.js`는 다른 팀과 함께 보고 있어 포인트 적립 수정 일에서도 손대지 않는다.

## 아직 규칙을 따르지 않는 곳
- src/gift/gift-points.js: `earnPoints`의 옛 식(배송비 포함, 반올림)을 그대로 써서 같은 과다 적립이 있을 수 있다. 협의 후 `docs/knowledge/points/earn-points-formula.md`의 식에 맞출지 정한다.

## 바뀐 이력
- 2026-10-04 처음 남김 (Work w-20261004-001, 사람이 알려 줌)
```

#### docs/knowledge/points/stored-points-not-recalculated.md

```markdown
---
kind: rule
source: human
---
# 이미 적립된 포인트는 다시 계산하지 않고 주문에 저장된 값을 쓴다

## 규칙
- 주문의 `points.earned`는 주문을 만들 때 한 번만 계산해 저장한다. 계산식이 바뀌어도 이미 적립된 주문은 다시 계산하지 않는다.
- 영수증, 환불(전체 취소), 포인트 내역은 저장된 값을 그대로 쓴다.

## 바뀐 이력
- 2026-10-04 처음 남김 (Work w-20261004-001, 사람이 알려 줌)
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
선물하기 주문 G-0213(`examples/G-0213.json`)의 적립 예정 포인트가 249P로 나오는데, 고객센터 기준 218P여야 한다는 문의를 바로잡는다. 같은 상품을 일반 주문으로 샀을 때와 왜 다른지도 확인해 알린다.

## 비목표
- `src/gift/gift-points.js`(`giftPoints`)는 수정하지 않는다. 다른 팀과 협의 전이다.
- 선물 메시지 카드와 받는 사람 정보는 바꾸지 않는다.
- 영수증 글자(`src/format/`)는 바꾸지 않는다.
- 이미 적립된 포인트는 다시 계산하지 않는다.
- 부분 환불의 `pointsRecovered` 식(`src/orders/refund.js`)은 이번에 고치지 않는다.

## 원하는 결과
- 선물하기 주문 G-0213의 적립 예정 포인트가 218P로 나온다.
- 일반 주문과 선물하기 주문의 적립 포인트가 달랐던 이유가 설명돼 있다.
- 수정은 `giftPoints`를 건드리지 않고 선물 주문을 만드는 쪽(호출부)에서 한다. 사람이 정한 범위다.

## 완료조건
- [ ] 재현 절차가 더 이상 실패하지 않는다 (G-0213의 적립 예정 포인트가 249P가 아니라 218P다)
- [ ] `npm test`가 통과한다
- [ ] 기존 테스트를 약화하거나 삭제하지 않는다
- [ ] `src/gift/gift-points.js`가 변경되지 않았다
- [ ] 선물 메시지, 받는 사람 정보, 영수증 글자(`src/format/`) 출력이 변경 전과 같다
- [ ] 이미 저장된 주문의 `points.earned`를 다시 계산하는 코드가 추가되지 않았다
- [ ] 일반 주문과 선물 주문의 적립 포인트가 달랐던 이유가 fix 결과에 적혀 있다

## 제약
- (팀 지식 `docs/knowledge/points/gift-points-hands-off.md`) `src/gift/gift-points.js`는 다른 팀과 함께 보고 있어 포인트 적립 수정 일에서도 손대지 않는다.
- (팀 지식 `docs/knowledge/points/stored-points-not-recalculated.md`) 주문의 `points.earned`는 주문 생성 때 한 번만 계산해 저장한다. 이미 적립된 주문은 다시 계산하지 않는다.
- (팀 지식 `docs/knowledge/points/earn-points-formula.md`) `percentOf`(`src/money.js`)는 선물하기와 공유하므로 바꾸지 않는다.

## 추가 의견
- 요청에 "관련 코드는 `src/gift/gift-points.js`"라고 돼 있으나, 위 팀 규칙에 따라 수정 대상에서 뺐다. 호출부에서 해결하기로 사람이 골랐다.
```

## Work 요청 원문

경로: /tmp/relay-eval/e10-points/27-points-gift-teammate-k8-5/relay-home-2/projects/shop-mate1-30e229/works/w-20261004-001/request.md

## 결정 로그

```markdown
## t-01 intake — 2026-10-04 06:37 (사람 승인)
- [사람] src/gift/gift-points.js는 그대로 두고 호출부(src/gift/gift-order.js)에서 해결한다 — 팀 규칙(gift-points-hands-off)상 협의 전 수정 금지. 사람이 이 범위를 골랐다
```

## 누적 기각 목록

- t-01 intake: gift-points.js 직접 수정: 팀 규칙 위반, 사람이 선택하지 않음

## 직전 handoff (t-01 intake)

```markdown
---
status: "awaiting_approval"
blocked_reason:
decisions:
  - what: "src/gift/gift-points.js는 그대로 두고 호출부(src/gift/gift-order.js)에서 해결한다"
    why: "팀 규칙(gift-points-hands-off)상 협의 전 수정 금지. 사람이 이 범위를 골랐다"
    by: human
assumptions:
  - "218P는 earnPoints 식(배송비 제외, 1P 미만 버림)으로 나온 값이라고 보았다. 계산은 확인하지 않았다"
rejected:
  - "gift-points.js 직접 수정: 팀 규칙 위반, 사람이 선택하지 않음"
open_questions: []
intent_deviation: null
risks:
  - "gift-points.js의 giftPoints를 쓰는 다른 곳(src/index.js export)은 여전히 옛 식을 쓴다"
  - "218P는 고객센터 값에서 맞춘 식이라 다른 주문으로는 검증되지 않았다"
recommended_next: null
knowledge_candidates: []
---
## 요약
G-0213 적립 예정 포인트를 249P에서 218P로 바로잡는 버그 수정 intent 초안을 썼다. giftPoints는 건드리지 않고 호출부에서 해결하는 범위다.
## 다음 task가 알아야 할 것
- `src/gift/gift-order.js:36`에서 `giftPoints(order)`를 호출한다. 일반 주문은 `src/orders/order.js:35`의 `earnPoints`.
- `giftPoints`는 `percentOf(total, rate)`(배송비 포함, 반올림)이다. 참고 지식: `docs/knowledge/points/earn-points-formula.md`, `gift-points-hands-off.md`, `stored-points-not-recalculated.md`.
- 원인은 확인하지 않았다. 테스트는 `npm test`.
```

## 필요한 산출물

없음
