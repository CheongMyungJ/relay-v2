## 리뷰 지적
1. [사소] test/gift.test.js:3-5 — 새 import(`node:fs`, `createOrder`)가 기존 import 뒤에 섞여 있다. 외부 모듈을 먼저 두면 읽기 좋다.
2. [사소] src/index.js:5 — `giftPoints`는 이제 호출처가 없지만 export된다. 외부에서 쓰면 옛 기준 값이 나온다. gift-points.js와 index.js 정리는 수정 금지 규칙과 다른 팀 협의 대상이라 이번 범위 밖이다.

변경은 intent의 목표와 비목표에 맞고, 원인(`createGiftOrder`가 `giftPoints`를 호출)을 호출 쪽에서 고쳤다. 증상만 가린 것이 아니다. 재현 테스트는 수정 전 249P로 실패하고 수정 후 218P로 통과한다.

## 반영
없음

## 반영하지 않은 지적
- 1, 2 (사람이 "반영하지 않음"을 골랐다)

## 완료조건 판정
| 완료조건 | 판정 | 근거 |
|---|---|---|
| 재현 절차(G-0213의 적립 예정 포인트 확인)가 더 이상 실패하지 않는다 | 통과 | `createGiftOrder(G-0213)`와 같은 입력의 `createOrder`를 직접 실행: 둘 다 `points.earned` 218 (이전 249) |
| `npm test`가 통과한다 | 통과 | `npm test`: 24개 통과, 0개 실패 |
| 기존 테스트를 약화하거나 삭제하지 않는다 | 통과 | `git diff <기준 커밋>`에서 test/gift.test.js는 추가만 있고 삭제나 수정된 기존 단언이 없다 |
| G-0213의 적립 예정 포인트가 `earnPoints` 규칙(배송비 제외, 1P 미만 버림)으로 계산한 값과 같다 | 통과 | (24,860 − 3,000) × 1% = 218.6 → 버림 218. 실행 결과 218 |
| `src/gift/gift-points.js`, `src/money.js`, `src/format/`에 변경이 없다 | 통과 | `git diff <기준 커밋> --stat -- src/gift/gift-points.js src/money.js src/format` 출력 없음 |
| 이미 저장된 `points.earned` 값을 다시 계산하는 코드가 추가되지 않는다 | 통과 | 변경은 `createGiftOrder`의 생성 시 계산 호출 교체뿐이다. 다른 곳의 `earnPoints` 호출은 추가되지 않았다 |

## 테스트 파일 변경
- test/gift.test.js — 약화 아님 — G-0213 재현 테스트와 import만 추가했고 기존 테스트는 그대로다

## 남은 위험
- 기대값 218P는 고객센터 값으로 확인하지 못했다. 일반 주문과 같은 규칙에서 나온 값이다.
- `giftPoints`가 `src/index.js`에서 여전히 export되고 호출처가 없다.
- 환불 회수 포인트(`src/orders/refund.js`)는 저장된 `points.earned`를 쓰므로 선물 주문도 새 값을 따른다. 환불의 `percentOf` 계산은 범위 밖이다.
