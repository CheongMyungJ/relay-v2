## 재현
- 재현 절차: `examples/INV-2047.json`에 `examples/CN-0112.json`의 반품을 `createCreditNote`로 적용해 `totals`를 출력 (워크트리 루트에서 `node /tmp/r.mjs`와 같은 스크립트)
- 결과: 재현됨
- 기대: 부가세 1,742원(923+612+207), 환불 합계 19,180원
- 실제: 부가세 1,744원, 환불 합계 19,182원

## 원인
- 원인: `creditTotals`가 과세 줄 net 합(17,438)에 세율을 곱해 `Math.round`를 한 번만 적용했다. 팀 규칙은 줄마다 버림한 값의 합이다.
- 근거: `src/invoice/credit-note.js`의 `creditTotals`. 줄별 net 9,236 / 6,127 / 2,075 → 줄별 버림 923+612+207=1,742, 합산 후 반올림은 1,743.8→1,744. 수정 후 실행하면 1,742 / 19,180이 나온다. 줄별 버림과 합산 반올림이 달라지는 경우에만 어긋난다(줄이 하나이거나 소수점 이하가 없으면 같음).
- 사람 추정 판정: 없음 (`추가 의견`은 관련 코드 위치 안내뿐이며, `creditTotals`가 맞았음)
- 기각한 가설: `returnedDiscount`의 반올림(형광펜 5%: 322.5→323)이 원인 — intake에서 범위 밖으로 정했고, 할인은 net 계산 입력이라 규칙(부가세 계산 방식)과 별개. 바꾸지 않음

## 변경 요약
- src/invoice/credit-note.js — `creditTotals`의 부가세를 과세 줄마다 `Math.floor(net × 세율 / 100)`로 계산해 합산. 영세율이면 0, 합계는 공급가액 + 부가세 그대로
- test/credit-note.test.js — 재현 테스트 추가 (기존 테스트 변경 없음)

## 재현 테스트
- 위치: test/credit-note.test.js '반품 전표 부가세는 과세 줄마다 할인 후 금액에 버림한 값의 합이다'
- 수정 전: 실패 (`npm test`: 47개 중 1 fail, vat 1744 ≠ 1742)
- 수정 후: 통과 (`npm test`: pass 47, fail 0)

## 테스트 실행
- 명령: `npm test`
- 결과: pass 47, fail 0
- 실패 항목: 없음
