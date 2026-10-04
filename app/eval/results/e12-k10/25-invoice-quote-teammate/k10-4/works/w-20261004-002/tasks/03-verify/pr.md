# fix: 반품 전표 부가세를 과세 줄마다 원 단위 버림으로 계산

## 요약
반품 전표의 환불 부가세·합계가 회계 규정과 몇 원 어긋나던 것을 바로잡는다. CN-0112는 부가세 1,742원, 환불 합계 19,180원이 된다(기존 19,182원).

## 원인
`creditTotals`가 과세 합계 전체에 한 번 `Math.round`로 부가세를 매겨, 줄마다 원 단위 버림으로 더하는 규정과 어긋났다.

## 변경
- `src/money.js`: `floorPercentOf`(원 단위 버림) 추가
- `src/invoice/credit-note.js`: 부가세를 과세 줄마다 `floorPercentOf`로 계산해 합산. 영세율 0, 면세 줄 제외는 기존과 같다
- 저장된 `totals`를 쓰는 `creditNoteTotals`와 `src/format/`은 바꾸지 않았다. 이미 만든 반품 전표는 다시 계산하지 않는다

## 테스트
- `npm test`: 51 통과, 0 실패
- 추가: 줄별 버림, 저장 totals 반환, 면세·영세율 테스트
- CN-0112 재현 스크립트로 vat 1742 / total 19180 확인
