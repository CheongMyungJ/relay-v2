# 부가세를 품목 줄별 원 단위 버림 합으로 계산 (청구서·반품 전표·견적)

## 요약
청구서 합계가 회계팀 계산보다 몇 원씩 크게 나오던 문제를 고친다. 반품 전표와 견적도 같은 규칙으로 맞춘다. INV-2031은 부가세 2,641원, 합계 29,079원(이전 29,082원)이 된다.

## 원인
부가세를 과세 공급가액 전체에 한 번 `Math.round`해서 줄별 버림 합(회계팀 규정)보다 커졌다. 반품 전표도 같은 방식이었고, 견적은 할인 전 금액과 할인액에 각각 반올림해 뺐다.

## 변경
- `src/invoice/total.js`: 줄별 버림 합 도우미 `lineVatSum` 추가, `computeTotals`가 사용
- `src/invoice/credit-note.js`, `src/invoice/quote.js`: 같은 도우미 사용
- `src/format/`과 발행된 청구서·반품 전표의 저장 합계는 바꾸지 않음
- `docs/knowledge/invoice/`에 부가세 규칙과 발행 합계 불변 규칙 기록

## 테스트
- `npm test`: 56 통과, 0 실패 (`test/vat-per-line.test.js` 추가: INV-2031, 할인 줄, 면세·영세율, 반품, 견적, 청구서=견적, 저장 totals)
- 재현 스크립트로 INV-2031 vat 2641 / total 29079 확인
