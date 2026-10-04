# relay task 컨텍스트

앱이 task를 시작할 때 쓴 파일이다. 스킬의 절차를 따르고, 필요한 값은 이 파일에서 읽는다.

## task 정보

- work_id: w-20261004-001
- task_id: t-02
- 업무 유형: 버그 수정 (`bugfix`)
- node: fix (원인 분석과 수정)
- skill: fix
- 승인된 intent 버전: 1
- task 디렉터리: /tmp/relay-eval/e10-points/27-points-gift-teammate-k8-1/relay-home-2/projects/shop-mate1-eb1aad/works/w-20261004-001/tasks/02-fix
- 작업 브랜치: relay/w-20261004-001
- 기준 브랜치: main
- 기준 커밋: d82983cae426e78bb9a488da608dd605c468f5fd

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

#### docs/knowledge/points/earn-points-basis.md

```markdown
---
kind: rule
source: investigation
anchor: earnPoints
---
# 일반 주문 적립은 배송비를 뺀 금액의 1%를 1P 미만 버림으로 계산한다

## 규칙
- 기준 금액은 상품 - 쿠폰 - 사용 포인트(= `amounts.total - amounts.shipping`)이고, 여기에 `POINT_RATE_PERCENT`%를 곱해 1P 미만은 버린다 (`src/points/earn.js`). 예: O-1042는 23,770원 → 237P.
- 이미 저장된 `points.earned`는 다시 계산하지 않고 그대로 쓴다.
- 이 기준은 적립 안내 문서가 아니라 O-1042 한 건(237P)에서 역산해 정했다. 반올림이면 238P, 배송비 포함이면 268P라 맞지 않는다.

## 아직 규칙을 따르지 않는 곳
- `src/orders/refund.js`: 부분 환불의 `pointsRecovered`는 `percentOf(상품 환불액)` 반올림이라 위 기준과 다르다. 고칠지는 환불 기준 확인 후 정한다.
- `src/gift/gift-points.js`: 선물하기 적립은 배송비 포함·반올림이다. 다른 팀과 함께 볼 일이다 (`points/gift-points-ownership.md` 참고).

## 바뀐 이력
- 2026-10-04 처음 남김 (Work w-20261004-001)
```

#### docs/knowledge/points/gift-points-ownership.md

```markdown
---
kind: rule
source: human
anchor: giftPoints
---
# 선물하기 적립(`giftPoints`)은 다른 팀과 같이 보고 있어 이 팀이 단독으로 고치지 않는다

## 규칙
- `src/gift/gift-points.js`는 다른 팀과 함께 보는 파일이다. 이 팀의 일에서 단독으로 수정하지 않는다.
- 일반 주문 적립 기준과 맞추는 일은 다른 팀과 함께 정한다 (일반 주문 기준은 `points/earn-points-basis.md` 참고).

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
선물하기 주문 G-0213(`examples/G-0213.json`)의 적립 예정 포인트가 일반 주문으로 같은 상품을 샀을 때와 같은 기준으로 계산되게 한다. 지금은 249P로 나오고, 고객센터 계산은 218P다.

## 비목표
- 선물 메시지 카드, 받는 사람 정보, 영수증 글자(`src/format/`)는 바꾸지 않는다.
- 이미 적립된 포인트(`points.earned`)는 다시 계산하지 않는다.
- 부분 환불(`src/orders/refund.js`)의 포인트 회수 기준은 이번에 다루지 않는다.

## 원하는 결과
G-0213의 적립 예정 포인트가 218P로 나온다. 선물하기 적립이 일반 주문 적립(`earnPoints`)과 같은 기준(배송비를 뺀 금액의 `POINT_RATE_PERCENT`%, 1P 미만 버림)을 따른다.

## 완료조건
- [ ] 재현 절차(G-0213의 적립 예정 포인트 계산)가 더 이상 실패하지 않는다: 218P가 나온다
- [ ] `npm test`가 통과한다
- [ ] 기존 테스트를 약화하거나 삭제하지 않는다
- [ ] G-0213의 적립 예정 포인트가 일반 주문으로 같은 상품을 샀을 때와 같다
- [ ] 선물하기 적립 계산에 대한 테스트가 추가되어 G-0213의 218P를 확인한다
- [ ] `src/format/` 아래 파일과 선물 메시지·받는 사람 정보 처리가 바뀌지 않는다
- [ ] 이미 저장된 `points.earned`를 다시 계산하는 코드가 생기지 않는다

## 제약
- (팀 지식 `docs/knowledge/points/gift-points-ownership.md`) `src/gift/gift-points.js`는 다른 팀과 함께 보는 파일이라 이 팀이 단독으로 수정하지 않는다. 단, 사람이 이 버그는 리포트가 이 파일을 지목해 맡은 일이고 공유 파일인 줄 몰랐다며 이번 수정을 허용했다. 의도 승인에서 이 예외를 확인한다.
- (팀 지식 `docs/knowledge/points/earn-points-basis.md`) 일반 주문 적립 기준은 `amounts.total - amounts.shipping`에 `POINT_RATE_PERCENT`%를 곱해 1P 미만 버림이다.

## 추가 의견
- 요청이 관련 코드로 `src/gift/gift-points.js`를 지목했다.
```

