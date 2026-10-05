# toolshare

동네 공구 대여점의 대여·반납·청구 서버 코드. 외부 의존성 없이 Node만 쓴다(`npm test`).

## 개념

| 이름 | 뜻 |
|---|---|
| 공구 (tool) | `src/catalog/tools.js`. 일 대여료(`dailyRate`)와 보증금(`deposit`)이 있다. 파트너(공구를 맡긴 사람)의 공구도 있다 |
| 회원 (member) | `src/members/`. 등급(`basic`, `plus`)에 따라 대여료를 깎아 준다 |
| 대여 (rental) | `src/rentals/`. 대여 시작일, 반납 예정일(`dueDate`), 반납일(`returnedOn`), 받은 돈(`charges`) |
| 청구서 | `src/billing/`. 회원의 한 달치 대여료와 연체료, 부가세 |
| 파트너 정산 | `src/partners/`. 파트너 공구에서 나온 돈의 파트너 몫 |
| 알림 | `src/notify/`. 반납 하루 전 안내, 연체 안내 문자 |
| 리포트 | `src/reports/`. 연체 현황, 공구 가동률 |
| 관리 명령 | `src/admin/cli.js`. 매장 직원이 쓰는 명령(`node src/admin/cli.js fee R-1001 2026-10-05`) |

날짜는 모두 `YYYY-MM-DD` 글자로 다룬다(`src/util/dates.js`).

## 연체료

반납 예정일을 넘기면 늦은 날 수 × 일 대여료의 절반을 받는다. 하루 늦은 것은 받지 않는다. 연체료는 보증금을 넘지 않는다.

## 대여 데이터

`src/rentals/store.js`가 메모리에 둔다. `resetStore(rentals)`로 바꿀 수 있다. 예시 데이터는 `src/seed.js`.
