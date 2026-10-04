# relay task 컨텍스트

앱이 task를 시작할 때 쓴 파일이다. 스킬의 절차를 따르고, 필요한 값은 이 파일에서 읽는다.

## task 정보

- work_id: w-20261003-002
- task_id: t-02
- 업무 유형: 버그 수정 (`bugfix`)
- node: fix (원인 분석과 수정)
- skill: fix
- 승인된 intent 버전: 1
- task 디렉터리: /tmp/relay-eval/e8-k7/21-invoice-credit-k7-1/relay-home/projects/billing-346699/works/w-20261003-002/tasks/02-fix
- 작업 브랜치: relay/w-20261003-002
- 기준 브랜치: main
- 기준 커밋: 5b88dd2f887e6af0f174b53143408d837b2b464d

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

#### docs/knowledge/vat-code-locations.md (Work w-20261003-001에서 남김. 기준 브랜치에는 아직 없다)

```markdown
# 부가세 계산 위치와 percentOf의 용도

- 종류: 사실
- 적용: src/invoice/total.js, src/money.js, src/invoice/credit-note.js, src/invoice/discount.js
- 출처: 조사로 알아냄, relay Work w-20261003-001, 2026-10-03

청구서 부가세를 계산하는 곳은 computeTotals(src/invoice/total.js)다. percentOf(src/money.js, Math.round)는 부가세가 아니라 할인과 반품 전표 계산용이므로 부가세 문제로 바꾸지 않는다.
반품 전표(src/invoice/credit-note.js)는 부가세를 합계에 대해 Math.round로 따로 계산한다. 이 Work에서는 비목표라 바꾸지 않았으니, 바꿀 때는 새 일로 사람에게 확인한다.
```

#### docs/knowledge/vat-floor-per-line.md (Work w-20261003-001에서 남김. 기준 브랜치에는 아직 없다)

```markdown
# 부가세는 과세 줄마다 원 단위 버림으로 계산해 합산한다

- 종류: 규칙
- 적용: src/invoice/total.js (computeTotals), 부가세를 새로 계산하는 모든 곳
- 출처: 사람이 알려 줌 (회계팀 규정), relay Work w-20261003-001, 2026-10-03

부가세는 과세 품목 줄마다 (할인 후 공급가액 × 세율)을 원 단위로 버림(Math.floor)하고, 그 합을 부가세로 쓴다. 합계에서 다시 반올림하지 않는다. 합계는 공급가액 + 부가세다.
예: INV-2031은 줄별 536+633+325+837+310 = 부가세 2,641원, 합계 29,079원이다. 공급가액 합 26,438원에 한 번 반올림하면 2,644원으로 3원 크게 나온다.
면세 줄과 영세율(zeroRated) 청구서의 부가세는 0원이다.
이번 Work는 새로 계산하는 청구서만 고쳤다. 이미 저장된 totals와 반품 전표(CN)의 저장 금액은 바로잡지 않기로 했다.
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
새로 만드는 반품 전표(CN)의 환불 부가세와 합계가 회계팀 계산과 맞도록 한다. 현재 CN-0112(청구서 INV-2047의 반품)의 환불 합계가 19,182원으로 나오며 회계팀 계산과 몇 원 어긋난다.

## 비목표
- 이미 발행된 청구서와 이미 만든 반품 전표의 저장된 totals는 다시 계산하거나 바꾸지 않는다.
- `src/format/` 서식 모듈의 출력 형식은 바꾸지 않는다.
- 할인 계산(`percentOf`, `returnedDiscount`)과 청구서 부가세 계산(`computeTotals`)은 바꾸지 않는다.

## 원하는 결과
- 반품 전표의 부가세가 팀 규칙(회계팀 규정)대로 계산된다. 과세 줄마다 (할인 후 공급가액 × 세율)을 원 단위로 버림(Math.floor)해 합산하고, 합계에서 다시 반올림하지 않는다. 합계는 공급가액 + 부가세다.
- 면세 줄과 영세율(zeroRated) 반품 전표의 부가세는 0원이다.
- CN-0112를 새로 계산하면 위 규칙에 따른 금액이 나온다.

## 완료조건
- [ ] 재현 절차가 더 이상 실패하지 않는다 (examples/CN-0112.json과 examples/INV-2047.json으로 반품 전표를 만들면 환불 부가세·합계가 줄별 버림 규칙의 값과 같다)
- [ ] `npm test`가 통과한다
- [ ] 기존 테스트를 약화하거나 삭제하지 않는다
- [ ] 반품 전표 부가세가 줄별 원 단위 버림의 합으로 계산됨을 확인하는 테스트가 있다
- [ ] 이미 저장된 totals가 있는 반품 전표는 `creditNoteTotals`가 저장된 금액을 그대로 돌려준다
- [ ] `src/format/`의 출력 형식 테스트 결과가 달라지지 않는다

## 제약
- (팀 지식 docs/knowledge/vat-floor-per-line.md) 부가세는 과세 품목 줄마다 (할인 후 공급가액 × 세율)을 원 단위로 버림(Math.floor)하고 그 합을 쓴다. 합계에서 다시 반올림하지 않는다. 면세 줄과 영세율 청구서의 부가세는 0원이다.
- 이미 저장된 금액은 바로잡지 않는다 (요청).

## 추가 의견
- 요청에 회계팀 계산 금액은 적혀 있지 않아, 위 팀 규칙을 기준으로 삼았다.
```

