## 재현
- 재현 절차: `node -e "import('./src/invoice/quote.js')"` 또는 `npm test` (기준 커밋 bc0ffd4)
- 결과: 재현됨 (증상이 다름: 56,280원이 아니라 모듈 로드 자체가 실패)
- 기대: Q-0457 합계 56,278원
- 실제: `SyntaxError: Identifier 'vatOfLines' has already been declared` (src/money.js:55). `npm test` 21개 파일 중 8개 실패.

## 원인
- 원인: 부가세 수정 두 갈래(1702f40은 `vatOfLines(nets, percent)`, 6dd69b3은 `vatOfLines(rows, percent, zeroRated)`)가 머지되며 `src/money.js`에 같은 이름의 함수가 두 번 선언되어 money.js를 가져오는 모든 모듈이 로드되지 않는다.
- 근거: `grep -n vatOfLines src/money.js`로 38줄과 55줄 두 선언 확인. 수동 계산으로 Q-0457은 줄별 버림이면 995+841+886+865=3,587 → 합계 56,278원(경리 값과 일치). 56,280원은 옛 견적 방식(과세 할인 전 금액 부가세 3,815 − 할인분 부가세 226 = 3,589)의 값이며, 이는 1702f40 이전 quote.js의 계산이다. 줄별 버림을 쓰는 코드가 로드되면 경리 값이 나온다. 견적서 규정 자체가 확정된 것은 아니며(사람도 모름), 경리 값과 줄별 버림이 일치한다는 사실만 확인했다.
- 사람 추정 판정: 없음 (참고용 추정 "할인/줄 금액 쪽도 볼 만하다"는 틀림 — 할인·줄 금액 계산은 정상)
- 기각한 가설: 할인(`lineDiscount`)·줄 금액(`lineGross`) 오류 — 위 수동 계산에서 이 값들로 56,278원이 나옴

## 변경 요약
- src/money.js — `nets` 버전 `vatOfLines` 삭제, 대변전표·단위 테스트가 쓰는 `rows` 버전만 유지
- src/invoice/quote.js — `vatOfLines(rows, VAT_RATE_PERCENT, quote.zeroRated)`로 호출
- src/invoice/total.js — 같은 방식으로 호출 (계산 결과 동일)
- test/quote.test.js — Q-0457 합계 테스트 추가

## 재현 테스트
- 위치: test/quote.test.js 'Q-0457 견적 합계는 경리 계산 56,278원'
- 수정 전: 실패 (기준 커밋에서 money.js SyntaxError로 파일 로드 실패. 추가한 테스트를 기준 커밋에 따로 돌리지는 않았고, 로드 실패는 `npm test`로 확인)
- 수정 후: 통과 (`npm test`: 55개 통과)

## 테스트 실행
- 명령: `npm test`
- 결과: tests 55, pass 55, fail 0
- 실패 항목: 없음 (기준 커밋에서는 8개 파일 실패였고 모두 SyntaxError 때문)
