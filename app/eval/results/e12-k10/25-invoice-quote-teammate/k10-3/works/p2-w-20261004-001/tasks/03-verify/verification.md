## 리뷰 지적
1. [권장] docs/knowledge/invoice/vat-rule.md, vat-per-line-floor.md — `quoteTotals`를 "합계 반올림 방식"으로, `computeTotals`도 "합계 Math.round"로 적고 있어 현재 코드와 다르다. 견적서를 고쳤으므로 갱신 제안.
2. [사소] docs/knowledge/invoice/vat-per-line-floor.md — 견적서·반품 전표를 함께 묶은 "정하지 않은 것"에서 반품 전표는 이미 다른 Work가 고쳤다. 견적서 항목만 남기도록 정리 제안.
(코드 지적은 없음. `src/invoice/quote.js:39` 한 줄 변경은 원인과 일치하고 비목표를 건드리지 않는다.)

## 반영
- 1, 2 — vat-rule.md의 "아직 규칙을 따르지 않는 곳"을 `computeTotals`(lineVat에 객체 전달, 사람이 범위에서 뺌)로 고치고 `quoteTotals` 줄을 지움. vat-per-line-floor.md의 "아직 정하지 않은 것"을 견적서 건 하나로 정리. 각 `바뀐 이력` 추가. 커밋 3e61f30. `npm test` → pass 46 / fail 9 (반영 전과 같음, 문서만 변경). 재현 절차 변경 없음.

## 반영하지 않은 지적
없음

## 완료조건 판정
| 완료조건 | 판정 | 근거 |
|---|---|---|
| 재현 절차가 더 이상 실패하지 않는다 (Q-0457 견적 합계가 56,278원이다) | 통과 | `node --test test/quote.test.js` pass 4 / fail 0. `createQuote(examples/Q-0457.json).totals` = supply 52691, taxable 35891, exempt 16800, vat 3587, total 56278 |
| `npm test`가 통과한다 | 실패 | pass 46 / fail 9 (15,16,17,23,25,31,50,51,55). 기준 커밋에서도 실패한 건이며 원인은 비목표인 `computeTotals`가 `lineVat`에 객체를 넘기는 것(`src/invoice/total.js:31`). 수정 전 11건에서 2건 줄었고 새 실패 없음. 사람이 완료 화면으로 진행(경고)을 선택 |
| 기존 테스트를 약화하거나 삭제하지 않는다 | 통과 | `git diff 8e0beb3 --stat -- test` 결과 변경 없음 |
| Q-0457의 면세 줄(세무 실무 가이드)에는 부가세가 붙지 않는다 | 통과 | 위 totals에서 exempt 16800, vat 3587은 과세분 35891 줄별 버림 합. 테스트 통과 |
| 영세율 견적(`zeroRated`)의 부가세는 0이다 | 통과 | Q-0457에 `zeroRated: true`로 `createQuote` 시 vat 0, total 52691. 영세율 테스트 통과 |
| 견적 번호 형식 검사와 유효 기간 계산 결과는 수정 전과 같다 | 통과 | 변경은 `quoteTotals`의 1줄뿐(`git diff`). 번호·유효 기간 코드 불변, quote 테스트 4건 통과 |

## 테스트 파일 변경
없음

## 남은 위험
- `computeTotals`(`src/invoice/total.js:31`)가 같은 객체 전달 버그로 면세·영세율 청구서 부가세를 과다 계산하고 npm test 9건이 실패한다. 별도 Work 필요.
- 견적서에 줄별 버림 규칙을 적용하는 것은 확정이 아니다(회계팀과 맞춘 동료 휴가 중). 경리 금액 56,278원과의 일치만 근거다.
- 요청의 56,280원 출처 미확인.
- INV-2031 `computeTotals` 출력의 `taxable`이 0으로 나오는 원인은 확인하지 못했다.
