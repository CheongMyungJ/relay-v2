## 리뷰 지적
1. [사소] src/invoice/quote.js:32-35 — rows의 gross·discount 필드는 이제 net 계산에만 쓰여 불필요하다. net만 남기면 단순해진다.
2. [사소] src/invoice/quote.js:42 — 줄별 버림 식이 total.js, credit-note.js, quote.js에 세 번 복제됐다. 공용 함수 추출을 제안하지만 청구서·반품 전표 계산 변경은 비목표라 이번 범위 밖이다.

## 반영
없음

## 반영하지 않은 지적
- 1
- 2

## 완료조건 판정
| 완료조건 | 판정 | 근거 |
|---|---|---|
| 재현 절차가 더 이상 실패하지 않는다 (examples/Q-0457.json의 견적 합계가 56,278원이다) | 통과 | createQuote로 examples/Q-0457.json을 읽어 직접 실행: vat 3587, total 56278 (수정 전 3589 / 56280) |
| `npm test`가 통과한다 | 통과 | `npm test`: 57건 통과, 0건 실패 |
| 기존 테스트를 약화하거나 삭제하지 않는다 | 통과 | `git diff ec813a9 -- test`: test/quote.test.js에 테스트 2건 추가만 있고 기존 줄 변경·삭제 없음 |
| 견적 부가세가 과세 줄마다 할인 후 공급가액 × 세율을 원 단위 버림으로 계산한 값의 합이다 | 통과 | quote.js:42가 total.js:29와 같은 식. Q-0457 손계산 995+841+886+865=3,587과 실행 결과 일치 |
| 면세 줄과 `zeroRated` 견적의 부가세는 0이다 | 통과 | 면세 줄은 taxableRows에서 제외(Q-0457의 면세 16,800원은 부가세에 불포함), zeroRated는 0 분기. 영세율 테스트 통과 |
| 견적 번호 형식 검사와 `quoteValidUntil`·`isQuoteExpired` 결과가 수정 전과 같다 | 통과 | `git diff`에서 createQuote 검증부, quoteValidUntil, isQuoteExpired 변경 없음(import와 vat 식·주석만 변경). 기존 테스트 통과 |
| Q-0457 합계 56,278원(부가세 3,587원)을 검증하는 테스트가 추가된다 | 통과 | test/quote.test.js '견적 부가세는 과세 줄마다 … (Q-0457)'가 vat 3587, total 56278을 검증하고 npm test에서 통과 |

## 테스트 파일 변경
- test/quote.test.js — 약화 아님 — 테스트 2건(Q-0457, 영세율)만 추가했고 기존 'Q-0401' 테스트는 그대로다

## 남은 위험
- 줄별 버림 식이 세 곳에 복제되어 있어 규칙이 바뀌면 함께 고쳐야 한다.
- 이미 발송한 견적서는 저장된 totals가 없어 재계산하면 값이 달라질 수 있다(견적은 createQuote 때 계산한다. 이미 보낸 견적의 금액은 확인하지 않음).
