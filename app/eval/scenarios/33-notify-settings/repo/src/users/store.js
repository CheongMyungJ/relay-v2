// 사용자 저장소 (메모리). timezone은 가입할 때 브라우저에서 받은 IANA 이름이다
const users = new Map([
  [1, { id: 1, name: '김하나', email: 'hana@example.com', timezone: 'Asia/Seoul' }],
  [2, { id: 2, name: 'Sam Lee', email: 'sam@example.com', timezone: 'America/Los_Angeles' }],
  [3, { id: 3, name: '박두리', email: 'duri@example.com', timezone: 'Europe/Berlin' }],
])

export function getUser(id) {
  return users.get(id) ?? null
}

export function allUsers() {
  return [...users.values()]
}