## Work 요청 원문

경로: /tmp/relay-eval/e10-points/27-points-gift-teammate-k8-1/relay-home-2/projects/shop-mate1-eb1aad/works/w-20261004-001/request.md

## 결정 로그

```markdown
## t-01 intake — 2026-10-04 05:03 (사람 승인)
- [사람] 이번 수정에서 src/gift/gift-points.js 수정을 허용한다 — 팀 지식은 단독 수정 금지이나, 사람이 공유 파일인 줄 몰랐고 리포트가 이 파일을 지목한 자기 일이라며 수정을 허용했다
- [사람] src/format/ 불변, 이미 적립된 포인트 재계산 금지를 완료조건에 넣는다 — 요청 원문과 사람의 답
```

## 누적 기각 목록

없음

## 직전 handoff (t-01 intake)

```markdown
---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "이번 수정에서 src/gift/gift-points.js 수정을 허용한다"
    why: "팀 지식은 단독 수정 금지이나, 사람이 공유 파일인 줄 몰랐고 리포트가 이 파일을 지목한 자기 일이라며 수정을 허용했다"
    by: human
  - what: "src/format/ 불변, 이미 적립된 포인트 재계산 금지를 완료조건에 넣는다"
    why: "요청 원문과 사람의 답"
    by: human
assumptions:
  - "218P는 일반 주문 적립 기준(배송비 제외, 1P 미만 버림)에 맞춘 값으로 본다. G-0213의 상품 24,860 - 쿠폰 2,000 - 포인트 1,000 = 21,860원의 1%는 218.6이다"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "gift-points.js는 다른 팀과 공유 파일이라 수정이 그 팀에 영향을 줄 수 있다. 사람은 이번 수정을 허용했지만 다른 팀과의 합의는 확인되지 않았다"
recommended_next: null
knowledge_candidates:
  - "고칠 지식: docs/knowledge/points/gift-points-ownership.md — 사람이 이 파일이 다른 팀과 공유인 줄 몰랐고, G-0213 건은 리포트가 이 파일을 지목한 이 팀의 일이라 수정을 허용했다. 공유 규칙이 아직 유효한지 확인이 필요하다 (사람)"
---
## 요약
G-0213 선물하기 적립 예정 포인트(249P)를 일반 주문 기준의 218P로 맞추는 버그 수정 intent 초안을 썼다. 사람이 gift-points.js 수정을 허용했다.
## 다음 task가 알아야 할 것
- `src/gift/gift-points.js`: `giftPoints`가 `percentOf(order.amounts.total, ...)`를 쓴다. 일반 주문은 `src/points/earn.js`의 `earnPoints`다. 이 비교는 참고용 가설이고 원인 확정이 아니다.
- 테스트: `npm test`(`node --test`), 선물 관련은 `test/gift.test.js`, 적립은 `test/earn.test.js`.
- 팀 지식 참고: `docs/knowledge/points/earn-points-basis.md`, `docs/knowledge/points/gift-points-ownership.md`.
- 예시 입력: `examples/G-0213.json`.
```

## 필요한 산출물

없음
