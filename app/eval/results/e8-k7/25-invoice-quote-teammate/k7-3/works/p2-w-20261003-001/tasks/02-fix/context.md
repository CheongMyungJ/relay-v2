# relay task 컨텍스트

앱이 task를 시작할 때 쓴 파일이다. 스킬의 절차를 따르고, 필요한 값은 이 파일에서 읽는다.

## task 정보

- work_id: w-20261003-001
- task_id: t-02
- 업무 유형: 버그 수정 (`bugfix`)
- node: fix (원인 분석과 수정)
- skill: fix
- 승인된 intent 버전: 1
- task 디렉터리: /tmp/relay-eval/e8-k7/25-invoice-quote-teammate-k7-3/relay-home-2/projects/billing-mate1-b8b5b2/works/w-20261003-001/tasks/02-fix
- 작업 브랜치: relay/w-20261003-001
- 기준 브랜치: main
- 기준 커밋: 2c90d841f6a582cdd7f40368e2cf12d65e0330b4

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

#### docs/knowledge/credit-note-quote-vat-differs.md

```markdown
# 전표와 견적서의 부가세 계산은 청구서와 따로 있다

- 종류: 사실
- 적용: src/invoice/credit-note.js, src/invoice/quote.js
- 출처: 조사로 알아냄, relay Work w-20261003-001, 2026-10-03

이 Work는 청구서(computeTotals)만 줄별 버림으로 바꿨다. 반품 전표와 견적서는 별도 계산으로 합계 기준 Math.round를 쓰고 있었고 바꾸지 않았다.
청구서 부가세 규칙을 다룰 때 이 둘에도 적용할지는 회계팀 기준으로 따로 정해야 한다.
```

#### docs/knowledge/issued-invoice-and-format-frozen.md

```markdown
# 발행된 청구서는 재계산하지 않고 src/format/ 출력은 바꾸지 않는다

- 종류: 규칙
- 적용: src/invoice/invoice.js (invoiceTotals), src/format/
- 출처: 사람이 알려 줌, relay Work w-20261003-001, 2026-10-03

이미 발행된 청구서의 합계는 발행 때 저장된 값을 유지한다. 계산 규칙을 바꿔도 발행분을 다시 계산하거나 바꾸지 않는다.
`src/format/`의 출력 형식은 PDF 생성기가 그대로 찍기 때문에 바꾸지 않는다.
관련 위치: invoiceTotals는 저장된 totals가 있으면 그것을 쓴다. totals가 저장되지 않은 발행분은 새 규칙으로 계산될 수 있다.
```

#### docs/knowledge/no-recalc-issued-and-format.md

```markdown
# 발행된 청구서와 만든 반품 전표는 재계산하지 않고 src/format/ 출력은 바꾸지 않는다

- 종류: 규칙
- 적용: src/invoice/invoice.js(invoiceTotals), src/invoice/credit-note.js(creditNoteTotals), src/format/
- 출처: 사람이 알려 줌, relay Work w-20261003-001, w-20261003-002, 2026-10-03

발행된 청구서의 합계는 저장값을 그대로 쓰며, 계산 규칙이 바뀌어도 다시 계산하지 않는다(회계 대조·입금 금액이 어긋난다).
이미 만든 반품 전표도 같다. 저장된 totals가 있으면 그대로 쓰고, 계산 규칙(예: 부가세 줄별 버림)이 바뀌어도 다시 계산하지 않는다. 새 규칙은 새로 만드는 전표에만 적용된다.
src/format/ 출력 형식은 PDF 생성기가 그대로 찍으므로 바꾸지 않는다.
```

#### docs/knowledge/vat-per-line-floor-sum.md

```markdown
# 청구서 부가세는 줄별 원 단위 버림의 합이다

- 종류: 규칙
- 적용: src/invoice/total.js (computeTotals)
- 출처: 사람이 알려 줌, relay Work w-20261003-001, 2026-10-03

회계팀 기준: 과세 품목 줄마다 할인을 먼저 적용한 금액에 부가세를 매기고 원 단위 미만을 버린다. 청구서 부가세는 그 줄별 값의 합이며 합계에서 다시 반올림하지 않는다.
예: INV-2031은 536+633+325+837+310 = 2,641원, 합계 29,079원 (합계 기준 반올림이면 2,644원, 29,082원으로 3원 크다).
면세 줄과 영세율(zeroRated) 청구서의 부가세는 0원이다.
```

#### docs/knowledge/vat-per-line-floor.md

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
거래처 C-0388이 문의한 견적서 Q-0457의 합계가 경리 계산 금액과 2원 다른 문제를 바로잡는다. 현재 견적서 합계는 56,280원이고 경리 담당이 계산한 합계는 56,278원이다.

## 비목표
- 견적 번호 형식(Q-0000)과 유효 기간 계산(`quoteValidUntil`, `validDays`)은 바꾸지 않는다. 영업 시스템이 그대로 읽는다.
- `src/format/`의 출력 형식은 바꾸지 않는다.
- 이미 발행된 청구서와 이미 만든 반품 전표의 저장된 합계는 다시 계산하지 않는다.

