## 리뷰 지적
없음

## 반영
없음

## 반영하지 않은 지적
없음

## 완료조건 판정
| 완료조건 | 판정 | 근거 |
|---|---|---|
| 재현 절차(`node src/cli.js examples/Q-0457.json`)가 합계 56,278원을 낸다 | 통과 | 직접 실행: supply 52691, vat 3587, total 56278 |
| `npm test`가 통과한다 | 통과 | 직접 실행: 58건 통과, 0건 실패 |
| 기존 테스트를 약화하거나 삭제하지 않는다 | 통과 | 기준 커밋 이후 test/ 변경 없음(`git diff 9b8527d --stat -- test`가 비어 있음) |
| Q-0457 합계가 공급가액 52,691원, 부가세 3,587원, 합계 56,278원임을 확인하는 테스트가 통과한다 | 통과 | test/vat-rule.test.js:55 `Q-0457 예시` 통과 (npm test 55번 ok) |
| 견적 번호 형식과 유효 기간 계산 결과가 수정 전과 같다 | 통과 | `src/invoice/quote.js`는 기준 커밋 이후 변경 없음. CLI 출력 validUntil 2026-10-19 |
| `creditTotals`가 `lineVat`/`sumLineVat`을 쓰고, CN-0112 예시가 나온다 | 통과 | src/invoice/credit-note.js:92 `sumLineVat(rows, note.zeroRated)`. test/vat-rule.test.js:60 CN-0112 [17438, 1742, 19180] 통과 |

## 테스트 파일 변경
없음

## 남은 위험
- 56,280원의 출처는 풀리지 않았다. 견적 코드에서 그 값이 나오는 경로는 없다.
- 이 Work로 견적 코드는 바뀐 것이 없다. Q-0457 단언은 기존 테스트에 있다.
