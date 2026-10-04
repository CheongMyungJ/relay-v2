## 리뷰 지적
1. [사소] src/invoice/quote.js:32-37 — `quoteTotals`가 total.js의 `lineAmounts`와 같은 행 계산(gross/discount/net/taxable)을 중복한다. `lineAmounts`를 재사용하면 줄일 수 있다. 이번 원인과 무관한 기존 구조이고 변경 범위가 커진다.

(원인 수정 자체는 적절하다: `lineVat(net)` 호출 오류를 견적·청구서 두 곳에서 고쳤고 증상 회피가 아니다. 반품 전표는 이미 올바르다. 영세율·면세 줄 처리는 기존 그대로 유지된다.)

## 반영
없음

## 반영하지 않은 지적
- 1 (사람이 반영하지 않음을 선택)

## 완료조건 판정
| 완료조건 | 판정 | 근거 |
|---|---|---|
| 재현 절차(`examples/Q-0457.json`으로 견적서를 만들어 합계 확인)가 더 이상 실패하지 않는다 | 통과 | fix.md의 재현 명령을 다시 실행: 예외 없이 `{supply:52691, taxable:35891, exempt:16800, vat:3587, total:56278}` 출력. fix.md 기록상 수정 전 NaN 예외로 재현됨 |
| `npm test`가 통과한다 | 통과 | `npm test` → 54 통과, 0 실패 |
| 기존 테스트를 약화하거나 삭제하지 않는다 | 통과 | 바뀐 테스트 파일은 test/credit-note.test.js 하나이며 중복 import 한 줄 삭제뿐. 단언 변경 없음 |
| Q-0457의 합계(`totals.total`)가 56,278원이다 | 통과 | 위 재현 명령 출력 total 56278 |
| Q-0457 합계를 고정하는 회귀 테스트가 추가되어 있다 | 통과 | test/quote.test.js:21 "(Q-0457)"가 `deepStrictEqual`로 total 56278, vat 3587을 고정. 기준 커밋 이전부터 있던 테스트이며 이번에 새로 추가되지는 않았으나, 요구한 회귀 고정은 충족. 수정 전 실패(fix.md), 수정 후 통과(직접 실행) |
| 견적 번호 검증과 `quoteValidUntil`의 결과가 수정 전과 같다 | 통과 | `git diff d029aad`가 quote.js 42행의 `lineVat` 호출만 바꿈. 번호 정규식, `quoteValidUntil`, `isQuoteExpired`, `DEFAULT_VALID_DAYS` 미변경. 번호 검증 테스트(test/quote.test.js:13) 통과 |

## 테스트 파일 변경
- test/credit-note.test.js — 약화 아님 — 중복된 `readFileSync` import 한 줄만 삭제(중복 선언으로 SyntaxError였음). 단언·테스트 케이스 변경 없음. 수정 후 이 파일 테스트 통과

## 남은 위험
- 요청의 "현재 합계 56,280원"은 현 코드에서 재현되지 않고 실제 증상은 NaN 예외였다(합계 기준 반올림 값으로 추정).
- quote.js와 total.js의 행 계산 중복(지적 1)이 남아 있어, 같은 로직이 어긋날 위험이 있다.
- 새 회귀 테스트는 추가되지 않았고 기존 Q-0457 테스트에 의존한다. 청구서 쪽 `lineVat` 호출 오류를 직접 잡는 전용 테스트는 확인하지 못했다(npm test 전체로 간접 확인).
