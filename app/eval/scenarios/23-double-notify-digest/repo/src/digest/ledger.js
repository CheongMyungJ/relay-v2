// 요약 발송 기록. 운영에서는 서버들이 같이 쓰는 DB에 두고, 여기서는 메모리에 둔다.
//   - 보낸 키: 이미 보낸 요약을 다시 보내지 않으려고 둔다(기간이 지나면 지운다)
//   - 기록: 실행마다 누구에게 어떻게 됐는지. 고객 문의와 운영 화면에서 본다
import { createTtlStore } from '../dedupe/store.js'

export function createDigestLedger({ clock, ttlMs, limit = 10_000 }) {
  const sentKeys = createTtlStore({ clock, ttlMs })
  const entries = []

  function record(entry) {
    entries.push({ ...entry, at: clock.now() })
    if (entries.length > limit) entries.shift()
  }

  return {
    has: (key) => sentKeys.has(key),
    markSent(key, entry) {
      sentKeys.add(key)
      record({ ...entry, status: 'sent' })
    },
    record,
    entries: () => entries.map((e) => ({ ...e })),
    forUser: (userId) => entries.filter((e) => e.userId === userId).map((e) => ({ ...e })),
    /** 실행별 상태 건수 */
    runSummary(runId) {
      const out = {}
      for (const e of entries) if (e.runId === runId) out[e.status] = (out[e.status] ?? 0) + 1
      return out
    },
    size: () => entries.length,
  }
}
