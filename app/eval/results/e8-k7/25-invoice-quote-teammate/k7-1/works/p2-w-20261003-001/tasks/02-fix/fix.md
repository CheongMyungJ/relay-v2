## 재현
- 재현 절차: `node -e "import('./src/invoice/quote.js').then(m=>console.log(m.createQuote(JSON.parse(require('fs').readFileSync('examples/Q-0457.json'))).totals))"`
- 결과: 재현됨
- 기대: 부가세 3,587원(줄별 995+841+886+865), 합계 56,278원
- 실제: 부가세 3,589원, 합계 56,280원 (2원 차이)

## 원인
- 원인: `quoteTotals`가 과세 줄의 할인 전 금액 합과 할인 합에 각각 세율을 곱해 반올림한 뒤 빼서, 줄별 버림 규칙과 몇 원 어긋났다.
- 근거: 수정 전 `src/invoice/quote.js` 부가세 식. 줄별 계산(할인 후 net 9955/8412/8868/8656 → 버림 995/841/886/865)은 3,587원으로 실측 출력과 2원 차이. 수정 후 재현 값이 3,587원이 됨.
- 사람 추정 판정: 없음
- 기각한 가설: 저장된 totals 때문에 재계산이 안 됨 — 견적서는 `createQuote`에서만 `quoteTotals`를 호출해 저장하고 별도 재계산 경로가 없어 해당 없음.

## 변경 요약
- src/invoice/quote.js — 부가세를 청구서(total.js)와 같은 과세 줄별 `Math.floor(net × 세율 / 100)` 합산으로 변경. 쓰지 않게 된 `percentOf` import 제거. 견적 번호 검증·유효 기간 코드는 그대로.
- test/quote.test.js — 테스트 추가(기존 테스트 변경 없음).

## 재현 테스트
- 위치: test/quote.test.js '견적 부가세는 과세 줄별 할인 후 금액의 원 단위 버림 합이다 (Q-0457)', '영세율 견적은 부가세 0원'
- 수정 전: 실패 (`npm test` → not ok 47, vat 3589 ≠ 3587)
- 수정 후: 통과 (`npm test` → pass 55, fail 0)

## 테스트 실행
- 명령: npm test
- 결과: 55개 통과, 0 실패
- 실패 항목: 없음
