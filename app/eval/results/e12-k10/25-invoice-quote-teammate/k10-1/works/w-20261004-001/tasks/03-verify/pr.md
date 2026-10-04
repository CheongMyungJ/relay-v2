# fix: 부가세를 줄마다 원 단위 버림으로 계산해 합산

## 요약
청구서·견적·대변전표의 부가세를 회계팀 규정(할인 후 줄 금액마다 원 단위 버림 후 합산)으로 맞췄다. INV-2031은 부가세 2,644원 → 2,641원, 합계 29,082원 → 29,079원이 된다.

## 원인
부가세를 과세 공급가액 합계에 한 번 `Math.round`로 계산했고(청구서·대변전표), 견적은 할인 전 총액과 할인 총액에 각각 반올림을 적용해 뺐다. 규정과 다르다.

## 변경
- `src/money.js`: 공용 `vatOfLines(nets, percent)` 추가
- `src/invoice/total.js`, `credit-note.js`, `quote.js`: `vatOfLines` 사용. 영세율은 0, 면세 줄 제외 유지
- 발행된 청구서는 저장 합계를 그대로 쓰며 `src/format/`은 바뀌지 않음
- `docs/knowledge/billing/`에 부가세 규정과 저장 합계 규칙 기록

## 테스트
- `npm test`: 52 pass, 0 fail (재현 테스트 4개 추가, 기존 테스트 변경 없음)
- `node /tmp/r.mjs examples/INV-2031.json` → vat 2641, total 29079
- 알려진 위험: 일부 수량 반품 전표의 줄 부가세가 원 청구서 비례분과 1원 다를 수 있음
