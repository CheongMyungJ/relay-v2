# relay task 컨텍스트

앱이 task를 시작할 때 쓴 파일이다. 스킬의 절차를 따르고, 필요한 값은 이 파일에서 읽는다.

## task 정보

- work_id: w-20261004-001
- task_id: t-02
- 업무 유형: 버그 수정 (`bugfix`)
- node: fix (원인 분석과 수정)
- skill: fix
- 승인된 intent 버전: 1
- task 디렉터리: /tmp/relay-eval/e10-points/27-points-gift-teammate-k7-1/relay-home-2/projects/shop-mate1-77e61d/works/w-20261004-001/tasks/02-fix
- 작업 브랜치: relay/w-20261004-001
- 기준 브랜치: main
- 기준 커밋: 979061b24a8e70c4067f55813e2181cde432baf9

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

#### docs/knowledge/earn-points-base-and-rounding.md

```markdown
# 적립 포인트는 배송비를 뺀 금액의 비율을 원 단위로 버려 계산한다

- 종류: 규칙
- 적용: 적립 포인트 계산 전반 (일반 주문 `src/points/earn.js`, 선물하기·부분 환불 등 적립/회수를 계산하는 곳)
- 출처: 사람이 알려 줌, relay Work w-20261004-001, 2026-10-04

고객센터 적립 안내 기준: 기준 금액 = 상품 금액 − 쿠폰 할인 − 사용 포인트 (배송비 제외). 적립 = 기준 금액 × `POINT_RATE_PERCENT`% 를 원 단위로 버림.
예: O-1042는 기준 23,770원 × 1% = 237.7 → 237P (배송비 포함 반올림이면 268P로 틀림).
이번 Work는 일반 주문만 고쳤다. 선물하기(`src/gift/gift-points.js`)와 부분 환불 회수(`src/orders/refund.js`)는 반올림 `percentOf`를 따로 써서 같은 차이가 남아 있을 수 있다(관련 위치).
```

#### docs/knowledge/earn-points-rounding-mismatch-in-copies.md

```markdown
# 적립 계산을 복제한 곳은 적립 기준과 어긋나기 쉽다

- 종류: 실패 유형
- 적용: `src/gift/gift-points.js`, `src/orders/refund.js`(부분 환불 pointsRecovered)
- 출처: 조사로 알아냄, relay Work w-20261004-001, 2026-10-04

적립 계산을 `money.js`의 `percentOf`(반올림)로 따로 복제한 곳이 있다. 적립 기준(버림)과 달라 예: 1,990원 → 적립 19P인데 회수는 20P가 될 수 있다.
적립 규칙을 바꿀 때는 이 복제 위치도 함께 확인한다. `percentOf` 자체는 다른 곳이 쓰므로 바꾸지 않는다.
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
선물하기 주문의 적립 예정 포인트가 고객센터 적립 기준과 같게 나오도록 고친다.

## 비목표
- 선물 메시지 카드, 받는 사람 정보, 영수증 글자(`src/format/`)는 바꾸지 않는다.
- 이미 적립된 포인트는 다시 계산하지 않는다.
- 부분 환불 회수(`src/orders/refund.js`)와 `money.js`의 `percentOf`는 이번에 바꾸지 않는다.

## 원하는 결과
G-0213(`examples/G-0213.json`)의 적립 예정 포인트가 249P가 아니라 218P로 나온다. 같은 상품을 일반 주문으로 샀을 때와 같은 포인트가 된다.

## 완료조건
- [ ] 재현 절차가 더 이상 실패하지 않는다 (G-0213 적립 예정 포인트가 218P)
- [ ] `npm test`가 통과한다
- [ ] 기존 테스트를 약화하거나 삭제하지 않는다
- [ ] 선물하기 적립이 일반 주문 적립과 같은 기준(배송비 제외, 원 단위 버림)으로 계산됨을 확인하는 테스트가 있다
- [ ] 선물 메시지 카드, 받는 사람 정보, `src/format/`의 출력이 수정 전과 같다

## 제약
- (팀 지식 `docs/knowledge/earn-points-base-and-rounding.md`) 기준 금액 = 상품 금액 − 쿠폰 할인 − 사용 포인트(배송비 제외). 적립 = 기준 금액 × `POINT_RATE_PERCENT`%를 원 단위로 버림.

## 추가 의견
- 고객센터 계산 기준 218P (문의 내용).
```

## Work 요청 원문

경로: /tmp/relay-eval/e10-points/27-points-gift-teammate-k7-1/relay-home-2/projects/shop-mate1-77e61d/works/w-20261004-001/request.md

## 결정 로그

```markdown
## t-01 intake — 2026-10-04 05:05 (사람 승인)
- [AI] 부분 환불 회수(refund.js)는 이번 비목표로 둔다 — 요청이 선물하기 적립만 고쳐 달라고 했고 환불은 언급하지 않음
```

## 누적 기각 목록

없음

## 직전 handoff (t-01 intake)

```markdown
---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "부분 환불 회수(refund.js)는 이번 비목표로 둔다"
    why: "요청이 선물하기 적립만 고쳐 달라고 했고 환불은 언급하지 않음"
    by: ai
assumptions:
  - "G-0213 기준 금액은 24,860 − 2,000 − 1,000 = 21,860원이고 1%를 버리면 218P (코드 실행으로 확인하지 않고 손으로 계산)"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "부분 환불 회수가 반올림 percentOf를 써서 선물 적립과 어긋날 수 있다. 이번 범위 밖이다"
recommended_next: null
knowledge_candidates: []
---
## 요약
선물하기 적립(249P)을 고객센터 기준(218P)으로 맞추는 버그 수정 의도 초안을 썼다. 질문 없이 초안을 먼저 썼다.
## 다음 task가 알아야 할 것
- `src/gift/gift-points.js`: `percentOf(order.amounts.total, ...)` 반올림 사용. 총액에 배송비가 들어 있는지 fix에서 확인
- 팀 지식 참고: `docs/knowledge/earn-points-base-and-rounding.md`, `docs/knowledge/earn-points-rounding-mismatch-in-copies.md`
- 일반 주문 적립은 `src/points/earn.js`에 이미 수정되어 있으므로 같은 계산을 재사용할 수 있는지 볼 것
- 테스트 명령: `npm test` (`node --test`)
```

## 필요한 산출물

없음
