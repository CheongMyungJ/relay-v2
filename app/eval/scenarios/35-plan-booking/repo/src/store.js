// 메모리 저장소. 예약은 bookings 배열에 들어가고 id는 nextId로 매긴다
export function createStore() {
  return { bookings: [], nextId: 1 }
}
