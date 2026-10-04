# fix: 부가세를 과세 품목별 원 단위 버림 후 합산으로 계산 (청구서, 반품 전표)

## 요약
청구서 합계가 회계팀 계산보다 몇 원 크게 나오는 문제를 고쳤다. INV-2031은 29,082원에서 29,079원(부가세 2,641원)이 된다.

## 원인
부가세를 과세 공급가액 합계에 10%를 곱해 한 번에 반올림했다. 회계팀은 품목별로 버림 후 합산한다. 반품 전표(`creditTotals`)에도 같은 식이 있었다.

## 변경
- `src/invoice/total.js`: `lineVat(net)` 추가(할인 후 줄 공급가액 × 10% 원 단위 버림). `computeTotals`는 과세 줄별로 합산한다.
- `src/invoice/credit-note.js`: `creditTotals`도 `lineVat`을 쓴다.
- `docs/knowledge/invoice/vat-per-line-floor.md`: 규칙을 팀 지식으로 남겼다.
- 발행된 청구서와 전표는 저장된 합계를 그대로 쓰고, `src/format/`은 바꾸지 않았다.

## 테스트
- `npm test`: 49 통과, 0 실패
- 새 테스트: INV-2031(vat 2,641 / total 29,079), 할인 줄 버림, 전량 반품 전표
- 일부 수량 반품의 1원 차이 가능성은 확인하지 않았다.
