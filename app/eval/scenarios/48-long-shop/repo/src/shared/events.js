// 서비스 사이의 이벤트. 같은 프로세스 안에서 차례대로, 바로(동기로) 부른다.
// 구독자가 던진 오류는 이벤트를 낸 쪽으로 올라간다(삼키지 않는다).

export function createBus() {
  const handlers = new Map()
  const history = []
  return {
    on(type, handler) {
      if (!handlers.has(type)) handlers.set(type, [])
      handlers.get(type).push(handler)
      return () => {
        const list = handlers.get(type)
        const i = list.indexOf(handler)
        if (i >= 0) list.splice(i, 1)
      }
    },
    emit(type, payload) {
      history.push({ type, payload })
      for (const h of handlers.get(type) ?? []) h(payload)
    },
    history: () => history.slice(),
  }
}
