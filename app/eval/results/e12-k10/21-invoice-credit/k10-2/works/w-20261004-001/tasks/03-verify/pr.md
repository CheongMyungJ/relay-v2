# fix: 청구서 부가세를 과세 줄마다 원 단위 버림으로 합산

## 요약
청구서 부가세가 회계팀 계산보다 커지던 문제를 고쳤다. INV-2031 합계가 29,082원에서 29,079원이 된다.

## 원인
`src/invoice/total.js`가 과세 공급가 합계에 세율을 한 번 곱해 `Math.round`로 반올림했다. 회계팀은 줄마다 버림 후 합산하므로 값이 더 커졌다.

## 변경
- `src/invoice/total.js`: 부가세를 과세 줄마다 `Math.floor(net*10/100)` 한 값의 합으로 계산. 영세율은 0, 면세 줄은 제외.
- `test/total.test.js`: INV-2031 테스트와 할인·면세 혼합 테스트 추가.
- `docs/knowledge/invoice/vat-per-line-floor.md`: 회계팀 부가세 규칙 기록.
- 반품 전표(`credit-note.js`)는 이번 범위에서 제외.

## 테스트
`npm test` 48개 통과. INV-2031 직접 실행 결과 vat 2,641원, 합계 29,079원.
