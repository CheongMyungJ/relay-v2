## 리뷰 지적
없음

## 반영
없음

## 반영하지 않은 지적
없음

## 완료조건 판정
| 완료조건 | 판정 | 근거 |
|---|---|---|
| 재현 절차(G-0213의 적립 예정 포인트가 249P로 나옴)가 더 이상 실패하지 않는다 | 통과 | fix.md의 재현 명령을 다시 실행: `points: { used: 1000, earned: 218 }` (수정 전 249) |
| `npm test`가 통과한다 | 통과 | `npm test` → 24개 통과, 0개 실패 |
| 기존 테스트를 약화하거나 삭제하지 않는다 | 통과 | `git diff cf64e24 -- test/`: test/gift.test.js에 테스트 2개 추가만 있고 기존 줄 변경·삭제 없음 |
| G-0213의 선물하기 적립 예정 포인트가 218P이다 | 통과 | 재현 명령 결과 earned 218, shipping 3000 |
| 선물하기 적립 계산이 배송비를 뺀 결제 금액 기준 원 단위 버림으로 테스트되어 있다(배송비 0원, 버림 경계 포함) | 통과 | test/gift.test.js: G-0213(218P)과 배송비 0원 35,050원 → 350P(350.5 버림) 테스트. 수정 전 실패는 fix.md 기록 |
| 선물 메시지 카드, 받는 사람 정보, `src/format/` 출력이 바뀌지 않는다 | 통과 | `git diff cf64e24 --stat`: 변경 파일은 src/gift/gift-points.js, test/gift.test.js, 지식 문서뿐. src/format, gift-order.js 무변경 |

## 테스트 파일 변경
- test/gift.test.js — 약화 아님 — 새 테스트 2개 추가뿐, 기존 단언은 그대로

## 남은 위험
- 이미 저장된 선물 주문의 `points.earned`는 다시 계산하지 않았다(의도대로). 기존 값은 옛 규칙 그대로다.
- gift-points.js를 다른 팀과 함께 보는 중이라 변경이 겹칠 수 있다.
- `giftPoints`는 이제 `earnPoints`를 감싸기만 하는 함수다. 공개 export(src/index.js)라 유지했다.
- 부분 환불 `refund.js`의 `pointsRecovered`는 범위 밖으로 남아 있다.
