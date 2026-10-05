import { NotFoundError } from '../util/errors.js'

const MEMBERS = new Map(
  [
    { id: 'M-1', name: '김하나', phone: '010-1111-2222', grade: 'basic', joinedOn: '2022-03-02' },
    { id: 'M-2', name: '이두리', phone: '010-3333-4444', grade: 'plus', joinedOn: '2021-11-15' },
    { id: 'M-3', name: '박세나', phone: '010-5555-6666', grade: 'basic', joinedOn: '2024-06-30' },
    { id: 'M-4', name: '최네오', phone: '010-7777-8888', grade: 'plus', joinedOn: '2025-01-09' },
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

export function setGrade(id, grade) {
  getMember(id).grade = grade
}
