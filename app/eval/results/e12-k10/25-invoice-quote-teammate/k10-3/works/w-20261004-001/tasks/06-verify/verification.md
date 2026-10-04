## 리뷰 지적
1. [사소] src/index.js:3 — 새 `floorPercentOf`가 `percentOf`와 달리 공개 export에 없다. 내부(`lineVat`) 전용이라 필수는 아니고, 필요하면 추가를 제안한다.

## 반영
없음 (사람이 반영하지 않음을 골랐다)

## 반영하지 않은 지적
- 1

## 완료조건 판정
| 완료조건 | 판정 | 근거 |
|---|---|---|
| 재현 절차가 더 이상 실패하지 않는다 (INV-2031 합계가 29,079원) | 통과 | `computeTotals(createInvoice(examples/INV-2031.json))` 직접 실행: vat 2641, total 29079 |
| `npm test`가 통과한다 | 통과 | `npm test`: tests 54, pass 54, fail 0 |
| 기존 테스트를 약화하거나 삭제하지 않는다 | 통과 | `git diff 403bb0f`에서 test 3개 파일 모두 추가만 있고 삭제·수정한 줄 없음 |
| 청구서 부가세 줄별 버림 합 테스트 | 통과 | test/total.test.js 신규 2개(INV-2031, 할인 후 금액·면세 줄). 전체 통과 |
| 견적서 부가세 같은 규칙 테스트 | 통과 | test/quote.test.js 신규 Q-0457 테스트(vat 995+841+886+865, 합계 56,278). 전체 통과 |
| 반품 전표 부가세 같은 규칙 테스트 | 통과 | test/credit-note.test.js 신규 줄별 버림 테스트. 전체 통과 |
| 면세 줄 0, 영세율 문서 0 | 통과 | `lineVat`이 면세·영세율이면 0. 영세율 테스트 견적·반품 전표 추가, 면세 줄은 청구서·견적서·반품 전표 테스트에 포함. 청구서 영세율은 기존 테스트가 다룸 |
| 발행된 청구서 저장 합계와 `src/format/` 출력 불변 | 통과 | `git diff 403bb0f --stat -- src/format` 변경 없음. `invoiceTotals`는 발행본의 저장 `totals`를 그대로 반환(코드 확인) |
| 반품 전표·원 청구서 부가세 맞물림 확인 결과가 handoff에 있다 | 통과 | 수치는 fix.md 기준(INV-2047 3원, CN-0112 2원 차이). 이 task의 handoff `## 다음 task가 알아야 할 것`에 다시 적었다 |

## 테스트 파일 변경
- test/total.test.js — 약화 아님 — 신규 테스트 2개 추가만, 기존 줄 변경 없음
- test/quote.test.js — 약화 아님 — 신규 테스트 2개 추가만, 기존 줄 변경 없음
- test/credit-note.test.js — 약화 아님 — 신규 테스트 2개 추가만, 기존 줄 변경 없음

## 남은 위험
- 옛 규칙으로 저장된 청구서에 새 규칙 반품 전표를 붙이면 부가세가 어긋난다(INV-2047 전부 반품 3원, CN-0112 일부 반품 2원). 보정 규칙은 없고 사람이 판단할 일이다.
- quote.js와 credit-note.js가 total.js의 `lineVat`을 가져다 쓴다(모듈 의존 추가).
- 일부 반품은 `returnedDiscount`의 수량 비율 반올림 때문에 새 규칙 청구서와도 줄 값이 달라질 수 있다.
