// 메일 보내기 (보낸 메일은 outbox에 쌓는다)
export const outbox = []

export function sendEmail(to, subject) {
  if (!/^[^@\s]+@[^@\s]+$/.test(to)) throw new Error(`email: invalid address ${to}`)
  outbox.push({ to, subject })
}
