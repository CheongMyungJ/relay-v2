## 재현
- 재현 절차: `createCreditNote(INV-2047, CN-0112)`를 `examples/` 파일로 호출해 `totals` 출력 (스크래치 스크립트)
- 결과: 재현됨
- 기대: 줄별 부가세 923 + 612 + 207 = 1,742, 합계 19,180원
- 실제: 부가세 1,744, 합계 19,182원

## 원인
- 원인: `creditTotals`가 과세분 합계(17,438)에 한 번만 `Math.round(×10%)`를 적용해 줄 단위 버림 규정과 달라졌다.
- 근거: `src/invoice/credit-note.js:90`(수정 전). 줄별 계산 시 9,236→923, 6,127→612(612.7 버림), 2,075→207, 합 1,742. 합계 반올림은 1,743.8→1,744. 수정 전 테스트 실패, 수정 후 통과로 확인.
- 사람 추정 판정: 없음
- 기각한 가설: 없음

## 변경 요약
- `src/invoice/total.js` — 줄 부가세 `lineVat(net)`(원 단위 버림) 추가, export
- `src/invoice/credit-note.js` — `creditTotals`의 vat를 과세 줄별 `lineVat` 합으로 변경. 영세율은 0 유지, 저장된 `totals` 우선(`creditNoteTotals`) 그대로
- `test/credit-note.test.js` — 테스트 2개 추가(기존 테스트 변경 없음)

## 재현 테스트
- 위치: `test/credit-note.test.js` "반품 부가세는 과세 줄마다 …(CN-0112)"
- 수정 전: 실패 (`npm test` → 49 pass, 1 fail)
- 수정 후: 통과 (`npm test` → 50 pass, 0 fail)
- 저장 금액 보존 테스트도 추가: INV-2047 저장 부가세 5,801, 저장된 반품 `totals` 그대로

## 테스트 실행
- 명령: `npm test`
- 결과: 50개 통과, 0개 실패
- 실패 항목: 없음