## Work 요청 원문

경로: /tmp/relay-eval/e8-k7/21-invoice-credit-k7-1/relay-home/projects/billing-346699/works/w-20261003-002/request.md

## 결정 로그

```markdown
## t-01 intake — 2026-10-03 11:52 (사람 승인)
- [AI] 반품 전표 부가세도 과세 줄별 원 단위 버림 합산 규칙을 따른다 — 팀 지식 vat-floor-per-line(규칙)이 부가세를 새로 계산하는 모든 곳에 적용된다고 함. 앞 Work에서 반품 전표는 비목표였고 이번 요청이 그 새 일이다
```

## 누적 기각 목록

없음

## 직전 handoff (t-01 intake)

```markdown
---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "반품 전표 부가세도 과세 줄별 원 단위 버림 합산 규칙을 따른다"
    why: "팀 지식 vat-floor-per-line(규칙)이 부가세를 새로 계산하는 모든 곳에 적용된다고 함. 앞 Work에서 반품 전표는 비목표였고 이번 요청이 그 새 일이다"
    by: ai
assumptions:
  - "회계팀 계산은 줄별 버림 규칙과 같다고 가정함. 요청에 회계팀 금액이 없음"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "앞 Work(w-20261003-001)에서 지식 문서가 아직 기준 브랜치에 없음, 머지 대기. 청구서 쪽 computeTotals 수정도 이 브랜치에 없을 수 있음"
  - "돌려받는 줄의 할인 반올림(returnedDiscount)이 회계팀 계산과 다른지는 확인하지 않음"
recommended_next: null
knowledge_candidates: []
---
## 요약
반품 전표의 환불 부가세를 팀 규칙(줄별 원 단위 버림 합산)에 맞추는 버그 수정 의도를 정리했다. 이미 저장된 금액과 `src/format/`은 건드리지 않는다.
## 다음 task가 알아야 할 것
- `src/invoice/credit-note.js`의 `creditTotals`가 부가세를 과세분 합계에 `Math.round`로 한 번 계산한다. 원인 확정은 fix에서 한다.
- 재현 입력: `examples/CN-0112.json`, `examples/INV-2047.json`. 테스트는 `npm test`(node --test), 관련 `test/credit-note.test.js`.
- 참고 지식: docs/knowledge/vat-floor-per-line.md, docs/knowledge/vat-code-locations.md
- 할인 반올림은 `percentOf`(src/money.js)를 쓴다. 부가세 문제로 바꾸지 않는다.
```

## 필요한 산출물

없음
