# fix: 청구서 부가세를 줄별 버림으로 계산

## 요약
청구서 부가세를 회계팀 계산 방식(품목 줄마다 원 단위 버림 후 합산)과 같게 맞췄다. INV-2031 합계는 29,082원에서 29,079원이 된다.

## 원인
부가세를 과세 공급가액 합계에 한 번 `Math.round`해서 구했다. 줄별 소수점 잔여분이 반올림으로 쌓여 회계팀 값과 3원 차이가 났다.

## 변경
- `src/invoice/total.js`: 과세 줄마다 `Math.floor(할인 후 금액 × 세율 / 100)`를 구해 합산. 영세율은 0, 면세 줄은 제외.
- `docs/knowledge/invoice/vat-per-line-floor.md`: 규칙 기록.
- 반품 전표(`credit-note.js`)는 이번 범위가 아니라 바꾸지 않았다.

## 테스트
- `npm test`: 51 pass / 0 fail (테스트 5개 추가: 줄별 버림, INV-2031, 할인 줄, 면세 줄, 영세율)
- `node src/cli.js examples/INV-2031.json --totals`: vat 2,641 / total 29,079
