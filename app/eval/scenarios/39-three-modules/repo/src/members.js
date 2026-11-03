// 회원: { id, name, email }

export function byId(members, id) {
  return members.find((m) => m.id === id) ?? null
}
