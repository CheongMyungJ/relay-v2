## 리뷰 지적
없음

## 반영
없음

## 반영하지 않은 지적
없음

## 완료조건 판정
| 완료조건 | 판정 | 근거 |
|---|---|---|
| 재현 절차(G-0213의 적립 예정 포인트 계산)가 더 이상 실패하지 않는다. 결과는 218P이다 | 통과 | fix.md의 재현 명령을 다시 실행: `points = { used: 1000, earned: 218 }` (수정 전 249) |
| `npm test`가 통과한다 | 통과 | `npm test` 27건 통과, 0건 실패 |
| 기존 테스트를 약화하거나 삭제하지 않는다 | 통과 | `git diff a9a5c66`: test/gift.test.js에 추가만 있고 기존 테스트 변경·삭제 없음 |
| G-0213의 적립 예정 포인트를 확인하는 테스트가 추가되어 218P를 기대한다 | 통과 | test/gift.test.js의 "G-0213의 적립 예정 포인트는 218P"가 `examples/G-0213.json`으로 218을 기대하고 통과 |
| `src/format/`, 선물 메시지 카드, 받는 사람 정보 관련 코드와 출력이 바뀌지 않는다 | 통과 | `git diff a9a5c66 --stat`: 바뀐 파일은 src/gift/gift-points.js, test/gift.test.js뿐 |
| 이미 적립된 포인트를 다시 계산하는 코드가 추가되지 않는다 | 통과 | diff는 `giftPoints`가 `earnPoints`를 부르게 한 것뿐이고 재계산 코드는 없다 |

## 테스트 파일 변경
- test/gift.test.js — 약화 아님 — 테스트 2건 추가만 있고 기존 단언은 그대로다. import 두 줄이 늘었다

## 남은 위험
- 기대값 218P와 적립 기준은 고객센터 값 두 건(O-1042, G-0213)으로만 확인했다
- `src/orders/refund.js`의 `pointsRecovered`는 적립 기준과 다르다(비목표). `docs/knowledge/points/earn-basis.md`에 기록했다
