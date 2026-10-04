# fix: 반품 전표 부가세를 과세 줄마다 버림해 합산

## 요약
반품 전표를 새로 만들 때 부가세를 회계팀 규칙(과세 줄마다 할인 후 금액에 원 단위 버림, 그 합)으로 계산한다. CN-0112 환불 합계가 19,182원에서 19,180원으로 바뀐다.

## 원인
`creditTotals`가 과세 줄 net 합에 세율을 곱해 `Math.round`를 한 번만 적용했다. 줄별 버림 합(1,742)과 합산 후 반올림(1,744)이 달라졌다.

## 변경
- `src/invoice/credit-note.js`: `creditTotals`의 부가세를 줄별 `Math.floor` 합으로 변경
- `test/credit-note.test.js`: CN-0112 재현 테스트 추가
- `docs/knowledge/invoice/vat-per-line-floor.md`: 반품 전표가 규칙을 따르게 되어 항목 정리
- 저장된 `totals`를 쓰는 경로와 `src/format/`은 변경 없음

## 테스트
- `npm test`: 47개 모두 통과
- INV-2047 + CN-0112 재현: 부가세 1,742원, 합계 19,180원
