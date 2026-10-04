# fix: 머지로 중복된 vatOfLines를 합쳐 Q-0457 견적 합계를 56,278원으로 맞춤

## 요약
견적서 Q-0457 합계가 경리 계산(56,278원)과 맞지 않는다는 문의를 처리했다. 머지로 `vatOfLines`가 두 번 선언되어 모듈이 로드되지 않던 문제를 고쳤다.

## 원인
두 브랜치가 `vatOfLines`를 서로 다른 시그니처(`nets, percent` / `rows, percent, zeroRated`)로 추가해 머지 후 `src/money.js`에 중복 선언 SyntaxError가 났다. 이전 견적 방식은 56,280원이었다.

## 변경
- `src/money.js`: `nets` 버전 삭제, `rows` 버전만 유지
- `src/invoice/quote.js`, `src/invoice/total.js`: `vatOfLines(rows, VAT_RATE_PERCENT, zeroRated)`로 호출 (청구서 결과 동일)
- `test/quote.test.js`: Q-0457 합계 테스트 추가
- `docs/knowledge/billing/`: 견적 부가세 규정 미정 기록, 머지 중복 선언 함정 기록

## 테스트
- `npm test`: 55개 모두 통과
- Q-0457: 공급가액 52,691, 부가세 3,587, 합계 56,278. INV-2031 합계 29,079 유지
- 견적서 부가세 규정은 미확정이라 담당 동료 확인이 필요하다.
