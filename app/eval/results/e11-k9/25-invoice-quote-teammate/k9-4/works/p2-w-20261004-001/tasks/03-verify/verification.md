## 리뷰 지적
1. [사소] src/invoice/quote.js:39, src/invoice/total.js:26 — `rows.filter(r => r.taxable).map(r => r.net)`가 같은 파일의 taxable 계산과 중복된다. 변수로 뽑을 수 있다. 동작에는 문제 없음.

(그 밖에 원인 일치 확인: 3cccc30의 sumLineVat 시그니처 변경에 호출부를 맞춘 것으로 증상 은폐가 아니다. 서식 모듈과 quoteValidUntil은 변경 없음.)

## 반영
- 없음

## 반영하지 않은 지적
- 1 (사람이 반영하지 않음을 선택)

## 완료조건 판정
| 완료조건 | 판정 | 근거 |
|---|---|---|
| 재현 절차가 더 이상 실패하지 않는다 (Q-0457의 합계가 부가세 규칙대로 계산된 값과 같다) | 통과 | 재현 명령 재실행: supply 52691, taxable 35891, exempt 16800, vat 3587, total 56278. 줄별 손계산(995+841+886+865=3587)과 일치 |
| `npm test`가 통과한다 | 통과 | `npm test` 52 pass / 0 fail |
| 기존 테스트를 약화하거나 삭제하지 않는다 | 통과 | 기준 커밋 이후 test/ 변경 없음 (`git diff 0fc8b31 --name-only -- test` 빈 결과) |
| Q-0457의 공급가액·부가세·합계가 줄별 계산 규칙으로 손계산한 값과 일치하는 테스트가 있다 | 통과 | test/quote.test.js:34가 supply 52691 / vat 3587 / total 56278을 단언하고 통과 |
| 견적 번호 검증과 `quoteValidUntil`/`isQuoteExpired`의 결과가 수정 전과 같다 | 통과 | 해당 코드 변경 없음(diff는 quote.js:39 한 줄뿐), 관련 테스트 통과 |

## 테스트 파일 변경
- 없음

## 남은 위험
- total.js(청구서)도 호출을 고쳐 비목표와 걸치지만 사람이 포함하기로 결정했고, 발행된 청구서는 저장된 totals를 써서 영향 없음
- 보고된 56,280원이 옛 계산값이라는 추정은 확인하지 못함 (규칙 값은 56,278원)
- docs/knowledge/invoice/에 내용이 겹치는 항목 쌍이 있음(format-output-*, issued-*)
