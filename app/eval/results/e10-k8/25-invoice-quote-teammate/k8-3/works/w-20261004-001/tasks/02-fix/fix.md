## 재현
- 재현 절차: 워크트리에서 `node -e "import('./src/invoice/invoice.js').then(async a=>{const t=await import('./src/invoice/total.js');const fs=await import('fs');console.log(t.computeTotals(a.createInvoice(JSON.parse(fs.readFileSync('examples/INV-2031.json')))))})"`
- 결과: 재현됨
- 기대: vat 2,641 / total 29,079
- 실제: vat 2,644 / total 29,082

## 원인
- 원인: `computeTotals`가 과세 공급가액 합계(26,438)에 한 번만 `Math.round`로 부가세를 계산해(2643.8→2644), 줄별 버림 합(2641)보다 커진다.
- 근거: `src/invoice/total.js`의 vat 줄. 수정 전 위 명령 출력이 vat 2644. 품목에 taxType이 없어도 `normalizeLine`이 'taxable'로 채우므로 전부 과세로 계산된다(t-01의 미확인 사항은 문제 아님). 줄별 버림으로 바꾸자 29,079가 나옴. 줄 금액이 정확히 10의 배수가 아닌 경우(합계 반올림이 올림으로 갈 때)에만 차이가 난다.
- 사람 추정 판정: "반올림 문제 같다" — 맞음. 합계에서 한 번 반올림하는 것이 원인이다. 할인의 `percentOf` 반올림은 회계 규칙(할인 후 줄 금액 기준)과 무관해 원인이 아니다.
- 기각한 가설: `percentOf` 공용 함수 변경 — 부가세 계산이 이 함수를 쓰지 않고(`Math.round` 직접 사용) 할인에서도 쓰이므로 건드리지 않음.

## 변경 요약
- `src/invoice/total.js` — 부가세를 과세 줄마다 `Math.floor(net*10/100)`로 계산해 합산. 영세율은 그대로 0.
- `test/total.test.js` — 테스트 2개 추가 (기존 테스트 변경 없음).

## 재현 테스트
- 위치: `test/total.test.js` 마지막 두 테스트 (INV-2031 29,079원, 할인 후 줄별 버림·재반올림 없음)
- 수정 전: 실패 (`npm test` → 49, 50번 not ok, fail 2)
- 수정 후: 통과 (`npm test` → pass 50, fail 0)

## 테스트 실행
- 명령: `npm test`
- 결과: 50개 통과, 0 실패
- 실패 항목: 없음
