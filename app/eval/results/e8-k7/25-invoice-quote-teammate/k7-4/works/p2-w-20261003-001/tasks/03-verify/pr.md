# fix: 반품 전표 부가세 계산의 미정의 VAT_RATE_PERCENT 참조 제거

## 요약
견적서 Q-0457 합계(56,278원)는 기준 커밋에서 이미 규칙대로 계산되어 재현되지 않았다. 대신 `npm test`를 깨던 반품 전표의 미정의 참조를 고쳤다.

## 원인
`credit-note.js`가 import 없이 `VAT_RATE_PERCENT`를 써서 `ReferenceError`가 났다(반품 전표 테스트 6건 실패).

## 변경
- `src/invoice/credit-note.js`: 부가세를 `lineVat(r.net)`으로 계산 (값은 동일)
- `docs/knowledge/`: 견적 번호·유효 기간 규칙, 반품 전표 참조 실패 유형 추가
- 견적서 코드, 견적 번호 형식, 유효 기간 계산은 바꾸지 않았다.

## 테스트
- `npm test`: 60개 중 60 통과
- 견적서 재현은 되지 않아 "더 이상 실패하지 않는다"는 판정 불가
