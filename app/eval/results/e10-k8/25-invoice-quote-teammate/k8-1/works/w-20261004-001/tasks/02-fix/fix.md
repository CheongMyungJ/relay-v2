## 재현
- 재현 절차: `node src/cli.js examples/INV-2031.json --totals`
- 결과: 재현됨
- 기대: vat 2,641 / total 29,079
- 실제: vat 2,644 / total 29,082

## 원인
- 원인: `computeTotals`가 과세 공급가액 합계(26,438)에 부가세를 한 번만 매기고 `Math.round`로 반올림해서, 줄별 버림 합(2,641)과 어긋난다.
- 근거: `src/invoice/total.js`의 `Math.round((taxable * VAT_RATE_PERCENT) / 100)` = round(2643.8) = 2,644. 줄별 net 5368/6335/3255/8375/3105의 버림 VAT는 536+633+325+837+310 = 2,641. 수정 뒤 CLI 합계가 29,079로 바뀌는 것을 실험으로 확인했다.
- 사람 추정 판정: "반올림 문제로 보인다" — 맞음. 합계 단위 반올림이 원인이다. 다만 고칠 방향은 반올림 방식 조정이 아니라 줄별 버림 계산으로 바꾸는 것이다.
- 기각한 가설: 없음

## 변경 요약
- `src/invoice/total.js` — 부가세를 할인된 과세 줄 금액마다 `Math.floor`로 계산해 합산하도록 바꿨다(`lineVat` 추가). 영세율은 그대로 0이다.
- `test/total.test.js` — 재현 테스트 2개를 추가했다. 기존 테스트는 바꾸지 않았다.

## 재현 테스트
- 위치: `test/total.test.js` 끝의 두 테스트(INV-2031, 할인 줄과 면세 줄이 섞인 경우)
- 수정 전: 실패 (`npm test` → pass 48 / fail 2, 49·50번 실패)
- 수정 후: 통과 (`npm test` → pass 50 / fail 0)

## 테스트 실행
- 명령: `npm test`
- 결과: 50개 통과, 0개 실패
- 실패 항목: 없음
