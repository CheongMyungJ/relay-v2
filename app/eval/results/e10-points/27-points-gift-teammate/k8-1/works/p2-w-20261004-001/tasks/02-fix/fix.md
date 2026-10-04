## 재현
- 재현 절차: `node src/cli.js examples/G-0213.json` (마지막 줄 적립 예정 확인)
- 결과: 재현됨
- 기대: 218P
- 실제: 249P

## 원인
- 원인: `giftPoints`가 `percentOf(order.amounts.total, 비율)`로 배송비가 포함된 total을 반올림해 계산했고, 일반 주문의 `earnPoints`(배송비 제외, 버림)와 기준이 달랐다.
- 근거: `src/gift/gift-points.js`(수정 전). G-0213은 total 24,860(배송비 3,000 포함) → 248.6 반올림 249. 같은 주문에 `earnPoints`를 직접 호출하면 218이 나옴(실험 확인). 배송비가 0인 기존 테스트(30,000원 → 300P)는 두 기준이 같아 통과했다.
- 사람 추정 판정: 요청이 `src/gift/gift-points.js`를 지목 — 맞음. 원인이 그 파일에 있다.
- 기각한 가설: 없음

## 변경 요약
- src/gift/gift-points.js — `giftPoints`가 `earnPoints`에 위임하게 해 일반 주문과 같은 기준을 쓴다 (공유 파일이나 사람이 수정 허용). `giftPoints` export는 유지.
- test/gift.test.js — G-0213 테스트 추가 (기존 테스트는 변경 없음).

## 재현 테스트
- 위치: test/gift.test.js 「선물하기 적립은 일반 주문과 같은 기준…」
- 수정 전: 실패 (`npm test` → expected 218, actual 249, fail 1)
- 수정 후: 통과 (`npm test` → pass 23, fail 0)

## 테스트 실행
- 명령: `npm test`
- 결과: 23개 통과, 0 실패. `node src/cli.js examples/G-0213.json`도 218P.
- 실패 항목: 없음
