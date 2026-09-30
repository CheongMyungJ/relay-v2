# notify

주문, 계정, 결제 서비스가 보내는 이벤트를 받아 고객에게 메일과 푸시 알림을 보내는 서비스다.

## 흐름

1. **수신** (`src/intake/`): 보내는 쪽이 이벤트를 보낸다. 모양을 확인하고 내부 모양으로 바꾼 뒤 수신 시각을 붙인다.
   보내는 쪽은 "적어도 한 번" 전달하므로 같은 이벤트가 다시 올 수 있다.
2. **중복 제거** (`src/dedupe/`): 이미 받은 이벤트면 보내지 않는다. 기록은 설정한 기간(기본 24시간) 동안 둔다.
3. **발송** (`src/dispatch/`): 이벤트 종류의 템플릿과 사용자 설정(연락처, 수신 거부, 방해 금지 시간)을 보고
   채널별로 보낸다. 채널은 `src/adapters/`의 메일, 푸시 어댑터가 맡는다.
4. **재시도** (`src/retry/`): 발송 결과를 보고 끝낼지, 기다렸다 다시 보낼지, 포기할지 정한다.
   다시 보낼 것은 재시도 대기열에 넣고, 재시도 워커가 때가 되면 꺼내 다시 보낸다.

그 밖에 `src/templates/`(알림 문구), `src/preferences/`(사용자 설정), `src/metrics/`(지표), `src/config/`(설정)가 있다.

## 시각

모든 모듈은 `Date.now()` 대신 주입받은 `clock`을 쓴다. 운영에서는 `createSystemClock()`,
시험에서는 `createVirtualClock()`을 쓴다. 가상 시계의 `sleep`은 기다리지 않고 시각만 앞으로 민다.
가짜 전송(`src/adapters/fake-transports.js`)은 `clock.sleep`으로 걸리는 시간을 흉내 내므로,
가상 시계와 함께 쓰면 몇 초 걸리는 발송도 시험에서 바로 끝난다.

```js
import { createNotifier, createVirtualClock, createFakeMailTransport } from './src/index.js'

const clock = createVirtualClock('2026-09-21T01:00:00Z')
const mail = createFakeMailTransport({ clock, latencyMs: 400 })
const notifier = createNotifier({
  clock,
  transports: { mail },
  preferences: { 'u-1': { email: 'mina@example.com', pushTokens: ['tok-a'] } },
})

await notifier.handle({
  id: 'ord-1001-shipped',
  source: 'orders',
  type: 'order.shipped',
  userId: 'u-1',
  occurredAt: '2026-09-21T00:59:58Z',
  data: { orderNo: 'A-1001', carrier: 'CJ대한통운', trackingNo: '6400-1234' },
})

// 재시도 대기열 처리: 운영에서는 notifier.start()가 주기적으로 부른다
clock.advance(5000)
await notifier.retryWorker.runDue()
```

## 설정

기본값은 `src/config/defaults.js`에 있다. 환경 변수(`NOTIFY_SEND_TIMEOUT_MS` 등, `src/config/load.js` 참고)와
`createNotifier({ config })` 인자로 덮어쓴다.

## 시험

```
npm test
```

외부 의존성은 없다. Node 20 이상.
