import { normalizeEmail } from './email.js'
import { NotFoundError, ValidationError } from './errors.js'

// 사용자 서비스. now는 시험에서 시각을 고정하려고 받는다
export function createUserService(store, { now = () => new Date() } = {}) {
  function find(id) {
    const user = store.users.get(id)
    if (!user) throw new NotFoundError(`사용자 ${id}`)
    return user
  }

  function emailTaken(email, exceptId) {
    return [...store.users.values()].some((u) => u.email === email && u.id !== exceptId)
  }

  return {
    createUser({ name, email }) {
      if (!String(name ?? '').trim()) throw new ValidationError('이름이 비어 있음')
      const e = normalizeEmail(email)
      if (emailTaken(e)) throw new ValidationError(`이미 쓰는 이메일: ${e}`)
      const user = { id: store.nextId++, name: name.trim(), email: e, createdAt: now().toISOString() }
      store.users.set(user.id, user)
      return { ...user }
    },

    updateEmail(id, email) {
      const user = find(id)
      const e = normalizeEmail(email)
      if (emailTaken(e, id)) throw new ValidationError(`이미 쓰는 이메일: ${e}`)
      user.email = e
      return { ...user }
    },

    deleteUser(id) {
      find(id)
      store.users.delete(id)
      return true
    },

    getUser(id) {
      return { ...find(id) }
    },
  }
}
