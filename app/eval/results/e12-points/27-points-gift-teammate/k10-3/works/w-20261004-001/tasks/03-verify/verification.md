## 리뷰 지적
1. [사소] test/order.test.js:4 — `readFileSync` import가 다른 import 뒤(소스 import 아래)에 따로 붙어 있다. node 내장 모듈을 위로 묶으면 읽기 좋다.
2. [사소] src/points/earn.js:5 — `100`을 직접 쓰는 버림 계산이라 공용 `percentOf`(반올림)와 방식이 갈린다. 의도(버림)는 주석에 적혀 있고 percentOf를 바꾸면 쿠폰 등에 영향이 가므로 현 상태가 맞다. 필요하면 버림용 헬퍼를 `money.js`에 두는 것을 고려.

원인(배송비 포함 금액+반올림)과 변경이 맞고, 비목표(`src/format/`, `src/gift/gift-points.js`, 저장된 값 재계산)는 건드리지 않았다. 사용 포인트는 `assertPointUse`로 상품−쿠폰 이내라 기준 금액이 음수가 되지 않는다.

## 반영
없음

## 반영하지 않은 지적
- 1, 2 (사람이 "반영하지 않음" 선택)

## 완료조건 판정
| 완료조건 | 판정 | 근거 |
|---|---|---|
| 재현 절차(O-1042의 적립 예정 포인트 확인)가 더 이상 실패하지 않는다: 237P가 나온다 | 통과 | `createOrder(O-1042)` 직접 실행: points.earned 237 (수정 전 268). O-1077 423, O-1107 243 |
| `npm test`가 통과한다 | 통과 | `npm test`: 22개 통과, 0 실패 |
| 기존 테스트를 약화하거나 삭제하지 않는다 | 통과 | `git diff 1b7edd9`: test/order.test.js는 추가만 있고 기존 줄 삭제·변경 없음 |
| 이미 적립된 포인트는 다시 계산하지 않고 주문에 저장된 값을 그대로 쓴다 | 통과 | `earnPoints`는 `createOrder`에서만 호출. 환불(`refund.js:42`)과 영수증(`receipt.js:16`)은 `order.points.earned`를 읽음 |
| `src/format/`과 `src/gift/gift-points.js`는 변경되지 않는다 | 통과 | `git diff 1b7edd9 --stat -- src/format src/gift` 출력 없음 |
| 적립 계산 수정에 대한 회귀 테스트(O-1042 기준 237P)가 추가된다 | 통과 | test/order.test.js에 O-1042→237P, O-1107→243P 추가. fix.md에서 수정 전 실패 확인(재실행은 하지 않음, 수정 후 통과는 재실행 확인) |

## 테스트 파일 변경
- test/order.test.js — 약화 아님 — 테스트 2개와 import 1줄만 추가했고 기존 테스트는 그대로다

## 남은 위험
- 고객센터 규칙(배송비 제외+버림)은 237P 한 건과 요청 설명으로 추론한 것이다. 다른 규정 문서는 확인하지 못했다
- 선물하기 적립은 배송비 포함+반올림이라 일반 주문과 다르게 나온다(비목표)
- 이미 저장된 `points.earned`는 그대로라 기존 주문은 옛 기준 값이 남는다
