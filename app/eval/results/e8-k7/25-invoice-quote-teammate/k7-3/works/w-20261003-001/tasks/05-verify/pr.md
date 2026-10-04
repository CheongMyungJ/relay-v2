# fix: 부가세를 줄별 원 단위 버림 합으로 계산 (청구서·견적서·반품 전표)

## 요약
회계팀 기준(과세 줄마다 할인 후 금액에 부가세를 매겨 원 단위 버림, 그 합이 부가세)에 맞춰 INV-2031 합계 29,082원 → 29,079원으로 바로잡는다. 견적서와 반품 전표도 같은 규칙을 쓴다.

## 원인
청구서·반품 전표는 과세 공급가액 합계에 부가세를 한 번 `Math.round`했고, 견적서는 할인 전 금액 기준으로 계산했다. 줄별 버림 합이 아니라 몇 원씩 차이가 났다.

## 변경
- `src/invoice/total.js`: 공용 `vatOfRows` 추가(영세율 0, 면세 줄 제외), `computeTotals`가 사용
- `src/invoice/credit-note.js`, `src/invoice/quote.js`: `vatOfRows` 사용
- 발행된 청구서 저장 합계 로직과 `src/format/`은 변경 없음
- `docs/knowledge/`에 회계 규칙 지식 추가

## 테스트
- `npm test` 53개 통과 (신규 5개: INV-2031, 할인·면세, Q-0457·영세율, CN-0112, 발행분 저장 합계 유지)
- `node src/cli.js examples/INV-2031.json --totals` → 29,079원, Q-0457 vat 3,587, CN-0112 vat 1,742
- 이미 나간 견적과 새 견적의 값이 다를 수 있음. PDF 출력은 실행하지 않음
