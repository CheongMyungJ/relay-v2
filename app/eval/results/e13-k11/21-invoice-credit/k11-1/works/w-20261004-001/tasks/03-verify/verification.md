## 리뷰 지적
1. [사소] src/invoice/credit-note.js:72 — 반품 할인 안분(`returnedDiscount`)이 `Math.round`를 그대로 쓴다. 부가세 규칙 밖이고 이번 범위가 아니라 변경은 제안하지 않고 위험으로만 기록한다.
2. [사소] src/invoice/credit-note.js:5 — 반품 전표가 `total.js`의 `lineVat`을 import한다. 동작 문제는 없고(순환 없음) 규칙을 한 곳에 두는 의도라 변경 제안 없음.

## 반영
없음

## 반영하지 않은 지적
- 1, 2 (사람이 "반영하지 않음"을 골랐다)

## 완료조건 판정
| 완료조건 | 판정 | 근거 |
|---|---|---|
| 재현 절차가 더 이상 실패하지 않는다 (`examples/INV-2031.json`의 합계가 29,079원이다) | 통과 | `node /tmp/repro.mjs` 직접 실행: vat 2641, total 29079 (fix.md의 수정 전 값 2644/29082와 비교) |
| `npm test`가 통과한다 | 통과 | `npm test`: 50 pass / 0 fail |
| 기존 테스트를 약화하거나 삭제하지 않는다 | 통과 | `git diff 2ea930a`에서 테스트 파일은 추가만 있고 삭제·수정된 줄 없음 |
| 부가세가 줄별 원 단위 버림 값의 합임을 검증하는 테스트가 추가된다 | 통과 | test/total.test.js INV-2031 테스트(536+633+325+837+310), test/credit-note.test.js 반품 테스트 |
| 할인이 있는 줄은 할인 후 금액 기준으로 부가세가 계산됨을 검증하는 테스트가 있다 | 통과 | test/total.test.js '할인이 있는 줄은 할인 후 금액에 부가세를 매기고 버린다' (539+145), `npm test` 통과 |
| 면세 줄과 영세율(`zeroRated`) 청구서의 부가세는 계속 0원 처리된다 | 통과 | `lineVat`이 `zeroRated \|\| !row.taxable`이면 0. test/total.test.js 면세/영세율 테스트 통과 |
| `src/format/`의 출력 형식과 발행 청구서의 저장 합계 사용 방식이 바뀌지 않는다 | 통과 | `git diff 2ea930a --stat -- src/format` 변경 없음. 변경 파일은 total.js, credit-note.js 두 곳뿐이고 저장 합계 사용 코드는 건드리지 않음 |

## 테스트 파일 변경
- test/total.test.js — 약화 아님 — 테스트 3건만 추가, 기존 테스트 변경·삭제 없음
- test/credit-note.test.js — 약화 아님 — 테스트 1건만 추가, 기존 테스트 변경·삭제 없음

## 남은 위험
- 반품 할인 안분(`returnedDiscount`)의 `Math.round`는 그대로다 (지적 1).
- 이미 저장된 반품 전표와 발행 청구서는 저장 합계를 쓰므로 바뀌지 않는다. 발행 전 초안과 새 전표만 새 규칙을 따른다.
- `examples/INV-2031.json`은 `taxType`이 없어 `createInvoice` 정규화를 거쳐야 과세로 계산된다.
