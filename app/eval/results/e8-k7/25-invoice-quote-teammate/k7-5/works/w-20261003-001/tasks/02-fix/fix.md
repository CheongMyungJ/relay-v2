## 재현
- 재현 절차: `node src/cli.js examples/INV-2031.json --totals`
- 결과: 재현됨
- 기대: vat 2,641 / total 29,079
- 실제: vat 2,644 / total 29,082

## 원인
- 원인: `computeTotals`가 과세 공급가액 합계 전체(26,438)에 한 번만 `Math.round(×10/100)` 해서 줄별 버림 합(2,641)과 3원 차이가 났다.
- 근거: `src/invoice/total.js:26`(수정 전). 줄별 버림 536+633+325+837+310=2,641. 수정 후 CLI 출력이 2,641/29,079로 바뀜. 수정 전 코드로 되돌리면(stash) 새 테스트 2건이 실패함.
- 사람 추정 판정: "반올림 문제 같다" — 맞음. 합계에 한 번 반올림하던 방식이 원인이다(줄별 버림이어야 함).
- 기각한 가설: 없음

## 변경 요약
- `src/invoice/total.js` — 부가세를 과세 줄마다 `floor(net×세율/100)`로 계산해 합산. 영세율은 계속 0.
- `test/total.test.js` — 새 규칙 테스트 3건 추가 (기존 테스트 변경 없음).
- 공유 여부 확인(수정 안 함): `src/invoice/credit-note.js:90`은 total.js와 같은 모양의 별도 인라인 `Math.round` 계산이고 공유 함수가 아니다. `src/invoice/quote.js:40-44`는 `percentOf`(반올림)를 쓴다. 둘 다 같은 반올림 방식이라 회계팀 규칙과 3원류 차이가 날 수 있으나 비목표라 그대로 둠.
- 발행분: `invoiceTotals`(invoice.js:40)가 발행된 청구서는 저장 합계를 쓰므로 재계산되지 않음. `src/format/`은 변경 없음.

## 재현 테스트
- 위치: `test/total.test.js` (INV-2031, 할인 후 줄별 버림·면세 제외, 영세율)
- 수정 전: 실패 — `npm test`: 49 pass / 2 fail (INV-2031, 할인·면세 테스트)
- 수정 후: 통과 — `npm test`: 51 pass / 0 fail

## 테스트 실행
- 명령: `npm test`
- 결과: 51 pass, 0 fail
- 실패 항목: 없음
