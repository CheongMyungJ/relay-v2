## 재현
- 재현 절차: 워크트리에서 `node /tmp/claude-0/repro.mjs` (`examples/INV-2047.json`에 `examples/CN-0112.json`로 `createCreditNote` 호출 후 `totals` 출력)
- 결과: 재현됨
- 기대: 줄별 버림 규칙 기준 vat 1,742 / total 19,180
- 실제: vat 1,744 / total 19,182

## 원인
- 원인: `creditTotals`가 과세 공급가액 합계에 `Math.round`로 부가세를 한 번 계산해, 줄별 버림 규칙(회계팀 규정)과 몇 원씩 어긋난다.
- 근거: `src/invoice/credit-note.js` `creditTotals`의 `Math.round((taxable * VAT_RATE_PERCENT) / 100)`. CN-0112 줄별 부가세는 923.6→923, 612.7→612, 207.5→207 = 1,742인데 합계 17,438×10%=1,743.8→1,744. 수정 후 1,742로 바뀌는 것을 실행으로 확인. 영세율·면세 줄은 기존대로 0/제외되어 영향 없음.
- 사람 추정 판정: 없음 (추가 의견은 기준 금액이 요청에 없다는 설명뿐)
- 기각한 가설: 할인 안분(`returnedDiscount`) 반올림 오류 — CN-0112는 전량 반품(금액 할인)과 비율 할인이라 안분 반올림이 개입하지 않고, 청구서 쪽 할인 방식과 같아 원인이 아님

## 변경 요약
- src/invoice/credit-note.js — 부가세를 과세 줄마다 `Math.floor(net × 세율 / 100)`로 계산해 `sumWon`으로 합산. 영세율은 0 유지.
- test/credit-note.test.js — 테스트 2개 추가(CN-0112 재현, 영세율 반품 부가세 0). 기존 테스트는 변경 없음.

## 재현 테스트
- 위치: test/credit-note.test.js `반품 부가세는 줄마다 원 단위 버림으로 계산해 합한다`
- 수정 전: 실패 (`npm test` → `not ok 6`, fail 1)
- 수정 후: 통과 (`npm test` → pass 50, fail 0)

## 테스트 실행
- 명령: `npm test`
- 결과: 50 통과, 0 실패
- 실패 항목: 없음
