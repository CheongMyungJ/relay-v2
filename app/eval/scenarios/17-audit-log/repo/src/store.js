// 메모리 저장소. 실제 서비스에서는 DB가 이 자리에 온다
export function createStore() {
  return { users: new Map(), nextId: 1 }
}
