# fix: 반품 전표 부가세의 미정의 참조를 lineVat으로 교체하고 Q-0457 합계 이력을 남김

## 요약
견적서 Q-0457 합계는 현재 코드에서 이미 56,278원(부가세 3,587원)이다. `npm test`를 막던 반품 전표의 깨진 참조를 고쳤다.

## 원인
56,280원은 초기 커밋의 옛 견적 계산식(할인 전 금액과 할인액에 각각 반올림)이 만든 값이다. 8c0b9cc에서 줄별 버림 합으로 이미 고쳐졌다. 반품 전표 테스트 5건은 90e0d19 이후 import하지 않은 `VAT_RATE_PERCENT`를 참조해 실패했다.

## 변경
- `src/invoice/credit-note.js`: `lineVat(r.net)` 사용 (규칙 변경 없음)
- `docs/knowledge/quote-q0457-old-total-56280.md`: 옛 합계의 출처 기록
- 견적 번호 형식, `quoteValidUntil`, `src/format/`은 변경 없음

## 테스트
- `npm test` 55/55 통과
- `node src/cli.js examples/Q-0457.json` → vat 3587, total 56278
