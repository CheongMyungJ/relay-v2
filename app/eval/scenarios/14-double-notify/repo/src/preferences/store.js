// 사용자별 연락처와 수신 설정. 운영에서는 계정 서비스가 채워 준다.

const DEFAULT_PREFS = Object.freeze({
  locale: 'ko',
  email: null,
  pushTokens: [],
  optOut: [],
  quietHours: null,
  tzOffsetMinutes: 540,
})

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function createPreferenceStore(initial = {}) {
  const users = new Map()

  function set(userId, prefs) {
    const merged = { ...DEFAULT_PREFS, ...(users.get(userId) ?? {}), ...prefs }
    if (merged.email !== null && !EMAIL_RE.test(merged.email)) throw new Error(`메일 주소가 틀림: ${merged.email}`)
    if (!Array.isArray(merged.pushTokens)) throw new Error('pushTokens는 배열이어야 한다')
    users.set(userId, { ...merged, pushTokens: [...merged.pushTokens], optOut: [...merged.optOut] })
  }

  for (const [userId, prefs] of Object.entries(initial)) set(userId, prefs)

  return {
    get: (userId) => users.get(userId) ?? { ...DEFAULT_PREFS },
    set,
    optOut(userId, channel) {
      const cur = users.get(userId) ?? { ...DEFAULT_PREFS }
      if (!cur.optOut.includes(channel)) set(userId, { optOut: [...cur.optOut, channel] })
    },
    optIn(userId, channel) {
      const cur = users.get(userId) ?? { ...DEFAULT_PREFS }
      set(userId, { optOut: cur.optOut.filter((c) => c !== channel) })
    },
    removePushToken(userId, token) {
      const cur = users.get(userId)
      if (cur) set(userId, { pushTokens: cur.pushTokens.filter((t) => t !== token) })
    },
    remove: (userId) => users.delete(userId),
    /** 계정 서비스와 맞춰 보려고 내보낸다 */
    snapshot() {
      const out = {}
      for (const [userId, prefs] of users) out[userId] = { ...prefs, pushTokens: [...prefs.pushTokens], optOut: [...prefs.optOut] }
      return out
    },
    size: () => users.size,
  }
}
