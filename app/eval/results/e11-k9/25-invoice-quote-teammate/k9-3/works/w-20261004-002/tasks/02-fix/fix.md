## 재현
- 재현 절차: `node /tmp/r.mjs` 상당. `createCreditNote(INV-2047, CN-0112)`를 만들어 `totals`를 출력한다(`node src/cli.js examples/CN-0112.json --invoice examples/INV-2047.json`과 같은 경로).
- 결과: 재현됨
- 기대: vat 923+612+207 = 1,742, 합계 19,180
- 실제: vat 1,744, 합계 19,182 (공급가액 17,438)

## 원인
- 원인: `creditTotals`가 부가세를 과세분 합계(17,438)에 `Math.round`로 한 번 계산했다. 회계팀 규칙은 줄별 버림 후 합산이다.
- 근거: `src/invoice/credit-note.js`의 `creditTotals`. 줄별 공급가액 9,236/6,127/2,075 → 923.6/612.7/207.5를 버리면 1,742, 합계 반올림은 1,743.8→1,744. 수정 후 같은 입력이 1,742/19,180이 되고 되돌리면 재현 테스트가 실패한다(실험함). 줄 단위 소수부가 합쳐져 어긋나므로 소수부가 없는 금액(기존 테스트 값)에서는 재현되지 않는다.
- 사람 추정 판정: 없음
- 기각한 가설: 할인 안분(`returnedDiscount`) 오류 — 비목표이고 줄별 공급가액이 손계산과 같아 원인이 아님.

## 변경 요약
- src/invoice/vat.js (신규) — `lineVat`/`sumLineVat`. 팀 규칙이 정한 공용 위치인데 이 브랜치에 없어(앞 Work 머지 대기) 같은 이름·위치로 새로 만들었다.
- src/invoice/credit-note.js — `creditTotals`의 부가세를 `sumLineVat`으로 교체.
- test/credit-note.test.js — 테스트 추가(기존 테스트는 변경 없음).

## 재현 테스트
- 위치: test/credit-note.test.js "반품 전표의 부가세는 줄별 버림의 합이다 (CN-0112)" 외 3개(면세 혼합, 영세율, 저장된 totals 유지)
- 수정 전: 실패 (`npm test` → CN-0112 테스트 not ok, 1744 ≠ 1742)
- 수정 후: 통과 (`npm test` → pass 52, fail 0)
- 면세 혼합·영세율·저장 totals 테스트는 수정 전에도 통과한다(현재 동작을 고정하는 회귀 테스트).

## 테스트 실행
- 명령: `npm test`
- 결과: 52개 통과, 0 실패
- 실패 항목: 없음
