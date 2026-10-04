# fix: 반품 전표의 중복 부가세 함수 제거, 견적서 Q-0457 합계 테스트 추가

## 요약
견적서 Q-0457 합계 문의를 조사했다. 현재 코드는 이미 규정값 56,278원이며, 문의된 56,280원은 줄별 버림 적용(ee0adc0) 이전 값이다. 다만 머지로 credit-note.js에 생긴 중복 선언을 정리했다.

## 원인
- 56,280원은 합계에서 부가세를 한꺼번에 계산하던 옛 방식의 값이다.
- 별개로 두 브랜치 머지 때 `credit-note.js`에 `lineVat`/`sumLineVat`이 import와 로컬 정의로 중복되어 `SyntaxError`로 npm test 2개 파일이 실패했다.

## 변경
- `src/invoice/credit-note.js`: 로컬 `lineVat`/`sumLineVat` 제거, `total.js` 공유 함수 사용 (반품 계산 결과 동일)
- `test/quote.test.js`: Q-0457 합계(공급가액 52,691, 부가세 3,587, 합계 56,278) 테스트 추가
- `docs/knowledge/merge-duplicate-declaration.md`: 머지 중복 선언 함정 기록

## 테스트
- `npm test`: 54개 통과, 실패 0
- 견적 번호 형식과 유효 기간 코드(quote.js)는 변경 없음
- 참고: 거래처에 56,280원 견적서를 이미 보냈다면 새로 발행해야 한다(저장된 totals는 재계산하지 않음)
