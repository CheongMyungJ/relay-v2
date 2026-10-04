# relay task 컨텍스트

앱이 task를 시작할 때 쓴 파일이다. 스킬의 절차를 따르고, 필요한 값은 이 파일에서 읽는다.

## task 정보

- work_id: w-20261004-002
- task_id: t-03
- 업무 유형: 버그 수정 (`bugfix`)
- node: verify (리뷰와 검증)
- skill: verify
- 승인된 intent 버전: 1
- task 디렉터리: /tmp/relay-eval/e10-points/26-points-rate-change-k7-1/relay-home/projects/shop-5ea5c6/works/w-20261004-002/tasks/03-verify
- 작업 브랜치: relay/w-20261004-002
- 기준 브랜치: main
- 기준 커밋: b454f0f2fe51a835597898f2aaca56b793f1875d

## 승인 방식

수동 승인 (의도 승인, Work 완료는 늘 수동)

## 마무리 안내 문구

산출물과 handoff를 썼습니다. 오른쪽 패널에서 확인하고 [완료만], [push] 중 하나를 누르세요. [이 단계 끝나면 멈춤]이 켜져 있거나 이전 단계를 추천했으면 [승인하고 멈춤]을 누르고, 전달은 멈춘 뒤 Work 완료 화면에서 고르세요. 고칠 점은 여기에 말해 주세요.

## 질문 방식

초안 우선 (`draft_first`)

## 팀 지식

레포의 `docs/knowledge/`에 팀이 앞선 일에서 남긴 지식이다. 사람이 알려 준 규칙과 사실, 앞선 조사에서 알아낸 것이다.

- 이 일에 해당하는 항목은 팀이 이미 아는 사실이다. 같은 내용을 사람에게 다시 묻지 않는다. 리뷰할 때 변경이 그 항목을 어기는지도 본다.
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
- 출처: <사람이 알려 줌 / 조사로 알아냄>, relay Work w-20261004-002, 2026-10-04

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

## t-02 fix — 2026-10-04 04:50 (자동 승인)
- [AI] 회수를 환불 전후 적립 기준 금액의 적립 차이로 계산하고 저장된 적립으로 상한을 둔다 — docs/knowledge/refund-recovery-follows-earn-rule.md
- [AI] earn.js에 earnOn(base)(버림)를 추가하고 earnPoints는 그대로 둔다 — docs/knowledge/points-earn-excludes-shipping-floor.md. 이 브랜치에 earnOn이 없고 주문 적립 변경은 이번 범위 밖이다
```

## 누적 기각 목록

없음

## 직전 handoff (t-02 fix)

```markdown
---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "회수를 환불 전후 적립 기준 금액의 적립 차이로 계산하고 저장된 적립으로 상한을 둔다"
    why: "docs/knowledge/refund-recovery-follows-earn-rule.md"
    by: ai
  - what: "earn.js에 earnOn(base)(버림)를 추가하고 earnPoints는 그대로 둔다"
    why: "docs/knowledge/points-earn-excludes-shipping-floor.md. 이 브랜치에 earnOn이 없고 주문 적립 변경은 이번 범위 밖이다"
    by: ai
assumptions:
  - "정산팀 기준은 팀 지식의 규칙과 같다"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "앞 Work(w-20261004-001)에서 earnOn/earnPoints를 고쳤을 수 있음, 머지 대기. 머지 때 earn.js 충돌 가능, earnOn 중복 정리 필요"
  - "earnPoints(주문 적립)는 아직 결제 금액을 반올림한다. 이번에 고치지 않았다"
  - "이전 부분 환불의 실제 회수 이력은 입력에 없어 alreadyRefunded 수량으로 환불 전 기준을 계산한다"
recommended_next: null
knowledge_candidates: []
---
## 요약
부분 환불 회수를 환불 상품 금액 × 적립률 반올림에서 환불 전후 적립 기준 금액의 적립 차이로 바꿨다. R-0311은 132P이고 적립을 넘지 않는다. 테스트 3개를 추가했고 `npm test`는 23개 통과다.
## 다음 task가 알아야 할 것
- `src/orders/refund.js` createRefund의 `pointsRecovered` 계산, `src/points/earn.js`의 `earnOn`.
- 확인: `node src/cli.js examples/R-0311.json --order examples/O-1077.json` → -132P.
- 테스트: `npm test`(23 pass), test/refund.test.js 아래쪽 3개가 새 테스트.
```

## 필요한 산출물

- t-02 fix: /tmp/relay-eval/e10-points/26-points-rate-change-k7-1/relay-home/projects/shop-5ea5c6/works/w-20261004-002/tasks/02-fix/fix.md
