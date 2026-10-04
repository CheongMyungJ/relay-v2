# relay task 컨텍스트

앱이 task를 시작할 때 쓴 파일이다. 스킬의 절차를 따르고, 필요한 값은 이 파일에서 읽는다.

## task 정보

- work_id: w-20261003-002
- task_id: t-02
- 업무 유형: 버그 수정 (`bugfix`)
- node: fix (원인 분석과 수정)
- skill: fix
- 승인된 intent 버전: 1
- task 디렉터리: /tmp/relay-eval/e8-k7/25-invoice-quote-teammate-k7-3/relay-home/projects/billing-502d24/works/w-20261003-002/tasks/02-fix
- 작업 브랜치: relay/w-20261003-002
- 기준 브랜치: main
- 기준 커밋: 14cc49d7a3057c4d9b4c12e69f8614db368b6534

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

#### docs/knowledge/no-recalc-issued-and-format.md (Work w-20261003-001에서 남김. 기준 브랜치에는 아직 없다)

```markdown
# 발행된 청구서는 재계산하지 않고 src/format/ 출력은 바꾸지 않는다

- 종류: 규칙
- 적용: src/invoice/invoice.js(invoiceTotals), src/format/
- 출처: 사람이 알려 줌, relay Work w-20261003-001, 2026-10-03

발행된 청구서의 합계는 저장값을 그대로 쓰며, 계산 규칙이 바뀌어도 다시 계산하지 않는다(회계 대조·입금 금액이 어긋난다).
src/format/ 출력 형식은 PDF 생성기가 그대로 찍으므로 바꾸지 않는다.
```

#### docs/knowledge/vat-per-line-floor.md (Work w-20261003-001에서 남김. 기준 브랜치에는 아직 없다)

```markdown
# 부가세는 줄별 원 단위 버림의 합이다 (회계팀 기준)

- 종류: 규칙
- 적용: src/invoice/ (청구서, 견적서, 반품 전표 합계)
- 출처: 사람이 알려 줌, relay Work w-20261003-001, 2026-10-03

과세 품목 줄마다 할인을 먼저 적용한 금액에 10%를 매기고 원 단위 미만을 버린다. 청구서 부가세는 그 줄별 값의 합이며 합계에서 다시 반올림하지 않는다. 면세 줄과 영세율(zeroRated)은 0원.
예: INV-2031 합계 29,082원(옛 방식) → 29,079원(vat 2,641). 견적서 Q-0457 vat 3,587, 반품 전표 CN-0112 vat 1,742도 같은 규칙이다.
관련 위치: src/invoice/total.js의 vatOfRows (청구서·견적서·반품 전표가 공유했던 한 곳).
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
반품 전표(`src/invoice/credit-note.js`)의 환불 금액이 회계팀 계산과 몇 원씩 어긋나는 문제를 바로잡는다. 회계팀 기준으로 맞는 금액이 나오게 한다.

## 비목표
- 이미 발행된 청구서와 이미 만든 반품 전표는 다시 계산하지 않는다(저장된 금액 그대로).
- `src/format/` 출력 형식은 바꾸지 않는다.
- 청구서·견적서 합계 계산은 이번 범위가 아니다(앞 Work w-20261003-001에서 다룸).

## 원하는 결과
- 새로 만드는 반품 전표의 환불 금액(부가세·합계)이 회계팀 기준과 일치한다.
- 예: CN-0112(청구서 INV-2047의 반품, `examples/CN-0112.json`, `examples/INV-2047.json`)가 지금 환불 합계 19,182원으로 나오는데, 회계팀 계산과 몇 원 다르다. 회계팀 기준 금액에 맞게 고친다.

## 완료조건
- [ ] 재현 절차(CN-0112를 INV-2047에서 만들었을 때 환불 합계가 회계팀 계산과 다른 것)가 더 이상 실패하지 않는다
- [ ] `npm test`가 통과한다
- [ ] 기존 테스트를 약화하거나 삭제하지 않는다
- [ ] 저장된 `totals`가 있는 반품 전표는 `creditNoteTotals`가 그 값을 그대로 돌려준다
- [ ] `src/format/` 파일과 그 출력은 바뀌지 않는다
- [ ] 반품 전표 부가세 계산 규칙을 확인하는 테스트가 추가된다(CN-0112 포함)

## 제약
- (팀 지식 `docs/knowledge/vat-per-line-floor.md`) 부가세는 과세 줄마다 할인 적용 후 금액에 10%를 매겨 원 단위 미만을 버린 값의 합이다. 합계에서 다시 반올림하지 않는다. 면세 줄과 영세율(zeroRated)은 0원. 반품 전표도 같은 규칙이다.
- (팀 지식 `docs/knowledge/no-recalc-issued-and-format.md`) 발행된 청구서 합계는 저장값을 쓰고 재계산하지 않는다. `src/format/` 출력은 바꾸지 않는다.

## 추가 의견
- 없음
```

## Work 요청 원문

경로: /tmp/relay-eval/e8-k7/25-invoice-quote-teammate-k7-3/relay-home/projects/billing-502d24/works/w-20261003-002/request.md

## 결정 로그

```markdown
## t-01 intake — 2026-10-03 12:56 (사람 승인)
- [AI] 반품 전표 부가세는 팀 지식의 줄별 원 단위 버림 합 규칙을 따른다고 제약에 옮김 — 팀 지식 vat-per-line-floor.md의 적용 범위에 반품 전표가 들어 있어 다시 묻지 않음
```

## 누적 기각 목록

없음

## 직전 handoff (t-01 intake)

```markdown
---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "반품 전표 부가세는 팀 지식의 줄별 원 단위 버림 합 규칙을 따른다고 제약에 옮김"
    why: "팀 지식 vat-per-line-floor.md의 적용 범위에 반품 전표가 들어 있어 다시 묻지 않음"
    by: ai
assumptions:
  - "회계팀이 말한 '몇 원' 차이는 팀 지식의 부가세 규칙(줄별 버림 합) 때문이라고 가정함. 확인은 fix에서 CN-0112 금액으로 한다"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "앞 Work(w-20261003-001)에서 고쳤을 수 있음, 머지 대기: 청구서·견적서의 같은 규칙 위반(src/invoice/total.js 등)은 범위 밖으로 두었다"
  - "src/invoice/credit-note.js의 returnedDiscount(금액 할인의 수량 비율 반올림)도 금액에 영향을 줄 수 있어 fix에서 CN-0112 기준으로 확인 필요"
recommended_next: null
knowledge_candidates: []
---
## 요약
반품 전표 환불 금액이 회계팀 계산과 어긋나는 버그의 의도 초안을 썼다. 저장된 금액 재계산 금지와 `src/format/` 불변을 비목표로, 부가세 줄별 버림 규칙을 제약으로 옮겼다.
## 다음 task가 알아야 할 것
- `src/invoice/credit-note.js` `creditTotals`: 부가세를 `Math.round((taxable * VAT_RATE_PERCENT) / 100)`로 계산함(줄별 아님). 이 브랜치에는 `vatOfRows`가 아직 없다(`src/invoice/total.js`는 `computeTotals`만 있음).
- 참고 지식: `docs/knowledge/vat-per-line-floor.md`, `docs/knowledge/no-recalc-issued-and-format.md`(둘 다 기준 브랜치에 아직 없음).
- 테스트: `npm test`(`node --test`), 기존 `test/credit-note.test.js`.
- 예시 입력: `examples/CN-0112.json`, `examples/INV-2047.json`(현재 환불 합계 19,182원).
```

## 필요한 산출물

없음
