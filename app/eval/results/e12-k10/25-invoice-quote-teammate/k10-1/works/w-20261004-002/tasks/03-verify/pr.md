# fix: 반품 전표 부가세를 줄별 원 단위 버림 합산으로 계산

## 요약
반품 전표의 부가세가 회계팀 규정과 몇 원씩 달랐다. 줄마다 버림해 합산하도록 바로잡았다. CN-0112(INV-2047)의 환불 합계는 19,182원에서 19,180원이 된다.

## 원인
`creditTotals`가 과세 합계(17,438)에 세율을 한 번 곱해 `Math.round`(1,743.8→1,744)했다. 회계 규정은 줄마다 버림해 합산한다(923+612+207=1,742).

## 변경
- `src/money.js`: 공용 `vatOfLines(rows, percent, zeroRated)` 추가(영세율 0, 면세 줄 제외)
- `src/invoice/credit-note.js`: `creditTotals`가 `vatOfLines`를 사용. 저장된 `totals`를 쓰는 `creditNoteTotals`는 그대로
- 청구서·견적 계산과 `src/format/`은 변경 없음

## 테스트
- `npm test`: 51 통과, 0 실패
- 추가: CN-0112/INV-2047 재현 테스트, 영세율·면세 테스트, `vatOfLines` 단위 테스트
- 머지 시 앞 Work(w-20261004-001)의 `vatOfLines`와 `src/money.js`에서 충돌할 수 있다
