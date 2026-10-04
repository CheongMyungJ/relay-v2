# fix: 반품 전표 부가세를 과세 줄마다 버림해서 합산

## 요약
새로 만드는 반품 전표의 환불 금액이 회계팀 계산과 몇 원씩 어긋나던 문제를 고쳤다. CN-0112 환불 합계가 19,182원에서 19,180원이 된다.

## 원인
`creditTotals`가 과세 공급가액 합계에 한 번 `Math.round`해서 부가세를 구했다. 팀 규칙은 과세 줄마다 `Math.floor`한 값의 합이다(CN-0112: 합계 반올림 1,744원, 줄별 버림 1,742원).

## 변경
- `src/invoice/credit-note.js`: `creditTotals`의 부가세를 줄별 버림 합으로 바꿨다. 영세율은 0 그대로.
- 저장된 `totals`를 쓰는 `creditNoteTotals`, `src/format/`, 청구서 계산은 바꾸지 않았다.
- `docs/knowledge/credit-note-vat-separate-copy.md`: 반품 전표도 줄별 버림으로 맞췄다는 내용으로 갱신.

## 테스트
- `npm test`: 48개 통과.
- `test/credit-note.test.js`에 CN-0112 테스트와 저장 totals 보존 테스트 추가. CN-0112 테스트는 수정 전 실패(부가세 1,744원).
- 확인 못 한 것: 반품 줄 할인 반올림이 회계팀 방식과 같은지, 청구서 부가세(머지 대기 중인 앞 Work)와의 일치.
