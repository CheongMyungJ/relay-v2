# stock

주문과 재고 서비스. 상품(SKU)은 창고 서울(`seoul`), 부산(`busan`) 가운데 한 곳 또는 두 곳에 보관한다.

- 주문(`src/orders/`): 주문을 받으면 배송 지역에 가까운 창고부터 재고를 나눠 잡고(`src/warehouses/`) 예약한다. 취소하면 예약을 푼다. 출고하면 실재고와 예약이 함께 준다.
- 재고(`src/inventory/`): 창고별 레코드 `{ onHand, reserved }`. 가용 재고는 `onHand - reserved`. 레코드는 LRU 캐시(`src/cache/`)를 거쳐 읽는다.
- 리포트(`src/reports/`): 주간 재고 리포트(창고별 실재고, 예약, 가용)와 매출 요약.
- 그 밖에 가격과 프로모션(`src/pricing/`), 알림(`src/notify/`), 설정(`src/config/`).

저장소는 메모리 테이블이다(`src/store/`). 실제 운영에서는 DB 앞에 같은 인터페이스를 둔다.

```js
import { createService } from './src/index.js'

const svc = createService({ now: '2026-09-28T09:00:00+09:00' })
const order = svc.orders.place({ customer: { id: 'c1', region: '서울' }, lines: [{ sku: 'B-200', qty: 2 }] })
svc.orders.cancel(order.id, '고객 요청')
console.log(svc.reports.stock().text)
```

```bash
npm test
node src/cli.js report     # 샘플 데이터로 재고 리포트
node src/cli.js sales      # 샘플 데이터로 매출 요약
```
