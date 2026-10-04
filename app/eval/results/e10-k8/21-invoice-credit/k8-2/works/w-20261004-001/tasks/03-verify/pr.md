# fix: 부가세를 과세 줄별 원 단위 버림 합으로 계산

## 요약
청구서와 반품 전표의 부가세를 회계팀 방식(과세 줄마다 할인 후 금액의 10%를 원 단위 버림, 그 합)으로 계산한다. INV-2031은 부가세 2,641원, 합계 29,079원이 된다(기존 2,644원/29,082원).

## 원인
과세 공급가액 합계에 한 번만 10%를 매겨 `Math.round`했다. 줄 금액이 모두 10원 단위이면 두 방식이 같아 기존 테스트로는 드러나지 않았다.

## 변경
- `src/invoice/vat.js` 신규: `computeVat(rows, zeroRated)`. 과세 줄별 `Math.floor` 합, 영세율이면 0
- `src/invoice/total.js`, `src/invoice/credit-note.js`: `computeVat` 사용
- 발행된 청구서의 저장 합계와 `src/format/`은 변경 없음
- `docs/knowledge/invoice/`에 부가세 규칙 등 지식 항목 추가

## 테스트
- `npm test`: 51건 통과
- 새 테스트: INV-2031, 면세 혼합, 할인 줄(`test/total.test.js`), 반품 줄별 버림, 영세율 반품 0(`test/credit-note.test.js`). 수정 전 소스에서는 3건 실패