## 원하는 결과
`examples/Q-0457.json`으로 만든 견적서의 합계가 56,278원으로 나온다. 부가세 계산 규칙이 무엇인지는 사람이 모르므로, 이 금액에 맞는 계산 방식은 fix에서 근거와 함께 밝힌다.

## 완료조건
- [ ] 재현 절차(`examples/Q-0457.json`으로 견적서를 만들어 합계 확인)가 더 이상 실패하지 않는다
- [ ] `npm test`가 통과한다
- [ ] 기존 테스트를 약화하거나 삭제하지 않는다
- [ ] `examples/Q-0457.json`으로 만든 견적서의 합계가 56,278원이다
- [ ] 견적 번호 형식 검사와 `quoteValidUntil`의 결과가 바뀌지 않는다
- [ ] `src/format/` 아래 파일이 바뀌지 않는다

## 제약
- (팀 지식 `docs/knowledge/no-recalc-issued-and-format.md`) 발행된 청구서와 만든 반품 전표는 저장값을 유지하고 재계산하지 않는다. `src/format/` 출력은 바꾸지 않는다.

## 추가 의견
- 요청에 원인 추정은 없다.
- 기준 금액 56,278원은 경리 담당이 계산한 값이며 사람이 알려 주었다. 어떤 계산 규칙에서 나온 값인지는 사람도 모른다.
- 견적서 부가세를 줄별 원 단위 버림의 합으로 계산하는지는 확인되지 않았다. 팀 지식에 견적서도 같은 규칙이라는 항목과 따로 정해야 한다는 항목이 함께 있어 확정하지 않았다.
```

## Work 요청 원문

경로: /tmp/relay-eval/e8-k7/25-invoice-quote-teammate-k7-3/relay-home-2/projects/billing-mate1-b8b5b2/works/w-20261003-001/request.md

## 결정 로그

```markdown
## t-01 intake — 2026-10-03 13:01 (사람 승인)
- [사람] Q-0457의 기준 합계를 경리 담당이 계산한 56,278원으로 한다 — 사람이 경리 담당의 계산 금액을 직접 알려 줌. 현재 견적서는 56,280원으로 2원 크다
```

## 누적 기각 목록

- t-01 intake: 팀 지식 vat-per-line-floor.md의 줄별 버림 규칙을 견적서에 확정 적용: 이번 요청에서 사람이 확인하지 않았고, credit-note-quote-vat-differs.md는 따로 정해야 한다고 적어 충돌함

## 직전 handoff (t-01 intake)

```markdown
---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "Q-0457의 기준 합계를 경리 담당이 계산한 56,278원으로 한다"
    why: "사람이 경리 담당의 계산 금액을 직접 알려 줌. 현재 견적서는 56,280원으로 2원 크다"
    by: human
assumptions: []
rejected:
  - "팀 지식 vat-per-line-floor.md의 줄별 버림 규칙을 견적서에 확정 적용: 이번 요청에서 사람이 확인하지 않았고, credit-note-quote-vat-differs.md는 따로 정해야 한다고 적어 충돌함"
open_questions:
  - "견적서 부가세를 줄별 원 단위 버림의 합으로 계산하는 게 회계팀 기준인가? 사람이 모른다고 답했다. 56,278원이 이 규칙과 맞는지 fix에서 확인이 필요하다"
intent_deviation: null
risks:
  - "56,278원이 어떤 규칙에서 나온 값인지 모른다. 규칙 없이 금액만 맞추면 다른 견적서가 틀릴 수 있다"
  - "src/invoice/quote.js는 이미 vatOfRows를 쓰는 것으로 보여 코드만으로는 불일치가 안 보인다. 56,280원의 출처는 fix에서 확인해야 한다"
recommended_next: null
knowledge_candidates:
  - "견적서 Q-0457의 경리 담당 계산 합계는 56,278원이다. 이 Work 시작 때 견적서 값은 56,280원이었다 (사람)"
---
## 요약
견적서 Q-0457 합계가 경리 계산과 2원 다른 버그의 의도를 정리했다. 기준 합계는 경리 담당이 계산한 56,278원이고, 부가세 규칙은 사람이 몰라 open_questions에 남겼다. 견적 번호 형식, 유효 기간 계산, src/format/은 바꾸지 않는다.
## 다음 task가 알아야 할 것
- 데이터: `examples/Q-0457.json`, 계산: `src/invoice/quote.js`의 `quoteTotals`. 테스트는 `npm test`(node --test).
- (참고, 확인 안 됨) quote.js는 현재 `vatOfRows`(`src/invoice/total.js`)를 쓴다. 56,280원이 이 코드의 결과인지, 다른 경로(저장된 totals 등)인지 먼저 확인할 것.
- 2원 차이는 부가세 반올림 방식 차이일 수 있다는 것은 내 추측이다. 원인으로 단정하지 말고 계산해서 확인할 것.
- 참고 지식(근거가 아님): `docs/knowledge/vat-per-line-floor.md`(견적서도 같은 규칙이라고 적음), `docs/knowledge/credit-note-quote-vat-differs.md`(따로 정해야 한다고 적음). 두 항목은 서로 충돌한다.
```

## 필요한 산출물

없음
