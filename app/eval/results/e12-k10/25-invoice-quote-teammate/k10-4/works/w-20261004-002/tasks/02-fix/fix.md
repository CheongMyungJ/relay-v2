## 재현
- 재현 절차: `examples/INV-2047.json`을 청구서로, `examples/CN-0112.json`을 data로 `createCreditNote(inv, cn).totals`를 출력 (인라인 스크립트)
- 결과: 재현됨
- 기대: 부가세 1,742원, 환불 합계 19,180원
- 실제: `{ supply: 17438, taxable: 17438, exempt: 0, vat: 1744, total: 19182 }`

## 원인
- 원인: `creditTotals`가 과세 합계 전체에 한 번 `Math.round`로 부가세를 매겨, 줄별 원 단위 버림 규정과 몇 원 어긋난다.
- 근거: `src/invoice/credit-note.js` creditTotals의 `Math.round((taxable * VAT_RATE_PERCENT) / 100)`. 줄별 버림으로 바꾸자 CN-0112가 vat 1,742 / total 19,180으로 나옴(실험함).
- 사람 추정 판정: 없음
- 기각한 가설: 없음

## 변경 요약
- src/money.js — `floorPercentOf`(원 단위 버림) 추가. 이 브랜치에는 없었음(앞 Work에서 추가했을 수 있음, 머지 시 충돌 가능)
- src/invoice/credit-note.js — 부가세를 과세 줄마다 `floorPercentOf(r.net, 세율)`로 계산해 합산. 영세율은 0, 면세 줄은 제외(기존과 동일). 저장된 totals를 쓰는 `creditNoteTotals`는 그대로

## 재현 테스트
- 위치: test/credit-note.test.js '반품 전표 부가세는 과세 줄마다 원 단위 버림으로 더한다' (저장 totals 반환 테스트도 추가)
- 수정 전: 실패 (credit-note.js를 되돌리고 `npm test` → fail 1, 해당 테스트)
- 수정 후: 통과 (`npm test` → pass 50, fail 0)

## 테스트 실행
- 명령: `npm test`
- 결과: 50 통과, 0 실패
- 실패 항목: 없음
