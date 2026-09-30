// 기본 설정. 배포 환경마다 load.js에서 환경 변수와 인자로 덮어쓴다.
import { deepFreeze } from '../util/deep-merge.js'

export const defaults = deepFreeze({
  service: {
    name: 'notify',
    env: 'development',
  },
  intake: {
    // 받아들이는 이벤트 출처
    allowedSources: ['orders', 'accounts', 'billing'],
    // data 필드를 JSON으로 적었을 때의 최대 크기
    maxDataBytes: 16 * 1024,
    // 발생 시각이 수신 시각보다 이만큼 넘게 미래면 거절한다
    maxClockSkewMs: 5 * 60 * 1000,
  },
  dedupe: {
    windowMs: 24 * 60 * 60 * 1000,
    maxEntries: 50_000,
  },
  send: {
    // 발송 한 건의 제한 시간
    timeoutMs: 2000,
  },
  retry: {
    // 첫 발송을 포함한 최대 시도 횟수
    maxAttempts: 3,
    baseDelayMs: 1000,
    factor: 2,
    maxDelayMs: 60 * 1000,
    maxQueueSize: 10_000,
  },
  channels: {
    mail: {
      enabled: true,
      from: 'no-reply@notify.example',
    },
    push: {
      enabled: true,
      ttlSeconds: 3600,
    },
  },
  templates: {
    defaultLocale: 'ko',
  },
})
