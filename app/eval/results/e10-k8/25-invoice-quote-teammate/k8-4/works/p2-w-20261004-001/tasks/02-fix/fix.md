## 재현
- 재현 절차: `node /tmp/r.mjs examples/Q-0457.json` (createQuote로 examples/Q-0457.json을 읽어 totals 출력)
- 결과: 재현됨
- 기대: vat 3,587 / total 56,278
- 실제: vat 3,589 / total 56,280

## 원인
- 원인: `quoteTotals`가 부가세를 줄별로 계산하지 않고 "할인 전 과세 합계의 10%(percentOf 반올림) − 할인 합계의 10%(반올림)"로 계산해, 합계 단위 반올림 2번의 오차가 생긴다.
- 근거: src/invoice/quote.js의 기존 vat 식. 줄별 버림 손계산 995+841+886+865=3,587과 코드 출력 3,589의 차이. 수정 후 3,587로 일치함(실험으로 확인).
- 사람 추정 판정: 없음
- 기각한 가설: 없음

## 변경 요약
- src/invoice/quote.js — 부가세를 과세 줄마다 Math.floor(할인 후 공급가액 × 세율/100)의 합으로 변경(청구서 computeTotals와 동일). 영세율은 0 유지. 미사용 percentOf import 제거. 견적 번호·유효 기간 코드는 건드리지 않음.
- test/quote.test.js — Q-0457 합계 테스트와 영세율 테스트 추가(기존 테스트 변경 없음).
- README.md — 견적서도 줄별 버림 규칙을 따른다고 문구 수정(반품 전표도 이미 따르므로 낡은 문구 정정).

## 재현 테스트
- 위치: test/quote.test.js '견적 부가세는 과세 줄마다 …(Q-0457)'
- 수정 전: 실패 (`node --test test/quote.test.js` — vat 실제 3589, 기대 3587)
- 수정 후: 통과 (같은 명령, 4건 모두 통과)

## 테스트 실행
- 명령: npm test
- 결과: 57건 통과, 0건 실패
- 실패 항목: 없음
