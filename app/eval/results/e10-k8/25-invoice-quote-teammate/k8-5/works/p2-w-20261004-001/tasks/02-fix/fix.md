## 재현
- 재현 절차: `git checkout ee0adc0~1` 뒤 `createQuote(examples/Q-0457.json).totals` 확인(예제는 createQuote가 정규화). 현재 브랜치(기준 커밋)에서도 같은 호출과 `npm test`를 실행.
- 결과: 재현 안 됨 (기준 커밋에서 Q-0457은 이미 규정값). 요청의 56,280원은 줄별 버림 적용 커밋(ee0adc0) 이전 코드의 값이다. 사람에게 되묻지 않고 관찰 사실로 진행(초안 우선).
- 기대: 공급가액 52,691, 부가세 3,587(995+841+886+865), 합계 56,278
- 실제: ee0adc0 이전은 부가세 3,589, 합계 56,280. 기준 커밋은 56,278로 규정과 일치. 다만 `npm test`는 2건 실패(credit-note.test.js, export.test.js, 모듈 로드 SyntaxError)

## 원인
- 원인: Q-0457의 56,280원은 합계에서 부가세를 한꺼번에 계산하던 옛 방식의 값이고, ee0adc0이 이미 줄별 버림으로 고쳤다. 별개로 두 브랜치 머지 때 `credit-note.js`에 `sumLineVat`/`lineVat`이 import와 로컬 정의로 중복돼 `SyntaxError: Identifier 'sumLineVat' has already been declared`가 났다.
- 근거: `git checkout ee0adc0~1` 시 합계 56,280, 현재 56,278. `node --test test/credit-note.test.js` 출력의 SyntaxError(credit-note.js:90). 25e141e가 같은 함수를 credit-note.js에 따로 추가했다.
- 사람 추정 판정: 없음
- 기각한 가설: `lineGross`/`lineDiscount`/`isTaxableLine` 쪽 오류 — 손계산(9955→995, 8412→841, 8868→886, 8656→865, 면세 0)이 코드 출력과 일치.

## 변경 요약
- src/invoice/credit-note.js — 중복된 로컬 `lineVat`/`sumLineVat` 제거, `total.js`의 공유 함수 사용(규정의 "lineVat/sumLineVat 공유"). 반품 계산 결과는 같다(면세 줄 제외, 영세율 0 유지). 로컬 `VAT_RATE_PERCENT`는 import 없이 쓰이던 것이라 함께 사라진다.
- test/quote.test.js — Q-0457 합계 테스트 추가.

## 재현 테스트
- 위치: test/quote.test.js '견적서 Q-0457 합계는 줄별 버림 규정 계산값과 같다'
- 수정 전: 이 테스트 자체는 기준 커밋에서도 통과(견적 로직은 이미 정상). 수정 전 `npm test`는 credit-note/export 2파일 실패.
- 수정 후: 통과 (`npm test` 54개 통과)
- 견적 쪽은 이미 고쳐져 있어 "수정 전 실패"하는 테스트는 추가할 수 없다. 실패하던 것은 SyntaxError였고 기존 테스트가 이를 잡는다.

## 테스트 실행
- 명령: `npm test`
- 결과: 54개 중 54개 통과, 실패 0
- 실패 항목: 수정 전 2건은 기준 커밋에서도 실패(중복 선언), 이번 수정 뒤 실패 없음
