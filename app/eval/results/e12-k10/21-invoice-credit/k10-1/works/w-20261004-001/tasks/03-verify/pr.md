# 부가세를 과세 줄마다 원 단위 버림 후 합산하도록 수정

## 요약
청구서와 반품 전표의 부가세를 회계팀 규정(줄마다 버림 후 합산)대로 계산한다. INV-2031 합계는 29,082원에서 29,079원이 된다.

## 원인
과세 공급가액 합계에 한 번만 `Math.round`를 적용해, 줄 금액이 10의 배수가 아니면 줄별 버림 합과 어긋났다 (2,644원 대 2,641원).

## 변경
- `src/money.js`: `floorPercentOf` 추가
- `src/invoice/total.js`, `src/invoice/credit-note.js`: 과세 줄마다 버림해 합산 (영세율 0)
- `src/format/`과 이미 발행된 청구서의 저장 합계는 바꾸지 않음
- `docs/knowledge/billing/vat-per-line-floor.md`: 규칙 기록

## 테스트
- `npm test`: 49개 통과
- `node src/cli.js examples/INV-2031.json --totals`: vat 2641, total 29079
- 새 테스트 3개(INV-2031, 할인 줄, 반품 전표). 수정 전 실패 확인
