## 리뷰 지적
1. [사소] test/quote.test.js:4 — `node:fs` import가 로컬 모듈 import 뒤에 있다. 내장 모듈 import를 위로 올리는 정리를 제안.
2. [사소] test/quote.test.js:37 — Q-0457 테스트는 수정 전(기준 커밋)에도 통과하는 회귀 가드다. 이번 수정(credit-note 중복 제거)이 고친 SyntaxError는 기존 credit-note/export 테스트가 잡는다. 코드 수정은 필요 없고 기록만.
(변경은 목표와 비목표에 맞다: quote.js, 견적 번호, 유효 기간 코드는 기준 커밋과 diff가 없다. credit-note.js의 `lineVat`/`sumLineVat` 제거는 total.js 공유 규정에 맞고, 남은 import 사용처(percentOf, sumWon, sumLineVat)도 모두 쓰인다.)

## 반영
없음

## 반영하지 않은 지적
- 1, 2 (사람이 "반영하지 않음" 선택)

## 완료조건 판정
| 완료조건 | 판정 | 근거 |
|---|---|---|
| 재현 절차가 더 이상 실패하지 않는다 (Q-0457 합계가 규정 계산값과 같다) | 판정 불가 | 이 Work는 재현 없이 진행했다(기준 커밋에서 이미 56,278). 다시 실행한 `createQuote(examples/Q-0457.json).totals`는 supply 52,691, vat 3,587, total 56,278로 규정값과 같으나, 수정 전에 실패한 적이 없어 "더 이상 실패하지 않음"을 판정할 수 없다. 요청의 56,280은 ee0adc0 이전 코드의 값. 사람이 완료 화면으로 진행을 선택 |
| `npm test`가 통과한다 | 통과 | `npm test`: 54개 중 54 통과, 실패 0 |
| 기존 테스트를 약화하거나 삭제하지 않는다 | 통과 | `git diff 41982d6`: 테스트 파일은 test/quote.test.js에 테스트 추가뿐, 삭제·변경된 단언 없음 |
| 견적 번호 형식과 유효 기간 계산의 결과가 수정 전과 같다 | 통과 | `git diff 41982d6 -- src/invoice/quote.js`가 비어 있고 quote.js는 ee0adc0 이후 변경 없음. 기존 quote 테스트 통과 |
| Q-0457 합계가 규정대로 줄별 계산한 값과 일치함을 보이는 테스트가 있다 | 통과 | test/quote.test.js의 'Q-0457 합계는 줄별 버림 규정 계산값과 같다'가 totals 전체(vat 3,587, total 56,278)를 단언하고 `npm test`에서 통과 |

## 테스트 파일 변경
- test/quote.test.js — 약화 아님 — Q-0457 테스트와 import 한 줄만 추가, 기존 단언은 그대로

## 남은 위험
- 거래처에 이미 56,280원 견적서를 보냈다면 새로 발행해야 한다(저장된 totals는 재계산하지 않음).
- 거래처 문의 값과 경리 계산 금액이 적혀 있지 않아 기준은 규정 계산값 56,278원이다.
- 새 Q-0457 테스트는 수정 전에도 통과한다(회귀 가드).
