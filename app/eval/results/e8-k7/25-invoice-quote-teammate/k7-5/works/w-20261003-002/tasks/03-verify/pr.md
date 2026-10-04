# fix: 반품 전표 부가세를 과세 줄마다 버림해 합산

## 요약
반품 전표의 부가세를 회사 규칙(과세 줄마다 할인 후 금액 × 세율을 원 단위 버림, 줄별 합산)으로 계산한다. CN-0112 환불 합계가 19,182원에서 19,180원이 된다.

## 원인
`creditTotals`가 과세 공급가액 합계에 세율을 곱해 `Math.round`로 한 번만 반올림했다(17,438 × 10% = 1,743.8 → 1,744). 줄별로 버림하면 923+612+207 = 1,742원이다.

## 변경
- `src/invoice/credit-note.js`의 `creditTotals`: 과세 줄마다 `Math.floor(net × 세율 / 100)`을 합산. 영세율은 0, 면세 줄은 제외.
- 저장된 `totals`를 쓰는 `creditNoteTotals`와 `src/format/`은 변경 없음.
- `lineVat`(src/invoice/total.js)은 이 브랜치에 없어 쓰지 않았다. 앞 Work 머지 뒤 합칠 수 있다.

## 테스트
- `npm test`: 50 pass, 0 fail
- 추가: CN-0112 재현(vat 1,742 / 합계 19,180, 영세율 0), 면세 줄 제외
