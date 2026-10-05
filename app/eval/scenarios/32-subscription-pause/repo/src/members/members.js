import { NotFoundError } from '../util/errors.js'

const MEMBERS = new Map(
  [
    { id: 'M-1', name: '김하나', phone: '010-1111-2222', address: '서울 마포구', cardValid: true },
    { id: 'M-2', name: '이두리', phone: '010-3333-4444', address: '서울 강동구', cardValid: true },
    { id: 'M-3', name: '박세나', phone: '010-5555-6666', address: '경기 성남시', cardValid: false },
    { id: 'M-4', name: '최네오', phone: '010-7777-8888', address: '인천 연수구', cardValid: true },
  ].map((m) => [m.id, m]),
)

export function getMember(id) {
  const m = MEMBERS.get(id)
  if (!m) throw new NotFoundError('회원', id)
  return m
}

export function listMembers() {
  return [...MEMBERS.values()]
}
