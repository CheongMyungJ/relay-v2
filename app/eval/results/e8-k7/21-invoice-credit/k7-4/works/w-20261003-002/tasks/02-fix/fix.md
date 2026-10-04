## 재현
- 재현 절차: `examples/INV-2047.json`과 `examples/CN-0112.json`을 읽어 `createCreditNote(inv, cn)`을 호출하고 `totals`를 출력한다.
- 결과: 재현됨
- 기대: 부가세는 줄별 버림 합 923+612+207 = 1,742원, 합계 19,180원
- 실제: 부가세 1,744원, 합계 19,182원

## 원인
- 원인: `creditTotals`가 부가세를 과세 공급가액 합계(17,438)에 한 번 곱해 반올림(`Math.round`)했다. 줄별 원 단위 버림 규칙과 다르다.
- 근거: `src/invoice/credit-note.js`의 `creditTotals`(수정 전). 수정 전 출력 vat 1744, 수정 후 vat 1742로 바뀜(실험 확인). 줄이 하나뿐이거나 줄별 소수 부분이 없으면 어긋나지 않아 일부 경우에만 재현된다.
- 사람 추정 판정: 없음
- 기각한 가설: 없음. 참고로 할인 반올림(`percentOf`, 형광펜 322.5)은 줄 부가세(612)에 영향이 없어 바꾸지 않았다.

## 변경 요약
- src/invoice/credit-note.js — `lineVat`(할인된 줄 금액의 10% `Math.floor`)을 추가하고 `creditTotals`의 부가세를 과세 줄별 합으로 바꿨다. `zeroRated`는 0 유지, 면세 줄은 제외.
- test/credit-note.test.js — 테스트 3개 추가(기존 테스트 변경 없음).
- `src/invoice/total.js`는 비목표라 건드리지 않았다.

## 재현 테스트
- 위치: test/credit-note.test.js (CN-0112, 1,343+1,342 두 줄, 면세·영세율)
- 수정 전: 실패 (`npm test` — 6번 CN-0112, 7번 1,343+1,342 두 테스트 실패)
- 수정 후: 통과 (`npm test` — 49개 모두 통과)
- 면세·영세율 테스트는 수정 전에도 통과한다(회귀 방지용).

## 테스트 실행
- 명령: `npm test`
- 결과: 49개 통과, 0개 실패
- 실패 항목: 없음
