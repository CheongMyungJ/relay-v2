## 재현
- 재현 절차: `node -e "import('./src/invoice/credit-note.js').then(async m=>{const fs=await import('fs');const inv=JSON.parse(fs.readFileSync('examples/INV-2047.json'));const d=JSON.parse(fs.readFileSync('examples/CN-0112.json'));console.log(m.createCreditNote(inv,d).totals)})"`
- 결과: 재현됨
- 기대: vat 1,742 (팀 지식 vat-per-line-floor.md의 CN-0112 값), 합계 19,180원
- 실제: vat 1,744, 합계 19,182원

## 원인
- 원인: `creditTotals`가 과세분 합계(17,438)에 10%를 곱해 한 번에 반올림했다(줄별 버림 합이 아님).
- 근거: `src/invoice/credit-note.js` creditTotals의 `Math.round((taxable * VAT_RATE_PERCENT) / 100)`. 줄별 공급가액 9,236 / 6,127 / 2,075 → 버림 923 + 612 + 207 = 1,742. 수정 후 CN-0112가 1,742로 나옴(실험 확인).
- 사람 추정 판정: 없음
- 기각한 가설: returnedDiscount(금액 할인 수량 비율 반올림)가 원인 — 이 사례 줄(박스테이프)은 전량 반품이라 할인이 청구서와 같고, 형광펜 비율 할인 323은 수정 후 vat 1,742가 지식 값과 일치해 원인이 아님. 그대로 둠.

## 변경 요약
- src/invoice/credit-note.js — 과세 줄마다 `vatOfNet`(정수 연산 버림)으로 부가세를 구해 합산. 영세율은 0 유지. `creditNoteTotals`의 저장값 우선 동작은 그대로.
- test/credit-note.test.js — CN-0112 부가세 규칙 테스트 추가(기존 테스트 변경 없음).

## 재현 테스트
- 위치: test/credit-note.test.js '반품 전표 부가세는 과세 줄마다 원 단위 버림의 합이다 (CN-0112)'
- 수정 전: 실패 (`npm test` → vat actual 1744, expected 1742, fail 1)
- 수정 후: 통과 (`npm test` → pass 49, fail 0)

## 테스트 실행
- 명령: `npm test`
- 결과: 49 통과, 0 실패
- 실패 항목: 없음
