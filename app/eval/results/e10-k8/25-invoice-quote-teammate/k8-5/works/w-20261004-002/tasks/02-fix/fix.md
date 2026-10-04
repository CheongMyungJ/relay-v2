## 재현
- 재현 절차: `examples/INV-2047.json`을 `createInvoice`→`issueInvoice`로 발행 상태로 만든 뒤 `createCreditNote(invoice, examples/CN-0112.json)`의 `totals` 확인 (스크립트는 임시로만 사용)
- 결과: 재현됨
- 기대: 줄별 부가세 923 + 612 + 207 = 1,742원, 합계 19,180원
- 실제: 부가세 1,744원, 합계 19,182원

## 원인
- 원인: `creditTotals`가 부가세를 과세분 공급가액 합계(17,438)에 한 번 반올림(`Math.round`)해 구했다. 팀 규칙은 줄마다 버림한 값의 합이다.
- 근거: `src/invoice/credit-note.js`의 `creditTotals`. 줄별 공급가액 9,236 / 6,127 / 2,075의 줄별 버림 합은 1,742, 합계 반올림은 1,744. 줄 수가 하나이거나 나머지가 없으면 차이가 없어 어긋나지 않는다. 수정 후 값이 1,742로 바뀌는 것을 테스트로 확인했다.
- 사람 추정 판정: 없음
- 기각한 가설: 없음

## 변경 요약
- src/invoice/credit-note.js — `lineVat`/`sumLineVat` 추가, `creditTotals`가 줄별 버림 합으로 부가세 계산. 면세 줄·영세율은 0. 기준 브랜치의 `total.js`에는 `lineVat`/`sumLineVat`이 없어(앞 Work 머지 대기) 청구서·견적서 코드는 건드리지 않고 이 파일에 둠.
- test/credit-note.test.js — 테스트 2개 추가 (기존 테스트 변경 없음)

## 재현 테스트
- 위치: test/credit-note.test.js "반품 전표 부가세는 줄마다 원 단위 버림으로 구해 합산한다 (CN-0112)"
- 수정 전: 실패 (`npm test`: pass 49, fail 1, 부가세 1744 ≠ 1742)
- 수정 후: 통과 (`npm test`: pass 50, fail 0)
- 저장된 totals 테스트도 추가했다 (이미 통과하던 동작을 고정)

## 테스트 실행
- 명령: npm test
- 결과: 50개 통과, 0개 실패
- 실패 항목: 없음
