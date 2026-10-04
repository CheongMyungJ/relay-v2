## 리뷰 지적
1. [권장] test/gift.test.js — 같은 상품·쿠폰·사용 포인트의 일반 주문과 선물하기 주문의 적립이 같다는 대조 테스트가 없음. 완료조건 4번을 직접 잡는 테스트 추가 제안
2. [사소] src/gift/gift-points.js — `giftPoints`가 `earnPoints`를 그대로 부르는 얇은 래퍼. `src/index.js`에서 공개 export라 유지가 안전해 변경 제안 없음

## 반영
- 1 — 대조 테스트 추가(G-0213과 같은 입력으로 `createGiftOrder`와 `createOrder`의 `points.earned` 비교). 커밋 6c49889. `npm test` → 24개 전부 통과. 재현 절차는 바뀌지 않음. 같은 커밋에서 docs/knowledge/points/earn-basis.md의 gift-points.js 항목을 제거하고 이력을 더함

## 반영하지 않은 지적
- 2 (사람이 "차단·권장만 반영"을 골라 제외)

## 완료조건 판정
| 완료조건 | 판정 | 근거 |
|---|---|---|
| 재현 절차가 더 이상 실패하지 않는다 (G-0213 적립 예정 포인트가 218P) | 통과 | `examples/G-0213.json`을 `createGiftOrder`에 넣는 스크립트 직접 실행 → 218 (수정 전 249는 fix.md 기록). 재현 테스트도 통과 |
| `npm test`가 통과한다 | 통과 | `npm test` → tests 24, pass 24, fail 0 |
| 기존 테스트를 약화하거나 삭제하지 않는다 | 통과 | `git diff 498a40c`상 test/gift.test.js는 추가만 있고 기존 줄 변경·삭제 없음 |
| 같은 상품·쿠폰·사용 포인트의 일반 주문과 선물하기 주문의 적립 포인트가 같다 | 통과 | 스크립트로 G-0213 입력의 선물 218, 일반 218. 대조 테스트 통과 |
| 이미 적립된 선물하기 주문은 저장된 `points.earned`를 쓰고 다시 계산하지 않는다 | 통과 | `giftPoints` 호출처는 `createGiftOrder`(새 주문 생성)뿐이고, 영수증(`receipt.js:16`)·환불(`refund.js:42`)은 저장된 `order.points.earned`를 읽음. 이 변경은 그 경로를 바꾸지 않음 |
| 선물 메시지 카드, 받는 사람 정보, `src/format/`의 출력이 바뀌지 않는다 | 통과 | `git diff 498a40c --stat`: src/gift/gift-points.js, 테스트, 지식 문서만 변경. `src/format/`과 `gift-order.js`는 그대로 |

## 테스트 파일 변경
- test/gift.test.js — 약화 아님 — 재현 테스트와 대조 테스트 2개를 추가했을 뿐 기존 테스트는 그대로. 대조 테스트는 옛 코드(249 vs 218)에서 실패하므로 수정을 실제로 잡음

## 남은 위험
- `src/orders/refund.js:34` 부분 환불 회수는 여전히 반올림·차감 전 금액 기준이라 적립 기준과 다름(이번 범위 아님, 팀 지식에 기록됨)
- 쿠폰·포인트가 없고 금액이 딱 떨어지는 주문은 옛 방식과 값이 같아 회귀 여부가 테스트에서는 드러나지 않음
