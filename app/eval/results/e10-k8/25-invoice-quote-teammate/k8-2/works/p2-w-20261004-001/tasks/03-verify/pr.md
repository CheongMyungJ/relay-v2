# fix: total.js 중복 선언된 lineVatSum 제거로 견적 Q-0457 합계 56,278원 복구

## 요약
견적 Q-0457(거래처 C-0388)의 합계가 경리 담당 계산(56,278원)과 맞도록 모듈 로드 오류를 바로잡는다. 중복 선언을 지우면 줄별 버림 부가세 3,587원, 합계 56,278원이 나온다.

## 원인
두 Work 머지로 `src/invoice/total.js`에 `lineVatSum`이 두 번 선언돼 모듈이 로드되지 않았다(`SyntaxError: Identifier 'lineVatSum' has already been declared`). 56,280원은 줄별 버림 이전 계산(과세분 35,891원에 한 번 계산)의 값이다.

## 변경
- `src/invoice/total.js`: 중복된 `lineVatSum` 선언 삭제(본문 동일)
- `test/vat-per-line.test.js`: Q-0457 재현 테스트 추가
- `docs/knowledge/invoice/`: Q-0457 예 추가, 머지 중복 선언 함정 기록
- 견적 번호 형식, 유효 기간 계산, `src/format/`, 저장된 `totals`는 바꾸지 않았다.

## 테스트
- `npm test`: 60개 통과, 0 실패 (수정 전에는 29개 중 7개 실패)
- Q-0457: 공급가액 52,691원, 부가세 3,587원, 합계 56,278원
