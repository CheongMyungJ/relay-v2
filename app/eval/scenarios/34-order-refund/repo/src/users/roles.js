// 역할 (docs/design.md D4)
export const ROLES = ['customer', 'staff', 'admin']

export function isStaff(user) {
  return user.role === 'staff' || user.role === 'admin'
}
