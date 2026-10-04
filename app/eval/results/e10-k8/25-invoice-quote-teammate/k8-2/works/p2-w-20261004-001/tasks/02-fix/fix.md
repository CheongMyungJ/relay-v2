## 재현
- 재현 절차: `node -e "import('./src/invoice/quote.js')"` 또는 `npm test`
- 결과: 재현됨
- 기대: Q-0457 견적 합계 56,278원(공급가액 52,691, 부가세 3,587)
- 실제: `SyntaxError: Identifier 'lineVatSum' has already been declared` (total.js:39). 모듈이 로드되지 않아 합계를 계산하지 못하고 `npm test`는 29개 중 7개 실패.

## 원인
- 원인: 두 Work(001, 002)의 머지로 `lineVatSum`이 `src/invoice/total.js`에 두 번 선언됐다(18행, 39행). 본문은 같다. 같은 모듈에 중복 선언이면 모듈 전체가 로드되지 않는다.
- 근거: 오류 출력(total.js:39). 중복 선언을 지운 뒤 `npm test` 60개 전부 통과. 줄별 버림 계산 자체(995·841·886·865=3,587)는 이미 맞았다. 56,280원은 줄별 버림 이전 계산(과세분 35,891원에 한 번 계산 = 3,589원)의 값이다.
- 사람 추정 판정: 없음
- 기각한 가설: `quote.js`의 계산이 틀림 — `quote.js:40`은 이미 `lineVatSum`을 쓰고 있고, 중복 제거 후 56,278원이 나옴.

## 변경 요약
- src/invoice/total.js — 39행 이후의 중복 `lineVatSum` 선언 삭제(18행 선언 유지, 본문 동일)
- test/vat-per-line.test.js — Q-0457 재현 테스트 추가

## 재현 테스트
- 위치: test/vat-per-line.test.js `Q-0457: ...`
- 수정 전: 실패 (`node --test test/vat-per-line.test.js` → pass 0, fail 1, 모듈 로드 실패)
- 수정 후: 통과 (같은 명령 → pass 9, fail 0)

## 테스트 실행
- 명령: `npm test`
- 결과: 60개 통과, 0 실패
- 실패 항목: 수정 전 7개 실패는 기준 커밋(8219087)에서도 같은 원인으로 실패했음. 수정 뒤 실패 없음.
