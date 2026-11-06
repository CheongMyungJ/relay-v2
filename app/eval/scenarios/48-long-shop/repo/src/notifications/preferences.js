// 알림 수신 설정. 기본은 모두 받음. 광고는 따로 끈다(marketing).

export function createPreferences(store) {
  function load(customerId) {
    if (!store.preferences.has(customerId)) {
      store.preferences.set(customerId, { email: true, sms: true, marketing: true })
    }
    return store.preferences.get(customerId)
  }

  return {
    get: (customerId) => ({ ...load(customerId) }),
    set(customerId, patch) {
      Object.assign(load(customerId), patch)
      return { ...load(customerId) }
    },
    /** 이 채널로 보내도 되나. 광고는 marketing도 켜져 있어야 한다 */
    allows(customerId, channel, { marketing = false } = {}) {
      const p = load(customerId)
      if (!p[channel]) return false
      return marketing ? p.marketing : true
    },
  }
}
