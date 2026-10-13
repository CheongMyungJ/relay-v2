// 회원 저장소 (메모리)
let members = []

export function resetMembers(list = []) {
  members = list.map((m) => ({ ...m }))
}

export function getMember(id) {
  const m = members.find((x) => x.id === id)
  return m ? { ...m } : null
}
