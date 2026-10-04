# relay task 컨텍스트

앱이 task를 시작할 때 쓴 파일이다. 스킬의 절차를 따르고, 필요한 값은 이 파일에서 읽는다.

## task 정보

- work_id: w-20261004-001
- task_id: t-03
- 업무 유형: 버그 수정 (`bugfix`)
- node: verify (리뷰와 검증)
- skill: verify
- 승인된 intent 버전: 1
- task 디렉터리: /tmp/relay-eval/e10-points/27-points-gift-teammate-k7-1/relay-home-2/projects/shop-mate1-77e61d/works/w-20261004-001/tasks/03-verify
- 작업 브랜치: relay/w-20261004-001
- 기준 브랜치: main
- 기준 커밋: 979061b24a8e70c4067f55813e2181cde432baf9

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

없음

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

## t-02 fix — 2026-10-04 05:05 (자동 승인)
- [AI] giftPoints가 earnPoints를 그대로 재사용한다 — 팀 지식 docs/knowledge/earn-points-base-and-rounding.md: 적립은 배송비 제외, 원 단위 버림
```

## 누적 기각 목록

없음

## 직전 handoff (t-02 fix)

```markdown
---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "giftPoints가 earnPoints를 그대로 재사용한다"
    why: "팀 지식 docs/knowledge/earn-points-base-and-rounding.md: 적립은 배송비 제외, 원 단위 버림"
    by: ai
assumptions: []
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "부분 환불 회수(refund.js)는 여전히 반올림 percentOf라 적립과 어긋날 수 있다(비목표)"
recommended_next: null
knowledge_candidates: []
---
## 요약
선물하기 적립이 배송비 포함 총액에 반올림을 써서 249P가 나왔다. `earnPoints`를 재사용하도록 고쳐 218P가 나온다. 재현 테스트를 추가했다.
## 다음 task가 알아야 할 것
- 수정: `src/gift/gift-points.js`
- 테스트: `test/gift.test.js` 마지막 테스트. `npm test` 24개 통과
- 영수증 출력은 G-0213의 적립 예정 줄(249P에서 218P)만 달라진다. 메시지 카드, 받는 사람, `src/format/`은 변경 없음
```

## 필요한 산출물

- t-02 fix: /tmp/relay-eval/e10-points/27-points-gift-teammate-k7-1/relay-home-2/projects/shop-mate1-77e61d/works/w-20261004-001/tasks/02-fix/fix.md
