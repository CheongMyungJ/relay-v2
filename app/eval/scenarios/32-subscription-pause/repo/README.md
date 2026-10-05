# mealbox

반찬 정기배송 서비스의 구독·결제·배송 서버 코드. 외부 의존성 없이 Node만 쓴다(`npm test`).

## 개념

| 이름 | 뜻 |
|---|---|
| 플랜 (plan) | `src/plans/plans.js`. 월간(`monthly`)과 연간(`annual`) 결제 주기, 값 |
| 구독 (subscription) | `src/subscriptions/`. 회원, 플랜, 다음 결제일(`nextBillingOn`), 배송 요일(`deliveryWeekday`, 0=일요일), 해지일 |
| 결제 | `src/billing/`. 다음 결제일이 된 구독을 결제하고 다음 결제일을 한 주기 뒤로 민다 |
| 배송 | `src/deliveries/`. 배송 요일마다 그 주 반찬을 보낸다 |
| 알림 | `src/notify/`. 결제 사흘 전 안내 문자 |
| 리포트 | `src/reports/`. 활성 구독 수, 해지, 매출 |
| 하루 작업 | `src/jobs/daily.js`의 `runDaily(today)`. 매일 새벽 결제 → 배송 → 알림 차례로 돈다 |

날짜는 모두 `YYYY-MM-DD` 글자로 다룬다(`src/util/dates.js`). 함수는 오늘 날짜를 인자로 받는다.

## 구독 데이터

`src/subscriptions/store.js`가 메모리에 둔다. `resetStore(subscriptions)`로 바꿀 수 있다. 예시 데이터는 `src/seed.js`.
