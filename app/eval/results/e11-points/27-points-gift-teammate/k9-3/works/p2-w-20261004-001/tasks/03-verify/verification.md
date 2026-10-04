## 리뷰 지적
1. [사소] test/gift.test.js:3-4 — node 내장 모듈 import가 src import 사이에 끼어 순서가 어색함(동작 영향 없음)

수정은 원인(배송비 포함·반올림 자체 계산)을 `earnPoints` 호출로 없애므로 증상 은폐가 아니다. 저장된 `points.earned` 재계산 코드는 바뀌지 않았다.

## 반영
없음 (사람이 반영하지 않음을 골랐다)

## 반영하지 않은 지적
- 1

## 완료조건 판정
| 완료조건 | 판정 | 근거 |
|---|---|---|
| 재현 절차(G-0213의 적립 예정 포인트 계산)가 더 이상 실패하지 않고 218P가 나온다 | 통과 | `createGiftOrder(G-0213.json).points` 직접 실행 → `{ used: 1000, earned: 218 }` |
| `npm test`가 통과한다 | 통과 | `npm test` → 24개 통과, 0개 실패 |
| 기존 테스트를 약화하거나 삭제하지 않는다 | 통과 | 기준 커밋 대비 test/gift.test.js에 추가만 있고 삭제·수정 없음 |
| G-0213 적립 예정 포인트가 218P임을 확인하는 테스트가 있다 | 통과 | test/gift.test.js의 'G-0213 적립 예정 포인트…218P' 테스트가 통과 |
| 선물 메시지 카드, 받는 사람 정보, `src/format/`의 출력은 수정 전과 같다 | 통과 | `git diff 0825f7d` 변경 파일은 gift-points.js, gift.test.js(와 지식 문서)뿐. gift-order.js·src/format/ 변경 없음 |
| 주문에 이미 저장된 `points.earned` 값을 다시 계산하는 코드는 바뀌지 않는다 | 통과 | src/orders/ 등 변경 없음(`git diff --stat`에 없음), cancelOrder 그대로 |

## 테스트 파일 변경
- test/gift.test.js — 약화 아님 — 기존 테스트 3개는 그대로이고 218P 테스트와 일반 주문 동일 값 테스트 2개만 추가

## 남은 위험
- src/orders/refund.js:34 부분 환불 회수 포인트는 여전히 `percentOf`(반올림)라 적립(버림)과 어긋날 수 있다. 사람이 이번 범위에서 뺐다.
- 218P 기준은 고객센터 한 건(G-0213)에서 역산한 것이다.
